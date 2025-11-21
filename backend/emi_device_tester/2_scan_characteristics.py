import asyncio
from bleak import BleakScanner, BleakClient

TARGET_ADDR = "34:81:F4:33:AE:91"

async def inspect_services():
    print("Searching for device...")

    device = await BleakScanner.find_device_by_address(TARGET_ADDR, timeout=15)

    if device is None:
        print("❌ Device not found during search")
        return

    print(f"Found: {device.address} ({device.name})")

    print("Connecting...")
    client = BleakClient(device)

    try:
        await client.connect(timeout=10)
        print("✅ Connected!")

        services = client.services  # New bleak API
        for service in services:
            print(f"🔵 Service: {service.uuid}")
            for char in service.characteristics:
                print(f"   🟢 Char: {char.uuid} | {char.properties}")

    except Exception as e:
        print("❌ Error:", e)

    finally:
        await client.disconnect()
        print("Disconnected.")

asyncio.run(inspect_services())
