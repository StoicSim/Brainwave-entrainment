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
from scipy.signal import butter, lfilter, iirnotch, filtfilt
import numpy as np
import csv
import os
import uuid
import signal
import sys

DEVICE_ADDRESS = "34:81:F4:33:AE:91"
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

def clear_buffers():
    """Clear all buffers when switching phases"""
    global THINKGEAR_BUFFER
    THINKGEAR_BUFFER.clear()
    raw_buffer.clear()
    for band in band_buffers:
        band_buffers[band].clear()
    print("🔄 Buffers cleared for phase transition")

# CSV recording variables
csv_file = None
csv_writer = None
csv_filepath = None
session_id = None
user_name = None
user_age = None
user_iaf = None
personality_scores = {}
session_type = None  # Current phase: "music" or "no_music"
music_link = None    # Current music link
recording_started = False

# Session control
session_active = True
action_requested = None  # 'save', 'discard', 'continue', or None

# Latest values for CSV writing
latest_attention = None
latest_meditation = None
latest_signal_quality = 0

def unpack_3byte_unsigned(data_bytes):
    padded_data = b'\x00' + bytes(data_bytes)
    return struct.unpack('>I', padded_data)[0]

def compute_power_spectrum(signal, fs=512):
    """
    Compute power spectrum exactly like React Native EEGProcessor.js
    Steps: Detrend → Notch Filter (50Hz) → Hamming Window → FFT → Power Calculation
    """
    N = len(signal)
    
    if N < 512:
        return None, None, None
    
    # 1. Detrend - remove DC offset (mean)
    signal_array = np.array(signal)
    signal_detrended = signal_array - np.mean(signal_array)
    
    # 2. Notch filter at 50 Hz (remove line noise)
    b, a = iirnotch(50, Q=30, fs=fs)
    signal_notched = filtfilt(b, a, signal_detrended)
    
    # 3. Apply Hamming window to reduce spectral leakage
    window = np.hamming(N)
    signal_windowed = signal_notched * window
    
    # 4. Compute FFT
    fft_result = np.fft.fft(signal_windowed)
    
    # 5. Calculate power spectrum (matching React Native formula)
    # Power = (real² + imag²) / N²
    # Only take first half (positive frequencies)
    half_n = N // 2
    frequencies = np.fft.fftfreq(N, 1/fs)[:half_n]
    
    # Power spectrum calculation
    power_spectrum = (np.abs(fft_result[:half_n]) ** 2) / (N * N)
    
    # 6. Extract power spectrum at 6-14 Hz (find nearest bin for each integer Hz)
    ps_6_14 = {}
    for target_freq in range(6, 15):  # 6 to 14 Hz inclusive
        # Find nearest frequency bin
        idx = np.argmin(np.abs(frequencies - target_freq))
        ps_6_14[f'PSD_{target_freq}Hz'] = power_spectrum[idx]
    
    return frequencies, power_spectrum, ps_6_14

def initialize_csv():
    global csv_file, csv_writer, csv_filepath, recording_started
    
    # Create base folder
    base_path = "EEG_Data"
    os.makedirs(base_path, exist_ok=True)
    
    # Create filename matching React Native format: name_sessionid.csv
    filename = f"{user_name}_{session_id}.csv"
    csv_filepath = os.path.join(base_path, filename)
    
    # Open CSV file
    csv_file = open(csv_filepath, 'w', newline='')
    csv_writer = csv.writer(csv_file)
    
    # Write header matching React Native format
    header = [
        "Timestamp", "Session_ID", "Name", "Age", "IAF",
        "Openness", "Conscientiousness", "Extraversion", "Agreeableness", "Neuroticism",
        "Session_Type", "Music_Link", "Signal_Quality", "Attention", "Meditation",
        "Delta", "Theta", "Alpha_Low", "Alpha_High",
        "Beta_Low", "Beta_High", "Gamma_Low", "Gamma_High",
        "PSD_6Hz", "PSD_7Hz", "PSD_8Hz", "PSD_9Hz", "PSD_10Hz", 
        "PSD_11Hz", "PSD_12Hz", "PSD_13Hz", "PSD_14Hz"
    ]
    csv_writer.writerow(header)
    
    recording_started = True
    print(f"\n✓ CSV recording started: {csv_filepath}\n")
    return csv_filepath

def close_csv():
    global csv_file, csv_writer
    if csv_file:
        csv_file.close()
        print(f"✅ CSV file saved: {csv_filepath}")
    csv_file = None
    csv_writer = None

def discard_csv():
    global csv_file, csv_writer, csv_filepath, recording_started
    if csv_file:
        csv_file.close()
    if csv_filepath and os.path.exists(csv_filepath):
        os.remove(csv_filepath)
        print(f"🗑️  Recording discarded: {csv_filepath}")
    csv_file = None
    csv_writer = None
    recording_started = False

