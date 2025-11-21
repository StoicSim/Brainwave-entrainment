import asyncio
from bleak import BleakClient

DEVICE_ADDRESS = "34:81:F4:33:AE:91"  # MA900 MAC

# Replace this with the notify characteristic UUID that sends EEG
EEG_NOTIFY_UUID = "49535343-aca3-481c-91ec-d85e28a60318"

def handle_eeg(sender, data):
    # data is a bytearray from the headband
    print(f"Raw EEG data from {sender}: {data}")

async def stream_eeg():
    async with BleakClient(DEVICE_ADDRESS) as client:
        print("Connecting...")
        if client.is_connected:
            print("Connected! Streaming EEG data...\n")
            await client.start_notify(EEG_NOTIFY_UUID, handle_eeg)
            
            # Keep streaming for 60 seconds (adjust as needed)
            await asyncio.sleep(60)
            
            await client.stop_notify(EEG_NOTIFY_UUID)
            print("Stopped streaming.")
        else:
            print("Failed to connect.")

asyncio.run(stream_eeg())
