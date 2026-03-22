import os
import pandas as pd

# Paths
eeg_folder = "eeg_data/eeg data"
mapped_csv = "mapped_audio_files.csv"
output_csv = "music_score_dataset.csv"

# Bands to use for reward calculation
bands = ["Alpha_Low", "Alpha_High"]

# Load mapped CSV (source_csv -> audio_path)
df_mapped = pd.read_csv(mapped_csv)

dataset = []

for _, row in df_mapped.iterrows():
    source_file = row["source_csv"]
    audio_path = row["audio_path"]

    eeg_path = os.path.join(eeg_folder, source_file)
    if not os.path.exists(eeg_path):
        print(f"Warning: EEG file {source_file} not found, skipping")
        continue

    df = pd.read_csv(eeg_path)

    no_music = df[df["Session_Type"] == "no_music"].reset_index(drop=True)
    music = df[df["Session_Type"] == "music"].reset_index(drop=True)

    # Check that bands exist in the CSV
    if not set(bands).issubset(df.columns):
        print(f"Warning: Bands not found in {source_file}, skipping")
        continue

    alpha_no_music = no_music[bands].mean().mean()
    alpha_music = music[bands].mean().mean()

    score = (alpha_music - alpha_no_music) / (alpha_no_music + 1e-6)

    dataset.append({
        "source_csv": source_file,
        "audio_path": audio_path,
        "score": score
    })

# Save final dataset
df_dataset = pd.DataFrame(dataset)
df_dataset.to_csv(output_csv, index=False)
print(f"Saved music score dataset to {output_csv}")