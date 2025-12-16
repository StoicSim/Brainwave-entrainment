import asyncio
from bleak import BleakClient

DEVICE_ADDRESS = "34:81:F4:33:AD:FC"  # Replace if needed

NOTIFY_UUIDS = [
    "49535343-aca3-481c-91ec-d85e28a60318",
    "49535343-1e4d-4bd9-ba61-23c647249616",
    "49535343-026e-3a9b-954c-97daef17e26e"
]

def handle_notify(sender, data):
    print(f"\nFrom {sender}: {data}")

async def test_all_notifications():
    async with BleakClient(DEVICE_ADDRESS) as client:
        print("Connecting...")
        if not client.is_connected:
            print("Failed to connect.")
            return
        
        print("Connected! Testing each notify characteristic...\n")

        for uuid in NOTIFY_UUIDS:
            print(f"Subscribing to {uuid} for 10 seconds...")
            await client.start_notify(uuid, handle_notify)
            await asyncio.sleep(3)
            await client.stop_notify(uuid)
            print(f"Stopped {uuid}\n")

        print("Done testing all notify characteristics.")

asyncio.run(test_all_notifications())
