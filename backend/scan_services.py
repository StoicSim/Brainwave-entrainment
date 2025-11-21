import asyncio
from bleak import BleakClient

DEVICE_ADDRESS = "34:81:F4:33:AE:91"  # your MA900 headband MAC

async def list_services():
    async with BleakClient(DEVICE_ADDRESS) as client:
        connected = client.is_connected  # <- property, no ()
        print(f"Connected: {connected}\n")
        
        print("Listing all services and characteristics:")
        for service in client.services:
            print(f"Service: {service.uuid} | {service.description}")
            for char in service.characteristics:
                print(f"  Characteristic: {char.uuid} | Properties: {char.properties}")

asyncio.run(list_services())