def write_to_csv(timestamp, bands, ps_6_14, attention=None, meditation=None, signal_quality=0):
    if csv_writer is None:
        return
    
    row = [
        timestamp,  # ISO 8601 format
        session_id,
        user_name,
        user_age,
        user_iaf,
        personality_scores.get('openness', 0),
        personality_scores.get('conscientiousness', 0),
        personality_scores.get('extraversion', 0),
        personality_scores.get('agreeableness', 0),
        personality_scores.get('neuroticism', 0),
        session_type,  # Current phase type
        music_link if music_link else '',  # Current music link
        signal_quality,
        attention if attention is not None else '',
        meditation if meditation is not None else '',
        bands.get('Delta', ''),
        bands.get('Theta', ''),
        bands.get('Alpha Low', ''),
        bands.get('Alpha High', ''),
        bands.get('Beta Low', ''),
        bands.get('Beta High', ''),
        bands.get('Gamma Low', ''),
        bands.get('Gamma High', ''),
        ps_6_14.get('PSD_6Hz', '') if ps_6_14 else '',
        ps_6_14.get('PSD_7Hz', '') if ps_6_14 else '',
        ps_6_14.get('PSD_8Hz', '') if ps_6_14 else '',
        ps_6_14.get('PSD_9Hz', '') if ps_6_14 else '',
        ps_6_14.get('PSD_10Hz', '') if ps_6_14 else '',
        ps_6_14.get('PSD_11Hz', '') if ps_6_14 else '',
        ps_6_14.get('PSD_12Hz', '') if ps_6_14 else '',
        ps_6_14.get('PSD_13Hz', '') if ps_6_14 else '',
        ps_6_14.get('PSD_14Hz', '') if ps_6_14 else '',
    ]
    csv_writer.writerow(row)
    csv_file.flush()  # Ensure data is written immediately

