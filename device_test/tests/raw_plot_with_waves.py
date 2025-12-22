import asyncio
from bleak import BleakClient
from datetime import datetime
from collections import deque
import matplotlib
matplotlib.use("QtAgg")  # Must be before pyplot
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import threading
import time

# -----------------------------
# BLE CONFIG
# -----------------------------
DEVICE_ADDRESS = "34:81:F4:33:AE:91"  # Replace with your device MAC

NOTIFY_UUIDS = [
    "49535343-aca3-481c-91ec-d85e28a60318",
    "49535343-1e4d-4bd9-ba61-23c647249616",
    "49535343-026e-3a9b-954c-97daef17e26e"
]

SYNC_BYTES = b'\xAA\xAA'
CODE_LENGTHS = {
    0x02: 1,  # Poor signal
    0x04: 1,  # Attention
    0x05: 1,  # Meditation
    0x80: 2,  # Raw EEG
    0x83: 24, # EEG band powers
}

BUFFER = bytearray()

# -----------------------------
# DATA BUFFERS
# -----------------------------
MAX_POINTS = 300
time_buffer = deque(maxlen=MAX_POINTS)
band_buffers = {band: deque(maxlen=MAX_POINTS) for band in
                ['Delta','Theta','AlphaLow','AlphaHigh','BetaLow','BetaHigh','GammaLow','GammaHigh']}
raw_buffer = deque(maxlen=1000)  # Raw EEG scrolling window

# -----------------------------
# THINKGEAR PARSER
# -----------------------------
def parse_thinkgear_stream(data):
    global BUFFER
    BUFFER.extend(data)
    i = 0
    results = []

    while i < len(BUFFER) - 2:
        if BUFFER[i:i+2] != SYNC_BYTES:
            i += 1
            continue

        if i + 4 > len(BUFFER):
            break

        payload_len = BUFFER[i+2]
        packet_end = i + 3 + payload_len + 1

        if packet_end > len(BUFFER):
            break

        packet = BUFFER[i:packet_end]
        payload = packet[3:-1]
        checksum = packet[-1]

        calc_checksum = 0xFF - (sum(payload) & 0xFF)
        valid_checksum = (calc_checksum == checksum)

        j = 0
        parsed_values = {}

        while j < len(payload):
            code = payload[j]; j += 1
            length = CODE_LENGTHS.get(code)
            if length is None:
                j += 1
                continue
            if j + length > len(payload):
                break
            val_bytes = payload[j:j+length]
            j += length

            if code == 0x02:
                parsed_values["PoorSignal"] = val_bytes[0]
            elif code == 0x04:
                parsed_values["Attention"] = val_bytes[0]
            elif code == 0x05:
                parsed_values["Meditation"] = val_bytes[0]
            elif code == 0x80:
                parsed_values["RawEEG"] = int.from_bytes(val_bytes, 'big', signed=True)
            elif code == 0x83:
                bands = ['Delta','Theta','AlphaLow','AlphaHigh','BetaLow','BetaHigh','GammaLow','GammaHigh']
                powers = {}
                for k, band in enumerate(bands):
                    start = k*3
                    powers[band] = int.from_bytes(val_bytes[start:start+3], 'big')
                parsed_values["EEG_Bands"] = powers

        timestamp = datetime.now().strftime("%H:%M:%S")
        results.append({
            "timestamp": timestamp,
            "parsed": parsed_values,
            "checksum_valid": valid_checksum
        })

        i = packet_end

    BUFFER = BUFFER[i:]
    return results

# -----------------------------
# BLE NOTIFY HANDLER
# -----------------------------
def handle_notify(sender, data):
    packets = parse_thinkgear_stream(data)
    for p in packets:
        # Update band buffers
        if "EEG_Bands" in p["parsed"]:
            t = time.time()
            time_buffer.append(t)
            band_dict = p["parsed"]["EEG_Bands"]
            for band, val in band_dict.items():
                band_buffers[band].append(val)
            # Console output
            print(f"[{p['timestamp']}] EEG Bands:", band_dict)

        # Update raw EEG buffer
        if "RawEEG" in p["parsed"]:
            raw_buffer.append(p["parsed"]["RawEEG"])
            print(f"[{p['timestamp']}] RawEEG:", p["parsed"]["RawEEG"])

# -----------------------------
# PLOT FUNCTION
# -----------------------------
def start_live_plot():
    fig, axs = plt.subplots(5, 2, figsize=(14, 10))
    fig.suptitle("Real-Time EEG Data")

    # 8-band plots
    axes = axs.flat[:8]
    lines = {}
    for ax, band in zip(axes, band_buffers.keys()):
        ax.set_title(band)
        ax.set_ylim(0, 500000)
        ax.set_xlim(0, MAX_POINTS)
        line, = ax.plot([], [], lw=1)
        lines[band] = line

    # Raw EEG subplot (last subplot)
    raw_ax = axs.flat[8]
    raw_ax.set_title("Raw EEG")
    raw_ax.set_ylim(-5000, 5000)  # adjust based on your EEG
    raw_ax.set_xlim(0, len(raw_buffer))
    raw_line, = raw_ax.plot([], [], lw=1, color='r')

    # Remove 10th subplot if exists
    if len(axs.flat) > 9:
        fig.delaxes(axs.flat[9])

    def animate(frame):
        # Update band lines
        if len(time_buffer) > 0:
            times = list(time_buffer)
            for band, line in lines.items():
                y = list(band_buffers[band])
                x = times[-len(y):]
                x = [t - times[0] for t in x]
                line.set_data(x, y)
                if y:
                    min_y = min(y)
                    max_y = max(y)
                    if max_y - min_y < 10:
                        max_y += 10
                        min_y -= 10
                    line.axes.set_ylim(min_y*0.9, max_y*1.1)
            for ax in axes:
                ax.relim()
                ax.autoscale_view()

        # Update raw EEG
        if len(raw_buffer) > 0:
            y = list(raw_buffer)
            x = list(range(len(y)))
            raw_line.set_data(x, y)
            if y:
                min_y = min(y)
                max_y = max(y)
                raw_line.axes.set_ylim(min_y*1.1, max_y*1.1)
            raw_ax.set_xlim(0, len(y))
        return list(lines.values()) + [raw_line]

    anim = FuncAnimation(fig, animate, interval=50)
    plt.tight_layout()
    plt.show()

# -----------------------------
# BLE ASYNC TASK
# -----------------------------
async def ble_task():
    async with BleakClient(DEVICE_ADDRESS) as client:
        print("Connected to device!")
        for uuid in NOTIFY_UUIDS:
            try:
                await client.start_notify(uuid, handle_notify)
                print(f"Subscribed: {uuid}")
            except Exception as e:
                print(f"Failed to subscribe {uuid}: {e}")
        while True:
            await asyncio.sleep(1)

# -----------------------------
# MAIN
# -----------------------------
if __name__ == "__main__":
    # Start BLE in background thread
    ble_thread = threading.Thread(target=lambda: asyncio.run(ble_task()), daemon=True)
    ble_thread.start()

    # Start plotting in main thread
    start_live_plot()
