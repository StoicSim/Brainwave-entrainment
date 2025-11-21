import asyncio
from bleak import BleakClient

DEVICE_ADDRESS = "34:81:F4:33:AE:91"

DEVICE_INFO_CHARS = {
    "Manufacturer": "00002a29-0000-1000-8000-00805f9b34fb",
    "Model Number": "00002a24-0000-1000-8000-00805f9b34fb",
    "Serial Number": "00002a25-0000-1000-8000-00805f9b34fb",
    "Hardware Revision": "00002a27-0000-1000-8000-00805f9b34fb",
    "Firmware Revision": "00002a26-0000-1000-8000-00805f9b34fb",
    "Software Revision": "00002a28-0000-1000-8000-00805f9b34fb",
    "System ID": "00002a23-0000-1000-8000-00805f9b34fb",
    "Certification Data": "00002a2a-0000-1000-8000-00805f9b34fb"
}

async def read_device_info():
    async with BleakClient(DEVICE_ADDRESS) as client:
        if not client.is_connected:
            print("Failed to connect")
            return

        print(f"Connected to {DEVICE_ADDRESS}\nReading Device Information:\n")

        for name, uuid in DEVICE_INFO_CHARS.items():
            try:
                value = await client.read_gatt_char(uuid)
                # Decode as UTF-8 if possible
                try:
                    value = value.decode('utf-8').strip()
                except UnicodeDecodeError:
                    value = value.hex()
                print(f"{name}: {value}")
            except Exception as e:
                print(f"{name}: Could not read ({e})")

asyncio.run(read_device_info())
