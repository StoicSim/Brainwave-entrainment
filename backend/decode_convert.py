import asyncio
import struct
from bleak import BleakClient
from collections import deque
import numpy as np
from datetime import datetime

DEVICE_ADDRESS = "34:81:F4:33:AE:91"
NOTIFY_UUIDS = [
    "49535343-aca3-481c-91ec-d85e28a60318",
    "49535343-1e4d-4bd9-ba61-23c647249616",
    "49535343-026e-3a9b-954c-97daef17e26e"
]

SAMPLE_RATE = 512  # Hz
BUFFER_SIZE = SAMPLE_RATE * 2
signal_buffer = deque(maxlen=BUFFER_SIZE)

def extract_raw_values(data: bytes):
    """Extract all 16-bit signed EEG raw samples from ThinkGear-like packets."""
    raw_values = []
    i = 0
    while i < len(data) - 7:
        if data[i:i+5] == b'\xAA\xAA\x04\x80\x02':
            if i + 7 <= len(data):
                val = struct.unpack('>h', data[i+5:i+7])[0]
                raw_values.append(val)
                i += 7
            else:
                break
        else:
            i += 1
    return raw_values

def compute_band_powers(samples, fs=SAMPLE_RATE):
    """Compute Delta, Theta, Alpha, Beta, Gamma power from EEG signal."""
    if len(samples) < fs:
        return None

    signal = np.array(samples[-fs:]) - np.mean(samples[-fs:])
    freqs = np.fft.rfftfreq(len(signal), 1/fs)
    fft_vals = np.abs(np.fft.rfft(signal)) ** 2

    def band_power(low, high):
        idx = np.where((freqs >= low) & (freqs <= high))
        return np.mean(fft_vals[idx])

    bands = {
        'Delta': band_power(0.5, 4),
        'Theta': band_power(4, 8),
        'Alpha': band_power(8, 13),
        'Beta': band_power(13, 30),
        'Gamma': band_power(30, 45)
    }
    total = sum(bands.values())
    rel = {k: v / total for k, v in bands.items()} if total > 0 else bands
    return rel

def compute_attention_meditation(bands):
    """Approximate NeuroSky-style attention and meditation."""
    eps = 1e-6
    beta = bands.get('Beta', 0)
    alpha = bands.get('Alpha', 0)
    theta = bands.get('Theta', 0)

    attention = 100 * beta / (alpha + theta + eps)
    meditation = 100 * (alpha + theta) / (beta + eps)

    # Normalize range to 0–100
    attention = max(0, min(100, attention))
    meditation = max(0, min(100, meditation))
    return round(attention, 1), round(meditation, 1)

def handle_notify(sender, payload):
    raw_vals = extract_raw_values(payload)
    if not raw_vals:
        return

    signal_buffer.extend(raw_vals)
    bands = compute_band_powers(list(signal_buffer))
    if bands:
        attention, meditation = compute_attention_meditation(bands)
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"\n[{timestamp}] Brainwave Analysis:")
        for k, v in bands.items():
            print(f"  {k:<6}: {v:.3f}")
        print(f"  Attention : {attention}")
        print(f"  Meditation: {meditation}")
        print("-" * 40)

async def stream_eeg_with_metrics():
    async with BleakClient(DEVICE_ADDRESS) as client:
        print("Connecting...")
        if not client.is_connected:
            print(" Failed to connect.")
            return
        print(" Connected! Streaming EEG data...")

        for uuid in NOTIFY_UUIDS:
            try:
                await client.start_notify(uuid, handle_notify)
            except Exception as e:
                print(f" Could not subscribe to {uuid}: {e}")

        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print("Stopping stream...")
            for uuid in NOTIFY_UUIDS:
                await client.stop_notify(uuid)
            print(" Stream stopped.")

asyncio.run(stream_eeg_with_metrics())
