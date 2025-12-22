import asyncio
from bleak import BleakClient
import struct
from datetime import datetime
from collections import deque
import matplotlib
matplotlib.use("QtAgg")
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import threading
from scipy.signal import butter, lfilter

DEVICE_ADDRESS = "34:81:F4:33:AD:FC"
NOTIFY_UUIDS = [
    "49535343-1e4d-4bd9-ba61-23c647249616"
]

THINKGEAR_BUFFER = bytearray()
SYNC = 0xAA

MAX_POINTS = 300
band_buffers = {band: deque(maxlen=MAX_POINTS) for band in
                ['Delta', 'Theta', 'Alpha Low', 'Alpha High',
                 'Beta Low', 'Beta High', 'Gamma Low', 'Gamma High']}
raw_buffer = deque(maxlen=1000)

def unpack_3byte_unsigned(data_bytes):
    padded_data = b'\x00' + bytes(data_bytes)
    return struct.unpack('>I', padded_data)[0]

def parse_and_decode_stream(new_payload: bytearray):
    global THINKGEAR_BUFFER
    THINKGEAR_BUFFER.extend(new_payload)

    MIN_PACKET_LENGTH = 4

    while len(THINKGEAR_BUFFER) >= MIN_PACKET_LENGTH:
        try:
            while THINKGEAR_BUFFER[0] != SYNC:
                THINKGEAR_BUFFER.pop(0)
            if THINKGEAR_BUFFER[1] != SYNC:
                THINKGEAR_BUFFER.pop(0)
                continue
        except IndexError:
            break

        if len(THINKGEAR_BUFFER) < 3:
            break

        p_length = THINKGEAR_BUFFER[2]
        total_packet_length = 3 + p_length + 1

        if len(THINKGEAR_BUFFER) < total_packet_length:
            break

        packet = THINKGEAR_BUFFER[:total_packet_length]
        THINKGEAR_BUFFER = THINKGEAR_BUFFER[total_packet_length:]

        p_data = packet[3:3 + p_length]

        received_checksum = packet[-1]
        calculated_checksum = 0xFF - (sum(p_data) & 0xFF)
        checksum_valid = (calculated_checksum == received_checksum)

        parsed_values = {'CHECKSUM_VALID': checksum_valid}

        if not checksum_valid:
            print(f"\n❌ Checksum FAILED for Packet: {packet.hex()} - Discarding corrupted data.")
            continue

        i = 0
        while i < len(p_data):
            code = p_data[i]
            i += 1

            if code == 0x80:
                if i + 3 > len(p_data) or p_data[i] != 0x02:
                    break
                i += 1
                raw_val = int.from_bytes(p_data[i:i+2], 'big', signed=True)
                i += 2
                parsed_values['RAW_EEG'] = raw_val
                raw_buffer.append(raw_val)

            elif code == 0x83:
                if i + 25 > len(p_data) or p_data[i] != 0x18:
                    break
                i += 1
                bands = ['Delta', 'Theta', 'Alpha Low', 'Alpha High',
                         'Beta Low', 'Beta High', 'Gamma Low', 'Gamma High']
                power_values = {}
                for band_name in bands:
                    power = unpack_3byte_unsigned(p_data[i:i+3])
                    power_values[band_name] = power
                    band_buffers[band_name].append(power)
                    i += 3
                parsed_values['BRAIN_WAVE_POWERS'] = power_values

            elif code == 0x02:
                if i + 1 > len(p_data):
                    break
                parsed_values['POOR_SIGNAL'] = p_data[i]
                i += 1

            elif code == 0x04:
                if i + 1 > len(p_data):
                    break
                parsed_values['ATTENTION'] = p_data[i]
                i += 1

            elif code == 0x05:
                if i + 1 > len(p_data):
                    break
                parsed_values['MEDITATION'] = p_data[i]
                i += 1

            else:
                if code < 0x80:
                    i += 1
                else:
                    try:
                        vlen = p_data[i]
                        i += 1 + vlen
                    except IndexError:
                        break

        if ('ATTENTION' in parsed_values or
            'MEDITATION' in parsed_values or
            'BRAIN_WAVE_POWERS' in parsed_values or
            (parsed_values.get('POOR_SIGNAL', 0) > 0)):
            
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] ✅ PROCESSED METRIC PACKET ({p_length} bytes)")

            signal = parsed_values.get('POOR_SIGNAL', 0)
            if signal > 0:
                print(f"  | ⚠️ Signal Quality: **{signal}** (0=Good, >0=Poor)")
            else:
                print(f"  | Signal Quality: **{signal}** (Good)")

            if 'ATTENTION' in parsed_values:
                print(f"  | **ATTENTION:** {parsed_values['ATTENTION']}")
            if 'MEDITATION' in parsed_values:
                print(f"  | **MEDITATION:** {parsed_values['MEDITATION']}")

            if 'BRAIN_WAVE_POWERS' in parsed_values:
                print("  | **BRAIN WAVE POWERS:**")
                for band, power in parsed_values['BRAIN_WAVE_POWERS'].items():
                    print(f"  |   {band}: {power}")

def handle_notify(sender, payload):
    parse_and_decode_stream(bytearray(payload))

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
    fs = 512
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

    filtered_bands = ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma']
    filt_axes = axs.flat[8:]
    filt_lines = {}
    for ax, band in zip(filt_axes, filtered_bands):
        ax.set_title(f"Filtered EEG: {band}")
        ax.set_ylim(-5000, 5000)
        ax.set_xlim(0, MAX_POINTS)
        line, = ax.plot([], [], lw=1)
        filt_lines[band] = line

    filt_buffers = {band: deque(maxlen=MAX_POINTS) for band in filtered_bands}

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

    anim = FuncAnimation(fig, animate, interval=50, cache_frame_data=False)
    plt.tight_layout()
    plt.show()

async def ble_task():
    async with BleakClient(DEVICE_ADDRESS) as client:
        print("Connecting...")
        if not client.is_connected:
            print("❌ Failed to connect")
            return

        print("✅ Connected. Subscribing to the active UUID...")
        for uuid in NOTIFY_UUIDS:
            try:
                await client.start_notify(uuid, handle_notify)
                print(f"  | Subscribed to {uuid}")
            except Exception as e:
                print(f"⚠️ Could not subscribe to {uuid}: {e}")

        print("\nStreaming and filtering for Attention, Meditation, and Band Power metrics...")
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print("\nStopping notifications...")
            for uuid in NOTIFY_UUIDS:
                try:
                    await client.stop_notify(uuid)
                except Exception:
                    pass
            print("✅ Stopped gracefully.")

if __name__ == "__main__":
    ble_thread = threading.Thread(target=lambda: asyncio.run(ble_task()), daemon=True)
    ble_thread.start()
    start_live_plot()
