import asyncio
from bleak import BleakClient
import struct
from datetime import datetime

# --- Configuration ---
DEVICE_ADDRESS = "34:81:F4:33:AE:91" 
# Use only the confirmed active UUID for stability
NOTIFY_UUIDS = [
    "49535343-1e4d-4bd9-ba61-23c647249616" 
]

# --- Global State ---
THINKGEAR_BUFFER = bytearray()
SYNC = 0xAA

# ----------------------------------------------------------
# ThinkGear Protocol Decoder Functions
# ----------------------------------------------------------

def unpack_3byte_unsigned(data_bytes):
    """Unpacks a 3-byte (24-bit) big-endian unsigned integer (used for EEG powers)."""
    padded_data = b'\x00' + bytes(data_bytes)
    return struct.unpack('>I', padded_data)[0]

def parse_and_decode_stream(new_payload: bytearray):
    """
    Parses a stream of concatenated ThinkGear packets, validates the checksum,
    and extracts all data values.
    """
    global THINKGEAR_BUFFER
    THINKGEAR_BUFFER.extend(new_payload)

    MIN_PACKET_LENGTH = 4 
    
    while len(THINKGEAR_BUFFER) >= MIN_PACKET_LENGTH:
        
        # 1. Find the SYNC bytes (0xAA 0xAA) and check packet completeness
        try:
            while THINKGEAR_BUFFER[0] != SYNC:
                THINKGEAR_BUFFER.pop(0)
            if THINKGEAR_BUFFER[1] != SYNC:
                THINKGEAR_BUFFER.pop(0)
                continue
        except IndexError:
            break

        if len(THINKGEAR_BUFFER) < 3: break 
            
        p_length = THINKGEAR_BUFFER[2]
        total_packet_length = 3 + p_length + 1 

        if len(THINKGEAR_BUFFER) < total_packet_length:
            break

        # Packet is complete. Slice it out and process.
        packet = THINKGEAR_BUFFER[:total_packet_length]
        THINKGEAR_BUFFER = THINKGEAR_BUFFER[total_packet_length:]

        p_data = packet[3:3 + p_length]
        
        # 2. Checksum Validation
        received_checksum = packet[-1]
        calculated_checksum = 0xFF - (sum(p_data) & 0xFF)
        checksum_valid = (calculated_checksum == received_checksum)
        
        parsed_values = {'CHECKSUM_VALID': checksum_valid}
        
        if not checksum_valid:
            print(f"\n❌ Checksum FAILED for Packet: {packet.hex()} - Discarding corrupted data.")
            continue 
            
        # 3. Decode the Data
        i = 0
        while i < len(p_data):
            code = p_data[i]
            i += 1

            if code == 0x80: # Raw EEG Value
                if i + 3 > len(p_data) or p_data[i] != 0x02: break 
                i += 1 # Skip VLEN (0x02)
                raw_val = int.from_bytes(p_data[i:i+2], 'big', signed=True)
                i += 2
                parsed_values['RAW_EEG'] = raw_val
                
            elif code == 0x83: # Raw EEG Band Powers
                if i + 25 > len(p_data) or p_data[i] != 0x18: break
                i += 1 # Skip VLEN (0x18)
                bands = ['Delta', 'Theta', 'Alpha Low', 'Alpha High', 
                         'Beta Low', 'Beta High', 'Gamma Low', 'Gamma High']
                power_values = {}
                for band_name in bands:
                    power = unpack_3byte_unsigned(p_data[i:i+3])
                    power_values[band_name] = power
                    i += 3
                parsed_values['BRAIN_WAVE_POWERS'] = power_values

            # --- Single-Byte eSense Values ---
            elif code == 0x02: # Poor Signal Quality 
                if i + 1 > len(p_data): break
                parsed_values['POOR_SIGNAL'] = p_data[i]
                i += 1
            elif code == 0x04: # Attention eSense
                if i + 1 > len(p_data): break
                parsed_values['ATTENTION'] = p_data[i]
                i += 1
            elif code == 0x05: # Meditation eSense
                if i + 1 > len(p_data): break
                parsed_values['MEDITATION'] = p_data[i]
                i += 1
            
            # Catch-all for other codes
            else:
                if code < 0x80: i += 1
                else: 
                    try:
                        vlen = p_data[i]
                        i += 1 + vlen
                    except IndexError: break

        # ----------------------------------------------------
        # --- 4. CONDITIONAL PRINTING (The Filter) ---
        # ----------------------------------------------------
        # Only print the packet if it contains any of the low-frequency metrics.
        
        if ('ATTENTION' in parsed_values or 
            'MEDITATION' in parsed_values or 
            'BRAIN_WAVE_POWERS' in parsed_values or
            (parsed_values.get('POOR_SIGNAL', 0) > 0) ): # Also print if signal is bad
            
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] ✅ PROCESSED METRIC PACKET ({p_length} bytes)")
            
            # Print Signal Quality first
            signal = parsed_values.get('POOR_SIGNAL', 0)
            if signal > 0:
                 print(f"  | ⚠️ Signal Quality: **{signal}** (0=Good, >0=Poor)")
            else:
                 print(f"  | Signal Quality: **{signal}** (Good)")

            # Print eSense
            if 'ATTENTION' in parsed_values:
                print(f"  | **ATTENTION:** {parsed_values['ATTENTION']}")
            if 'MEDITATION' in parsed_values:
                print(f"  | **MEDITATION:** {parsed_values['MEDITATION']}")
            
            # Print Band Powers
            if 'BRAIN_WAVE_POWERS' in parsed_values:
                print("  | **BRAIN WAVE POWERS:**")
                for band, power in parsed_values['BRAIN_WAVE_POWERS'].items():
                    print(f"  |   {band}: {power}")

# ----------------------------------------------------------
# BLE and Main Loop 
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

        print("✅ Connected. Subscribing to the active UUID...")
        for uuid in NOTIFY_UUIDS:
            try:
                await client.start_notify(uuid, handle_notify)
                print(f"  | Subscribed to {uuid}")
            except Exception as e:
                print(f"⚠️ Could not subscribe to {uuid}: {e}")

        print("\nStreaming and filtering for Attention, Meditation, and Band Power metrics (Ctrl+C to stop)...")
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping notifications...")
            for uuid in NOTIFY_UUIDS:
                try:
                    await client.stop_notify(uuid)
                except Exception:
                    pass
            print("✅ Stopped gracefully.")

if __name__ == "__main__":
    try:
        asyncio.run(stream_and_decode())
    except Exception as e:
        print(f"\nAn error occurred during runtime: {e}")