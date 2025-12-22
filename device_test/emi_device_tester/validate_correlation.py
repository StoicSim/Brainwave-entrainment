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
import numpy as np
import csv
import os
import uuid

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

# CSV recording variables
csv_file = None
csv_writer = None
validation_csv_file = None
validation_csv_writer = None
session_id = None
session_name = None
duration_minutes = None
music_involved = None
music_link = None
recording_started = False

# Latest values for CSV writing
latest_attention = None
latest_meditation = None

# Validation tracking
validation_data = {
    'device_powers': {band: [] for band in ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma']},
    'computed_powers': {band: [] for band in ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma']},
    'timestamps': []
}
last_validation_time = None
VALIDATION_INTERVAL = 5  # seconds

def unpack_3byte_unsigned(data_bytes):
    padded_data = b'\x00' + bytes(data_bytes)
    return struct.unpack('>I', padded_data)[0]

def initialize_csv():
    global csv_file, csv_writer, validation_csv_file, validation_csv_writer, recording_started
    
    # Create folder structure
    folder = "with_music" if music_involved else "no_music"
    base_path = os.path.join("EEG_Data", folder)
    os.makedirs(base_path, exist_ok=True)
    
    # Create filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Main data CSV
    filename = f"{session_name}_{timestamp}.csv"
    filepath = os.path.join(base_path, filename)
    csv_file = open(filepath, 'w', newline='')
    csv_writer = csv.writer(csv_file)
    
    # Write header for main CSV
    header = [
        "session_id", "timestamp", "session_name", "duration_minutes",
        "music_involved", "music_link",
        "Delta", "Theta", "AlphaLow", "AlphaHigh",
        "BetaLow", "BetaHigh", "GammaLow", "GammaHigh",
        "Attention", "Meditation"
    ]
    csv_writer.writerow(header)
    
    # Validation CSV
    validation_filename = f"{session_name}_{timestamp}_validation.csv"
    validation_filepath = os.path.join(base_path, validation_filename)
    validation_csv_file = open(validation_filepath, 'w', newline='')
    validation_csv_writer = csv.writer(validation_csv_file)
    
    # Write header for validation CSV
    validation_header = [
        "session_id", "timestamp", "sample_number",
        "device_delta", "computed_delta", "delta_ratio",
        "device_theta", "computed_theta", "theta_ratio",
        "device_alpha", "computed_alpha", "alpha_ratio",
        "device_beta", "computed_beta", "beta_ratio",
        "device_gamma", "computed_gamma", "gamma_ratio"
    ]
    validation_csv_writer.writerow(validation_header)
    
    recording_started = True
    print(f"\n✓ Main CSV recording started: {filepath}")
    print(f"✓ Validation CSV started: {validation_filepath}\n")

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
    csv_file.flush()

def butter_bandpass(lowcut, highcut, fs, order=4):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a

def bandpass_filter(data, lowcut, highcut, fs, order=4):
    b, a = butter_bandpass(lowcut, highcut, fs, order=order)
    return lfilter(b, a, data)

def compute_power_from_raw(raw_segment, lowcut, highcut, fs=512):
    """Compute power by filtering and squaring raw EEG"""
    if len(raw_segment) < 100:  # Need minimum samples
        return 0
    
    try:
        filtered = bandpass_filter(raw_segment, lowcut, highcut, fs)
        power = np.mean(filtered ** 2)
        return power
    except:
        return 0

def validate_power_accuracy():
    """Compare device power with computed power from raw EEG"""
    global last_validation_time
    
    current_time = datetime.now()
    
    # Only validate every VALIDATION_INTERVAL seconds
    if last_validation_time:
        elapsed = (current_time - last_validation_time).total_seconds()
        if elapsed < VALIDATION_INTERVAL:
            return
    
    last_validation_time = current_time
    
    if len(raw_buffer) < 512:
        return
    
    # Get last second of raw data
    raw_segment = np.array(list(raw_buffer)[-512:])
    
    # Define band ranges
    band_ranges = {
        'Delta': (0.5, 4),
        'Theta': (4, 8),
        'Alpha': (8, 13),
        'Beta': (13, 30),
        'Gamma': (30, 45)
    }
    
    # Compute power for each band
    computed_powers = {}
    for band, (low, high) in band_ranges.items():
        power = compute_power_from_raw(raw_segment, low, high, 512)
        computed_powers[band] = power
    
    # Get device powers (combine Alpha Low/High, Beta Low/High, etc.)
    device_powers = {}
    
    if len(band_buffers['Delta']) > 0:
        device_powers['Delta'] = band_buffers['Delta'][-1]
    if len(band_buffers['Theta']) > 0:
        device_powers['Theta'] = band_buffers['Theta'][-1]
    if len(band_buffers['Alpha Low']) > 0 and len(band_buffers['Alpha High']) > 0:
        device_powers['Alpha'] = (band_buffers['Alpha Low'][-1] + 
                                   band_buffers['Alpha High'][-1]) / 2
    if len(band_buffers['Beta Low']) > 0 and len(band_buffers['Beta High']) > 0:
        device_powers['Beta'] = (band_buffers['Beta Low'][-1] + 
                                 band_buffers['Beta High'][-1]) / 2
    if len(band_buffers['Gamma Low']) > 0 and len(band_buffers['Gamma High']) > 0:
        device_powers['Gamma'] = (band_buffers['Gamma Low'][-1] + 
                                  band_buffers['Gamma High'][-1]) / 2
    
    # Store for correlation analysis
    timestamp = current_time.strftime('%H:%M:%S')
    validation_data['timestamps'].append(timestamp)
    
    # Prepare validation CSV row
    sample_number = len(validation_data['timestamps'])
    validation_row = [session_id, timestamp, sample_number]
    
    for band in band_ranges.keys():
        if band in device_powers and band in computed_powers:
            device_val = device_powers[band]
            computed_val = computed_powers[band]
            ratio = device_val / computed_val if computed_val > 0 else 0
            
            validation_data['device_powers'][band].append(device_val)
            validation_data['computed_powers'][band].append(computed_val)
            
            # Add to CSV row: device, computed, ratio
            validation_row.extend([device_val, computed_val, ratio])
        else:
            # Add empty values if data not available
            validation_row.extend(['', '', ''])
    
    # Write to validation CSV
    if validation_csv_writer:
        validation_csv_writer.writerow(validation_row)
        validation_csv_file.flush()
    
    # Print comparison
    print("\n" + "="*70)
    print(f"⚡ POWER VALIDATION [{timestamp}] - Sample #{sample_number}")
    print("="*70)
    print(f"{'Band':<10} {'Device Power':<18} {'Computed Power':<18} {'Scale Ratio'}")
    print("-"*70)
    
    for band in ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma']:
        if band in device_powers and band in computed_powers:
            device_val = device_powers[band]
            computed_val = computed_powers[band]
            ratio = device_val / computed_val if computed_val > 0 else 0
            
            print(f"{band:<10} {device_val:<18.0f} {computed_val:<18.2f} {ratio:>10.0f}x")
    
    # Calculate and display correlations if we have enough data points
    if len(validation_data['timestamps']) >= 3:
        print("\n" + "-"*70)
        print("📊 CORRELATION ANALYSIS (requires 3+ samples)")
        print("-"*70)
        
        for band in ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma']:
            device_vals = validation_data['device_powers'][band]
            computed_vals = validation_data['computed_powers'][band]
            
            if len(device_vals) >= 3 and len(computed_vals) >= 3:
                # Check for variance (can't correlate constant values)
                if np.std(device_vals) > 0 and np.std(computed_vals) > 0:
                    correlation = np.corrcoef(device_vals, computed_vals)[0, 1]
                    
                    # Interpret correlation
                    if correlation > 0.8:
                        status = "✅ EXCELLENT"
                    elif correlation > 0.6:
                        status = "✓ GOOD"
                    elif correlation > 0.4:
                        status = "⚠️ MODERATE"
                    else:
                        status = "❌ POOR"
                    
                    print(f"{band:<10} Correlation: {correlation:>6.3f}  {status}")
                else:
                    print(f"{band:<10} Correlation: N/A (constant values)")
    
    print("="*70 + "\n")

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
                
                # Run validation after band powers are received
                validate_power_accuracy()

def handle_notify(sender, payload):
    parse_and_decode_stream(bytearray(payload))

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
        print("💡 Power validation will run every 5 seconds\n")
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
        # Close CSV files
        if csv_file:
            csv_file.close()
            print("Main CSV file saved successfully.")
        
        if validation_csv_file:
            validation_csv_file.close()
            print("Validation CSV file saved successfully.")
        
        # Print final validation summary
        if len(validation_data['timestamps']) > 0:
            print("\n" + "="*70)
            print("📋 FINAL VALIDATION SUMMARY")
            print("="*70)
            print(f"Total validation samples: {len(validation_data['timestamps'])}")
            
            if len(validation_data['timestamps']) >= 3:
                print("\nFinal Correlations:")
                for band in ['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma']:
                    device_vals = validation_data['device_powers'][band]
                    computed_vals = validation_data['computed_powers'][band]
                    
                    if len(device_vals) >= 3 and np.std(device_vals) > 0 and np.std(computed_vals) > 0:
                        correlation = np.corrcoef(device_vals, computed_vals)[0, 1]
                        
                        # Calculate average scale ratio
                        ratios = [d/c for d, c in zip(device_vals, computed_vals) if c > 0]
                        avg_ratio = np.mean(ratios) if ratios else 0
                        
                        print(f"  {band:<10} Correlation: {correlation:>6.3f}  Avg Scale: {avg_ratio:>8.0f}x")
            
            print("="*70)