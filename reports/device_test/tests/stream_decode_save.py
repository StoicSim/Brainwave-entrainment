import asyncio
import struct
from bleak import BleakClient
from datetime import datetime
import csv

DEVICE_ADDRESS = "34:81:F4:33:AE:91"

NOTIFY_UUIDS = [
    "49535343-aca3-481c-91ec-d85e28a60318",
    "49535343-1e4d-4bd9-ba61-23c647249616",
    "49535343-026e-3a9b-954c-97daef17e26e"
]

# Open CSV file for live logging
csv_file = open("eeg_raw_log.csv", "w", newline="")
csv_writer = csv.writer(csv_file)
csv_writer.writerow(["timestamp", "raw_value"])


def extract_raw_values(data: bytes):
    """Extract all 16-bit signed EEG raw samples from payloads."""
    raw_values = []
    i = 0
    while i < len(data) - 7:
        # Check for sync bytes 0xAA 0xAA 0x04 0x80 0x02
        if data[i:i+5] == b'\xAA\xAA\x04\x80\x02':
            if i + 7 <= len(data):
                # Extract the 2 following bytes
                val_bytes = data[i+5:i+7]
                # Convert to signed short (big-endian)
                val = struct.unpack('>h', val_bytes)[0]
                raw_values.append(val)
                i += 7
            else:
                break
        else:
            i += 1
    return raw_values


def handle_notify(sender, payload):
    raw_vals = extract_raw_values(payload)
    if not raw_vals:
        return

    for val in raw_vals:
        timestamp = datetime.now().isoformat()
        print(f"{timestamp} | {val}")
        csv_writer.writerow([timestamp, val])
        csv_file.flush()


async def stream_raw_eeg():
    async with BleakClient(DEVICE_ADDRESS) as client:
        print("Connecting...")
        if not client.is_connected:
            print(" Failed to connect.")
            return
        print(" Connected! Subscribing to EEG stream...")

        for uuid in NOTIFY_UUIDS:
            try:
                await client.start_notify(uuid, handle_notify)
            except Exception as e:
                print(f"⚠️ Failed to subscribe to {uuid}: {e}")

        print("Streaming raw EEG data (Ctrl+C to stop)...")
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print("Stopping stream...")
            for uuid in NOTIFY_UUIDS:
                await client.stop_notify(uuid)
            csv_file.close()
            print(" CSV saved as eeg_raw_log.csv")


asyncio.run(stream_raw_eeg())
