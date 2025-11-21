import asyncio
from bleak import BleakScanner

async def scan():
    print("Scanning for BLE devices...\n")
    devices = await BleakScanner.discover(timeout=10)
    for d in devices:
        print(d.name, d.address)

asyncio.run(scan())