def parse_and_decode_stream(new_payload: bytearray):
    global THINKGEAR_BUFFER, latest_attention, latest_meditation, latest_signal_quality
    
    if not session_active:
        return  # Don't process if session is paused
    
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
            # Silently discard corrupted packets during transitions
            if session_active:
                print(f"\n⚠️  Checksum mismatch - discarding packet")
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
                latest_signal_quality = p_data[i]
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
            
            # ISO 8601 timestamp
            timestamp = datetime.now().isoformat()
            
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
                
                # Compute power spectrum from raw buffer
                ps_6_14 = None
                if len(raw_buffer) >= 512:
                    _, _, ps_6_14 = compute_power_spectrum(list(raw_buffer))
                    if ps_6_14:
                        print("  | **POWER SPECTRUM (6-14 Hz):**")
                        for freq_label, power in ps_6_14.items():
                            print(f"  |   {freq_label}: {power:.4e}")
                
                # Initialize CSV on first band data
                if not recording_started:
                    initialize_csv()
                
                # Write to CSV with all data
                write_to_csv(
                    timestamp, 
                    parsed_values['BRAIN_WAVE_POWERS'],
                    ps_6_14,
                    latest_attention,
                    latest_meditation,
                    latest_signal_quality
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
    global session_active
    fs = 512
    fig, axs = plt.subplots(6, 2, figsize=(14, 12))
    
    # Update title based on current phase
    title_text = f"Real-Time EEG Data - Session: {session_type.upper()}"
    if music_link:
        title_text += f" | Music: {music_link[:30]}..."
    fig.suptitle(title_text)

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
        if not session_active:
            return list(lines.values()) + list(filt_lines.values())
        
        # Update title dynamically
        title_text = f"Real-Time EEG Data - Session: {session_type.upper()}"
        if music_link:
            title_text += f" | Music: {music_link[:30]}..."
        fig.suptitle(title_text)
            
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
    global session_active
    
    try:
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

            print(f"\n📊 Recording {session_type.upper()} phase...")
            if music_link:
                print(f"🎵 Music: {music_link}")
            print("💡 Press Ctrl+C to pause and choose next action\n")
            
            try:
                while session_active:
                    await asyncio.sleep(0.1)
            except KeyboardInterrupt:
                pass
            finally:
                print("\n⏸️  Pausing recording...")
                for uuid in NOTIFY_UUIDS:
                    try:
                        await client.stop_notify(uuid)
                    except Exception:
                        pass
                        
    except Exception as e:
        print(f"\n❌ BLE Error: {e}")
        session_active = False

def get_initial_session_info():
    """Get user information and initial session configuration"""
    global session_id, user_name, user_age, user_iaf, personality_scores, session_type, music_link
    
    print("\n" + "="*60)
    print(" "*15 + "EEG RECORDING SESSION SETUP")
    print("="*60 + "\n")
    
    # Generate session ID (once for entire session)
    session_id = f"session_{int(datetime.now().timestamp() * 1000)}"
    print(f"📝 Session ID: {session_id}\n")
    
    # Required user info
    user_name = input("Enter name: ").strip() or "unknown"
    user_age = input("Enter age: ").strip() or "unknown"
    
    # Optional fields
    print("\n--- Optional Fields (press Enter to skip) ---")
    user_iaf = input("IAF (Hz): ").strip() or "N/A"
    
    o = input("Openness (0-5): ").strip()
    c = input("Conscientiousness (0-5): ").strip()
    e = input("Extraversion (0-5): ").strip()
    a = input("Agreeableness (0-5): ").strip()
    n = input("Neuroticism (0-5): ").strip()
    
    personality_scores = {
        'openness': int(o) if o else 0,
        'conscientiousness': int(c) if c else 0,
        'extraversion': int(e) if e else 0,
        'agreeableness': int(a) if a else 0,
        'neuroticism': int(n) if n else 0,
    }
    
    # Initial phase configuration
    print("\n" + "="*60)
    print("INITIAL RECORDING PHASE")
    print("="*60)
    print("\nWhat type of session do you want to start with?")
    print("  1. No Music (baseline)")
    print("  2. Music")
    
    while True:
        choice = input("\nEnter choice (1/2): ").strip()
        if choice == '1':
            session_type = "no_music"
            music_link = None
            break
        elif choice == '2':
            session_type = "music"
            music_link = input("Enter music link/name: ").strip() or "No link provided"
            break
        else:
            print("Invalid choice. Please enter 1 or 2.")
    
    print("\n" + "="*60)
    print("✅ Session configured successfully!")
    print(f"📁 Filename: {user_name}_{session_id}.csv")
    print(f"📂 Location: EEG_Data/")
    print(f"🎯 Starting phase: {session_type.upper()}")
    if music_link:
        print(f"🎵 Music: {music_link}")
    print("="*60 + "\n")

def session_control_menu():
    """Display menu when user presses Ctrl+C"""
    global action_requested
    
    print("\n\n" + "="*60)
    print(" "*20 + "SESSION PAUSED")
    print("="*60)
    print("\nWhat would you like to do?")
    print("  1. 💾 Save and exit (finish recording)")
    print("  2. 🗑️  Discard and exit (delete recording)")
    print("  3. ▶️  Continue session (change music/no-music settings)")
    print("  4. ↩️  Resume current phase (no changes)")
    print("="*60)
    
    while True:
        choice = input("\nEnter choice (1/2/3/4): ").strip()
        if choice == '1':
            action_requested = 'save'
            return
        elif choice == '2':
            action_requested = 'discard'
            return
        elif choice == '3':
            action_requested = 'continue'
            return
        elif choice == '4':
            action_requested = 'resume'
            return
        else:
            print("Invalid choice. Please enter 1, 2, 3, or 4.")

def configure_next_phase():
    """Configure the next recording phase"""
    global session_type, music_link
    
    print("\n" + "="*60)
    print("CONFIGURE NEXT PHASE")
    print("="*60)
    print("\nWhat would you like to record next?")
    print("  1. No Music")
    print("  2. Music (new or different)")
    
    while True:
        choice = input("\nEnter choice (1/2): ").strip()
        if choice == '1':
            session_type = "no_music"
            music_link = None
            print("\n✅ Switching to NO MUSIC phase")
            clear_buffers()  # Clear buffers for clean transition
            break
        elif choice == '2':
            session_type = "music"
            music_link = input("Enter music link/name: ").strip() or "No link provided"
            print(f"\n✅ Switching to MUSIC phase: {music_link}")
            clear_buffers()  # Clear buffers for clean transition
            break
        else:
            print("Invalid choice. Please enter 1 or 2.")
    
    print("="*60 + "\n")
    print("⏳ Waiting 2 seconds before resuming...")
    import time
    time.sleep(2)  # Give BLE a moment to stabilize

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    global session_active
    
    if not session_active:
        return
    
    session_active = False

if __name__ == "__main__":
    # Set up signal handler for Ctrl+C
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        # Get initial session information
        get_initial_session_info()
        
        # Main recording loop
        while True:
            session_active = True
            action_requested = None
            
            # Start BLE thread
            ble_thread = threading.Thread(target=lambda: asyncio.run(ble_task()), daemon=True)
            ble_thread.start()
            
            # Start live plotting (blocks until Ctrl+C)
            start_live_plot()
            
            # User pressed Ctrl+C - show menu
            session_control_menu()
            
            # Handle user choice
            if action_requested == 'save':
                close_csv()
                print("\n✅ Recording saved successfully!")
                break
                
            elif action_requested == 'discard':
                discard_csv()
                print("\n🗑️  Recording discarded.")
                break
                
            elif action_requested == 'continue':
                print("\n↻ Continuing session with new phase...")
                clear_buffers()  # Clear buffers before reconfiguring
                configure_next_phase()
                # Loop continues with new configuration
                
            elif action_requested == 'resume':
                print("\n↻ Resuming current phase...")
                clear_buffers()  # Clear buffers for clean resume
                # Loop continues with same configuration
                
    except Exception as e:
        print(f"\n❌ Error: {e}")
        if csv_file:
            close_csv()
    finally:
        print("\n" + "="*60)
        print(" "*15 + "SESSION ENDED")
        print("="*60)