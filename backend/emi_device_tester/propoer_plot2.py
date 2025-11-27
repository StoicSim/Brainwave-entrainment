import asyncio
from bleak import BleakClient
from datetime import datetime
from collections import deque
import matplotlib
matplotlib.use("QtAgg")  
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import threading
import time
from scipy.signal import butter, lfilter


DEVICE_ADDRESS = "34:81:F4:33:AE:91"  

NOTIFY_UUIDS = [
   
    "49535343-1e4d-4bd9-ba61-23c647249616",
   
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


MAX_POINTS = 300
band_buffers = {band: deque(maxlen=MAX_POINTS) for band in
                ['Delta','Theta','AlphaLow','AlphaHigh','BetaLow','BetaHigh','GammaLow','GammaHigh']}
raw_buffer = deque(maxlen=1000)  


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


def handle_notify(sender, data):
    packets = parse_thinkgear_stream(data)
    for p in packets:
       
        if "EEG_Bands" in p["parsed"]:
            band_dict = p["parsed"]["EEG_Bands"]
            for band, val in band_dict.items():
                band_buffers[band].append(val)
            print(f"[{p['timestamp']}] EEG Bands:", band_dict)

        
        if "RawEEG" in p["parsed"]:
            raw_buffer.append(p["parsed"]["RawEEG"])
            print(f"[{p['timestamp']}] RawEEG:", p["parsed"]["RawEEG"])


def butter_bandpass(lowcut, highcut, fs, order=4):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a

def bandpass_filter(data, lowcut, highcut, fs, order=4):
    b, a = butter_bandpass(lowcut, highcut, fs, order=order)
    return lfilter(b, a, data)


def start_live_plot():
    fs = 256 
    fig, axs = plt.subplots(6, 2, figsize=(14, 12))
    fig.suptitle("Real-Time EEG Data")

   
    axes = axs.flat[:8]
    lines = {}
    for ax, band in zip(axes, band_buffers.keys()):
        ax.set_title(f"Power: {band}")
        ax.set_ylim(0, 500000)
        ax.set_xlim(0, MAX_POINTS)
        line, = ax.plot([], [], lw=1)
        lines[band] = line

    
    filtered_bands = ['Delta','Theta','Alpha','Beta','Gamma']
    filt_axes = axs.flat[8:]
    filt_lines = {}
    for ax, band in zip(filt_axes, filtered_bands):
        ax.set_title(f"Filtered EEG: {band}")
        ax.set_ylim(-5000, 5000)
        ax.set_xlim(0, MAX_POINTS)
        line, = ax.plot([], [], lw=1)
        filt_lines[band] = line

   
    filt_buffers = {band: deque(maxlen=MAX_POINTS) for band in filtered_bands}

    # Animation
    def animate(frame):
       
        for band, line in lines.items():
            y = list(band_buffers[band])
            x = list(range(len(y)))  
            line.set_data(x, y)
            line.axes.set_xlim(0, MAX_POINTS)
            if y:
                min_y = min(y)
                max_y = max(y)
                line.axes.set_ylim(min_y*0.9, max_y*1.1)

        
        if len(raw_buffer) > 0:
            raw_data = list(raw_buffer)
            filt_buffers['Delta'].extend(bandpass_filter(raw_data, 0.5, 4, fs)[-len(raw_data):])
            filt_buffers['Theta'].extend(bandpass_filter(raw_data, 4, 8, fs)[-len(raw_data):])
            filt_buffers['Alpha'].extend(bandpass_filter(raw_data, 8, 13, fs)[-len(raw_data):])
            filt_buffers['Beta'].extend(bandpass_filter(raw_data, 13, 30, fs)[-len(raw_data):])
            filt_buffers['Gamma'].extend(bandpass_filter(raw_data, 30, 45, fs)[-len(raw_data):])

            for band, line in filt_lines.items():
                y = list(filt_buffers[band])
                x = list(range(len(y)))
                line.set_data(x, y)
                line.axes.set_xlim(0, MAX_POINTS)
                if y:
                    min_y = min(y)
                    max_y = max(y)
                    line.axes.set_ylim(min_y*1.1, max_y*1.1)

        return list(lines.values()) + list(filt_lines.values())

    anim = FuncAnimation(fig, animate, interval=50)
    plt.tight_layout()
    plt.show()


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


if __name__ == "__main__":
    
    ble_thread = threading.Thread(target=lambda: asyncio.run(ble_task()), daemon=True)
    ble_thread.start()

    
    start_live_plot()
