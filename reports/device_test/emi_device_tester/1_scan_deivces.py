from bleak import BleakScanner
import asyncio

async def scan():
    print("Scanning...")
    devices = await BleakScanner.discover(timeout=5)
    for d in devices:
        print(d)

asyncio.run(scan())
