import asyncio
from bleak import BleakClient
import struct # For unpacking 3-byte unsigned integers

# Global buffer to hold partial data across notifications
THINKGEAR_BUFFER = []
DEVICE_ADDRESS = "34:81:F4:33:AE:91" # your EEG device MAC

# Notify UUIDs for NeuroSky-like devices
NOTIFY_UUIDS = [
    "49535343-aca3-481c-91ec-d85e28a60318",
    "49535343-1e4d-4bd9-ba61-23c647249616",
    "49535343-026e-3a9b-954c-97daef17e26e"
]

# ----------------------------------------------------------
# ThinkGear Protocol Decoder Functions
# ----------------------------------------------------------

def unpack_3byte_unsigned(data_bytes):
    """Unpacks a 3-byte (24-bit) big-endian unsigned integer."""
    # Prepend a null byte (0x00) to make it a 4-byte value for standard Python struct.unpack
    padded_data = b'\x00' + bytes(data_bytes)
    # Unpack as a big-endian unsigned long (4 bytes)
    return struct.unpack('>I', padded_data)[0]

def parse_and_decode_stream(new_payload: bytearray):
    """
    Parses a stream of concatenated ThinkGear packets and extracts all data values.
    """
    global THINKGEAR_BUFFER
    THINKGEAR_BUFFER.extend(new_payload)

    SYNC = 0xAA
    MIN_PACKET_LENGTH = 4
    
    while len(THINKGEAR_BUFFER) >= MIN_PACKET_LENGTH:
        
        # 1. Find the SYNC bytes (0xAA 0xAA)
        try:
            # Drop data until a sync byte is found
            while THINKGEAR_BUFFER[0] != SYNC:
                THINKGEAR_BUFFER.pop(0)
            
            # Check for the second sync byte
            if THINKGEAR_BUFFER[1] != SYNC:
                THINKGEAR_BUFFER.pop(0)
                continue
        except IndexError:
            break

        if len(THINKGEAR_BUFFER) < 3: break # Need PLENGTH
            
        p_length = THINKGEAR_BUFFER[2]
        total_packet_length = 3 + p_length + 1 

        if len(THINKGEAR_BUFFER) < total_packet_length:
            # Packet is incomplete. Wait for more data.
            break

        # Packet is complete. Slice it out and process.
        packet = THINKGEAR_BUFFER[:total_packet_length]
        THINKGEAR_BUFFER = THINKGEAR_BUFFER[total_packet_length:]

        p_data = packet[3:3 + p_length]
        
        # Dictionary to store all parsed values for this packet
        parsed_values = {}
        
        i = 0
        while i < len(p_data):
            code = p_data[i]
            i += 1

            if code == 0x80: # Raw EEG Value
                # Format: [0x80, VLEN=0x02, HIGH_BYTE, LOW_BYTE]
                if i + 3 > len(p_data) or p_data[i] != 0x02: break # Check VLEN and bounds

                i += 1 # Skip VLEN (0x02)
                
                # Extract 16-bit signed raw value (Big-Endian)
                raw_val = (p_data[i] << 8) | p_data[i + 1]
                i += 2
                
                # Convert 16-bit unsigned to signed integer (Two's Complement)
                if raw_val >= 32768:
                    raw_val -= 65536
                parsed_values['RAW_EEG'] = raw_val
                
            elif code == 0x83: # Raw EEG Band Powers (Extended Code)
                # Format: [0x83, VLEN=0x18, 24 bytes of power data]
                if i + 25 > len(p_data) or p_data[i] != 0x18: break # Check VLEN (24 bytes) and bounds
                
                i += 1 # Skip VLEN (0x18)
                
                # The next 24 bytes are 8 bands * 3 bytes/band
                bands = ['Delta', 'Theta', 'Alpha Low', 'Alpha High', 
                         'Beta Low', 'Beta High', 'Gamma Low', 'Gamma High']
                
                power_values = {}
                for band_name in bands:
                    power = unpack_3byte_unsigned(p_data[i:i+3])
                    power_values[band_name] = power
                    i += 3
                
                parsed_values['BRAIN_WAVE_POWERS'] = power_values

            # --- Single-Byte eSense Values (The "User" values) ---
            elif code == 0x02: # Poor Signal Quality (1-byte value)
                parsed_values['POOR_SIGNAL'] = p_data[i]
                i += 1
            elif code == 0x04: # Attention eSense (1-byte value: 0-100)
                parsed_values['ATTENTION'] = p_data[i]
                i += 1
            elif code == 0x05: # Meditation eSense (1-byte value: 0-100)
                parsed_values['MEDITATION'] = p_data[i]
                i += 1
            
            # Catch-all for other simple codes (e.g., blink, heartbeat)
            elif code < 0x80:
                i += 1
            # Catch-all for other extended codes
            else:
                try:
                    vlen = p_data[i]
                    i += 1 + vlen
                except IndexError:
                    break
        
        # --- Print the Results for the complete packet ---
        if parsed_values:
            print(f"\n--- Packet Data ---")
            if 'POOR_SIGNAL' in parsed_values:
                print(f"  | Signal Quality: {parsed_values['POOR_SIGNAL']} (0=Good, 200=Bad)")
            if 'RAW_EEG' in parsed_values:
                print(f"  | RAW EEG: {parsed_values['RAW_EEG']}")
            if 'ATTENTION' in parsed_values:
                print(f"  | ATTENTION: {parsed_values['ATTENTION']}")
            if 'MEDITATION' in parsed_values:
                print(f"  | MEDITATION: {parsed_values['MEDITATION']}")
            if 'BRAIN_WAVE_POWERS' in parsed_values:
                print("  | BRAIN WAVE POWERS:")
                for band, power in parsed_values['BRAIN_WAVE_POWERS'].items():
                    print(f"      {band}: {power}")


# ----------------------------------------------------------
# BLE and Main Loop (same as before)
# ----------------------------------------------------------
def handle_notify(sender, payload):
    """Callback function for Bleak notifications."""
    parse_and_decode_stream(bytearray(payload))

async def stream_and_decode():
    async with BleakClient(DEVICE_ADDRESS) as client:
        print("Connecting...")
        if not client.is_connected:
            print("❌ Failed to connect")
            return

        print("✅ Connected! Starting notifications...")

        for uuid in NOTIFY_UUIDS:
            try:
                await client.start_notify(uuid, handle_notify)
                print(f"  | Subscribed to {uuid}")
            except Exception as e:
                print(f"⚠️ Could not subscribe to {uuid}: {e}")

        print("\nStreaming EEG data (press Ctrl+C to stop)...")
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping notifications...")
            for uuid in NOTIFY_UUIDS:
                await client.stop_notify(uuid)
            print("✅ Stopped")

if __name__ == "__main__":
    asyncio.run(stream_and_decode())