import asyncio
from bleak import BleakClient

# --- Configuration ---
DEVICE_ADDRESS = "34:81:F4:33:AE:91" # Replace with your CoreSA BLE address

# The UUID confirmed to be sending the Raw EEG data (ThinkGear-compatible)
RAW_EEG_UUID = "49535343-1e4d-4bd9-ba61-23c647249616"

# --- Global Buffer for Incomplete Packets ---
buffer = bytearray()
PACKET_START = b'\xaa\xaa'
# Note: Raw EEG packets are usually 8 bytes in total:
# 0xAA 0xAA PLENGTH (0x04) 0x80 0x02 RawHigh RawLow Checksum
RAW_EEG_PACKET_LENGTH = 8

def calculate_checksum(payload: bytearray) -> int:
    """Calculates the inverted sum of the payload bytes."""
    checksum_sum = 0
    # Sum all bytes from the payload (PLENGTH to RawLow)
    # The payload is defined as all bytes AFTER the two 0xAA and BEFORE the Checksum byte
    for byte in payload[:-1]: 
        checksum_sum += byte
    # Take the lowest 8 bits of the sum (checksum_sum & 0xFF)
    # Perform a bitwise inversion (~), and keep the lowest 8 bits (& 0xFF)
    calculated_checksum = (~checksum_sum) & 0xFF
    return calculated_checksum

def parse_raw_eeg_packet(packet: bytearray):
    """
    Parses a single 8-byte ThinkGear Raw EEG packet, including checksum validation.
    Extracts the 16-bit signed raw EEG value.
    """
    if len(packet) != RAW_EEG_PACKET_LENGTH or packet[0:2] != PACKET_START:
        return None, "Invalid Start or Length"

    # Expected payload: [PLENGTH] [CODE] [VLENGTH] [RawHigh] [RawLow] [Checksum]
    payload = packet[2:] # Payload starts at index 2 (PLENGTH)

    # 1. Check Payload Length (PLENGTH = 0x04 for a Raw EEG packet)
    plength = payload[0] 
    if plength != 0x04:
        return None, f"Non-Raw EEG Packet (PLENGTH={plength})"

    # 2. Check Data Code (0x80 for Raw Wave Value) and Value Length (0x02)
    # Indices 1, 2, 3, 4 are for the raw value data row: [0x80] [0x02] [RawHigh] [RawLow]
    if payload[1] != 0x80 or payload[2] != 0x02:
        return None, f"Unexpected Data Code/VLength: {payload[1]} / {payload[2]}"

    # 3. Validate Checksum
    received_checksum = packet[7]
    calculated_checksum = calculate_checksum(payload)
    
    if received_checksum != calculated_checksum:
        # print(f"Checksum FAILED: Expected {calculated_checksum}, Got {received_checksum}")
        return None, "Checksum Failed"

    # 4. Extract and Convert Raw Value (Signed 16-bit integer)
    value_high = packet[5]
    value_low = packet[6]
    
    # Combine high and low bytes to form a signed 16-bit integer (big-endian)
    raw_value = (value_high << 8) | value_low
    
    # Convert unsigned 16-bit value to signed 16-bit value (two's complement)
    if raw_value >= 32768:
        raw_value -= 65536
        
    return raw_value, "Success"


def handle_notify(sender, data):
    global buffer
    
    # 1. Append new data to the buffer
    buffer.extend(data)
    
    # 2. Search for and process complete packets
    while True:
        # Find the start of the packet
        start_index = buffer.find(PACKET_START)

        if start_index == -1:
            # No start found, clear buffer to prevent indefinite growth from noise
            buffer.clear()
            break

        # Check for a full 8-byte packet
        if len(buffer) < start_index + RAW_EEG_PACKET_LENGTH:
            # Not enough data. Shift buffer to sync bytes and wait for more data.
            buffer[:] = buffer[start_index:]
            break

        # 3. Extract and Parse the full 8-byte packet
        packet = buffer[start_index : start_index + RAW_EEG_PACKET_LENGTH]
        raw_eeg_value, status = parse_raw_eeg_packet(packet)

        if status == "Success":
            print(f" Raw EEG Value: {raw_eeg_value}")
        # elif status == "Checksum Failed":
        #     # You can log this for debugging if needed
        #     print(f" Checksum Failed for packet: {packet.hex()}")
        # elif status == "Non-Raw EEG Packet":
        #     # This would be for things like Poor Signal (0x02) or eSense (0x04/0x05)
        #     pass

        # 4. Advance the buffer past the consumed packet
        buffer[:] = buffer[start_index + RAW_EEG_PACKET_LENGTH :]
        # Loop back to check for the next packet in the remaining buffer

async def run_eeg_stream():
    async with BleakClient(DEVICE_ADDRESS) as client:
        print("Connecting...")
        if not client.is_connected:
            print("Failed to connect.")
            return

        print(f"Connected! Subscribing to Raw EEG Characteristic: {RAW_EEG_UUID}\n")

        try:
            await client.start_notify(RAW_EEG_UUID, handle_notify)
            print("Streaming data. Press Ctrl+C to stop...")
            # Keep the connection alive
            await asyncio.Future() 
        except asyncio.CancelledError:
            pass
        finally:
            await client.stop_notify(RAW_EEG_UUID)
            print("\nStopped EEG stream.")

if __name__ == "__main__":
    try:
        asyncio.run(run_eeg_stream())
    except KeyboardInterrupt:
        print("\nProgram interrupted by user.")