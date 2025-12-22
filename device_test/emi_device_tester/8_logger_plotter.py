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
import csv
import os
import uuid

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

# CSV recording variables
csv_file = None
csv_writer = None
session_id = None
session_name = None
duration_minutes = None
music_involved = None
music_link = None
recording_started = False

# Latest values for CSV writing
latest_attention = None
latest_meditation = None

def unpack_3byte_unsigned(data_bytes):
    padded_data = b'\x00' + bytes(data_bytes)
    return struct.unpack('>I', padded_data)[0]

def initialize_csv():
    global csv_file, csv_writer, recording_started
    
    # Create folder structure
    folder = "with_music" if music_involved else "no_music"
    base_path = os.path.join("EEG_Data", folder)
    os.makedirs(base_path, exist_ok=True)
    
    # Create filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{session_name}_{timestamp}.csv"
    filepath = os.path.join(base_path, filename)
    
    # Open CSV file
    csv_file = open(filepath, 'w', newline='')
    csv_writer = csv.writer(csv_file)
    
    # Write header
    header = [
        "session_id", "timestamp", "session_name", "duration_minutes",
        "music_involved", "music_link",
        "Delta", "Theta", "AlphaLow", "AlphaHigh",
        "BetaLow", "BetaHigh", "GammaLow", "GammaHigh",
        "Attention", "Meditation"
    ]
    csv_writer.writerow(header)
    
    recording_started = True
    print(f"\n✓ CSV recording started: {filepath}\n")

def write_to_csv(timestamp, bands, attention=None, meditation=None):
    if csv_writer is None:
        return
    
    row = [
        session_id,
        timestamp,
        session_name,
        duration_minutes,
        "yes" if music_involved else "no",
        music_link if music_link else "",
        bands.get('Delta', ''),
        bands.get('Theta', ''),
        bands.get('Alpha Low', ''),
        bands.get('Alpha High', ''),
        bands.get('Beta Low', ''),
        bands.get('Beta High', ''),
        bands.get('Gamma Low', ''),
        bands.get('Gamma High', ''),
        attention if attention is not None else '',
        meditation if meditation is not None else ''
    ]
    csv_writer.writerow(row)
    csv_file.flush()  # Ensure data is written immediately

def parse_and_decode_stream(new_payload: bytearray):
    global THINKGEAR_BUFFER, latest_attention, latest_meditation
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
                latest_attention = p_data[i]
                i += 1

            elif code == 0x05:
                if i + 1 > len(p_data):
                    break
                parsed_values['MEDITATION'] = p_data[i]
                latest_meditation = p_data[i]
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
            
            timestamp = datetime.now().strftime('%H:%M:%S')
            print(f"\n[{timestamp}] ✅ PROCESSED METRIC PACKET ({p_length} bytes)")

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
                
                # Initialize CSV on first band data
                if not recording_started:
                    initialize_csv()
                
                # Write to CSV with latest attention/meditation values
                write_to_csv(
                    timestamp, 
                    parsed_values['BRAIN_WAVE_POWERS'],
                    latest_attention,
                    latest_meditation
                )

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

def get_session_info():
    global session_id, session_name, duration_minutes, music_involved, music_link
    
    print("\n" + "="*50)
    print("EEG Recording Session Setup")
    print("="*50 + "\n")
    
    # Generate session ID
    session_id = str(uuid.uuid4())[:8]
    print(f"Session ID: {session_id}\n")
    
    # Get session details
    session_name = input("Enter session name: ").strip()
    duration_minutes = input("Enter duration (minutes): ").strip()
    
    music_input = input("Music involved? (yes/no): ").strip().lower()
    music_involved = music_input in ['yes', 'y']
    
    if music_involved:
        music_link = input("Enter music link: ").strip()
    else:
        music_link = None
    
    print("\n" + "="*50)
    print("Session configured successfully!")
    print("="*50 + "\n")

if __name__ == "__main__":
    try:
        # Get session information
        get_session_info()
        
        # Start BLE thread
        ble_thread = threading.Thread(target=lambda: asyncio.run(ble_task()), daemon=True)
        ble_thread.start()
        
        # Start live plotting
        start_live_plot()
        
    except KeyboardInterrupt:
        print("\n\nRecording stopped by user.")
    finally:
        # Close CSV file
        if csv_file:
            csv_file.close()
            print("CSV file saved successfully.")