import asyncio
from bleak import BleakClient
from datetime import datetime

DEVICE_ADDRESS = "34:81:F4:33:AE:91"

# Notify characteristics for MA900 (BM70/RN4870 UART)
NOTIFY_UUIDS = [
    "49535343-aca3-481c-91ec-d85e28a60318",
    "49535343-1e4d-4bd9-ba61-23c647249616",
    "49535343-026e-3a9b-954c-97daef17e26e"
]

SYNC_BYTES = b'\xAA\xAA'

# Define expected code lengths
CODE_LENGTHS = {
    0x02: 1,  # Poor signal
    0x04: 1,  # Attention
    0x05: 1,  # Meditation
    0x80: 2,  # Raw EEG 16-bit
    0x83: 24, # EEG band powers (8 bands × 3 bytes)
}

BUFFER = bytearray()

def parse_thinkgear_stream(data):
    """Parse ThinkGear packets from a byte stream and validate them."""
    global BUFFER
    BUFFER.extend(data)
    i = 0
    results = []

    while i < len(BUFFER) - 2:
        # Look for sync bytes
        if BUFFER[i:i+2] != SYNC_BYTES:
            i += 1
            continue

        # Need at least sync + length + code + checksum
        if i + 4 > len(BUFFER):
            break

        payload_len = BUFFER[i+2]
        packet_end = i + 3 + payload_len + 1  # +3 for sync+len, +1 for checksum

        if packet_end > len(BUFFER):
            break  # incomplete packet, wait for more data

        packet = BUFFER[i:packet_end]
        payload = packet[3:-1]
        checksum = packet[-1]

        # Validate checksum
        calc_checksum = 0xFF - (sum(payload) & 0xFF)
        valid_checksum = (calc_checksum == checksum)

        # Parse codes in payload
        j = 0
        parsed_values = {}
        while j < len(payload):
            code = payload[j]
            j += 1
            length = CODE_LENGTHS.get(code, None)
            if length is None:
                # Unknown code, skip one byte (best effort)
                j += 1
                continue
            if j + length > len(payload):
                parsed_values["ERROR"] = f"Incomplete data for code 0x{code:02X}"
                break
            val_bytes = payload[j:j+length]
            j += length
            # Decode based on code
            if code == 0x02:
                parsed_values["PoorSignal"] = val_bytes[0]
            elif code == 0x04:
                parsed_values["Attention"] = val_bytes[0]
            elif code == 0x05:
                parsed_values["Meditation"] = val_bytes[0]
            elif code == 0x80:
                parsed_values["RawEEG"] = int.from_bytes(val_bytes, 'big', signed=True)
            elif code == 0x83:
                # EEG band powers: 8 × 3 bytes
                bands = ['Delta','Theta','AlphaLow','AlphaHigh','BetaLow','BetaHigh','GammaLow','GammaHigh']
                powers = {}
                for k, band in enumerate(bands):
                    start = k*3
                    powers[band] = int.from_bytes(val_bytes[start:start+3], 'big')
                parsed_values["EEG_Bands"] = powers

        timestamp = datetime.now().strftime("%H:%M:%S")
        results.append({
            "timestamp": timestamp,
            "raw_packet": packet.hex(),
            "parsed": parsed_values,
            "checksum_valid": valid_checksum
        })

        i = packet_end  # move to next packet

    # Remove processed bytes
    BUFFER = BUFFER[i:]
    return results

def handle_notify(sender, data):
    packets = parse_thinkgear_stream(data)
    for p in packets:
        print(f"\n[{p['timestamp']}] Packet: {p['raw_packet']}")
        print(f"  Checksum valid: {p['checksum_valid']}")
        for k,v in p['parsed'].items():
            print(f"  {k}: {v}")

async def main():
    async with BleakClient(DEVICE_ADDRESS) as client:
        print("Connecting...")
        if not client.is_connected:
            print("Failed to connect")
            return
        print("✅ Connected to MA900")

        # Subscribe to all notify characteristics
        for uuid in NOTIFY_UUIDS:
            try:
                await client.start_notify(uuid, handle_notify)
                print(f"Subscribed to {uuid}")
            except Exception as e:
                print(f"Could not subscribe to {uuid}: {e}")

        print("\nListening for ThinkGear packets... (Ctrl+C to stop)")
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping notifications...")
            for uuid in NOTIFY_UUIDS:
                await client.stop_notify(uuid)
            print("✅ Stopped")

if __name__ == "__main__":
    asyncio.run(main())
