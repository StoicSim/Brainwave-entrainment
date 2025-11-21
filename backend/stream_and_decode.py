import asyncio
from bleak import BleakClient

# Global buffer to hold partial data across notifications
# A simple list of integers (bytes) works well as a stream buffer.
THINKGEAR_BUFFER = []
DEVICE_ADDRESS = "34:81:F4:33:AE:91" # your EEG device MAC

# Notify UUIDs for NeuroSky-like devices
NOTIFY_UUIDS = [
    "49535343-aca3-481c-91ec-d85e28a60318",
    "49535343-1e4d-4bd9-ba61-23c647249616",
    "49535343-026e-3a9b-954c-97daef17e26e"
]

# ----------------------------------------------------------
# Streaming Parser and Decoder (ThinkGear Protocol)
# ----------------------------------------------------------
def parse_and_decode_stream(new_payload: bytearray):
    """
    Parses a stream of concatenated ThinkGear packets, extracts raw EEG data.
    """
    global THINKGEAR_BUFFER
    # Append the new payload bytes to the global buffer
    THINKGEAR_BUFFER.extend(new_payload)

    SYNC = 0xAA
    MIN_PACKET_LENGTH = 4 # [SYNC, SYNC, PLENGTH, CHKSUM] (for PLENGTH=1)
    
    # Process the buffer as long as there's enough data for a header
    while len(THINKGEAR_BUFFER) >= MIN_PACKET_LENGTH:
        
        # 1. Find the SYNC bytes (0xAA 0xAA)
        try:
            # Drop data until a sync byte is found
            while THINKGEAR_BUFFER[0] != SYNC:
                THINKGEAR_BUFFER.pop(0)
            
            # Check for the second sync byte (at index 1)
            if THINKGEAR_BUFFER[1] != SYNC:
                # First byte was a sync byte, but the second wasn't. Drop the first and continue the search.
                THINKGEAR_BUFFER.pop(0)
                continue
        except IndexError:
            # Buffer is empty or too short after popping
            break

        # Check if we have at least the Header: [0xAA, 0xAA, PLENGTH]
        if len(THINKGEAR_BUFFER) < 3:
            # Should not happen if the first two were sync bytes, but good for safety
            break 
            
        p_length = THINKGEAR_BUFFER[2] # Payload Length is the 3rd byte
        
        # 2. Check for Packet Integrity (Header + Payload + Checksum)
        # Total length is 3 (Header) + PLENGTH (Payload) + 1 (Checksum)
        total_packet_length = 3 + p_length + 1 

        if len(THINKGEAR_BUFFER) < total_packet_length:
            # Packet is incomplete. Wait for more data in the next notification.
            break

        # Packet is complete! Slice it out.
        packet = THINKGEAR_BUFFER[:total_packet_length]
        THINKGEAR_BUFFER = THINKGEAR_BUFFER[total_packet_length:] # Remove the packet from the buffer

        # 3. Process the Payload (raw_eeg is data code 0x80)
        # We only care about the raw EEG value
        p_data = packet[3:3 + p_length]
        i = 0
        while i < len(p_data):
            code = p_data[i]
            i += 1

            if code == 0x80: # Raw EEG Value
                # Raw EEG is an extended code, 2-byte value
                # Format: [0x80, VLEN=0x02, HIGH_BYTE, LOW_BYTE]
                
                # Original code checked for VLEN and skipped it. We'll rely on the structure.
                if i + 2 > len(p_data):
                    break # Incomplete data row

                # Skip VLEN (must be 0x02 for 16-bit raw value)
                i += 1
                
                # Extract 16-bit signed raw value (Big-Endian)
                high_byte = p_data[i]
                low_byte = p_data[i + 1]
                i += 2
                
                raw_val = (high_byte << 8) | low_byte
                
                # Convert 16-bit unsigned to signed integer (Two's Complement)
                if raw_val >= 32768:
                    raw_val -= 65536
                    
                print(f"  | RAW EEG: {raw_val}")
                
            elif code < 0x80:
                # Single-byte value code (e.g., 0x02 Attention, 0x04 Meditation, 0x01 Poor Signal)
                i += 1 # Skip the single data byte
            elif code == 0x83:
                # EEG Power: VLEN is 0x18 (24 bytes). Skip 1 (VLEN) + 24 (data) bytes
                i += 1 + 24
            else:
                # Skip unknown/unwanted multi-byte code: read VLEN, then skip VLEN bytes
                try:
                    vlen = p_data[i]
                    i += 1 + vlen
                except IndexError:
                    break

        # OPTIONAL: Checksum Verification (recommended for robust parsing)
        # chksum_calculated = (~(sum(p_data) & 0xFF)) & 0xFF
        # chksum_received = packet[-1]
        # if chksum_calculated != chksum_received:
        #     print(f"  | ⚠️ Checksum FAILED: Expected {chksum_calculated} vs Got {chksum_received}")
        # else:
        #     print("  | Checksum OK")


# ----------------------------------------------------------
# BLE notification handler
# ----------------------------------------------------------
def handle_notify(sender, payload):
    """Callback function for Bleak notifications."""
    print(f"\n--- Notification received from Handle {sender} ({len(payload)} bytes) ---")
    parse_and_decode_stream(bytearray(payload))


# ----------------------------------------------------------
# Main async loop
# ----------------------------------------------------------
async def stream_and_decode():
    async with BleakClient(DEVICE_ADDRESS) as client:
        print("Connecting...")
        if not client.is_connected:
            print("❌ Failed to connect")
            return

        print("✅ Connected! Starting notifications...")

        for uuid in NOTIFY_UUIDS:
            try:
                # Pass the handler to start_notify
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

# Run
if __name__ == "__main__":
    asyncio.run(stream_and_decode())