# %%
import os

os.environ["CUDA_VISIBLE_DEVICES"] = "1"

# %%
import torch
from audiocraft.models import musicgen
from audiocraft.modules.conditioners import ConditioningAttributes
import os
import torch
import torchaudio
from torch.utils.data import Dataset, DataLoader
from audiocraft.modules.conditioners import ConditioningAttributes

import torch
from torch.utils.data import Dataset, DataLoader
import pandas as pd
import torchaudio
import random
from audiocraft.data.audio_utils import convert_audio

# %%


# %%
device = "cuda" if torch.cuda.is_available() else "cpu"
print("Using device:", device)
model = musicgen.MusicGen.get_pretrained("small", device=device)
lm_model = model.lm
compression_model = model.compression_model
lm_model.float()
torch.autograd.set_detect_anomaly(True)

# %%
compression_model = model.compression_model
lm_model.float()

# %%
import os
import torch
from torch.utils.data import Dataset
import pandas as pd
import torchaudio
import itertools


class MusicPairDataset(Dataset):
    def __init__(self, csv_file, token_len=256):
        self.df = pd.read_csv(csv_file)
        self.token_len = token_len

        # list of (clip_path, reward)
        self.clips = [
            (row["file_path"], float(row["reward_score"]))
            for _, row in self.df.iterrows()
        ]

        # map file base -> clip indices
        self.file_to_indices = {}
        for idx, (path, _) in enumerate(self.clips):
            file_base = "_".join(os.path.basename(path).split("_clip")[:-1])
            self.file_to_indices.setdefault(file_base, []).append(idx)

        # Precompute all inter-file pairs
        self.pairs = []
        file_bases = list(self.file_to_indices.keys())
        for i, base1 in enumerate(file_bases):
            for base2 in file_bases[i + 1 :]:  # ensure every pair of different files
                for idx1 in self.file_to_indices[base1]:
                    for idx2 in self.file_to_indices[base2]:
                        self.pairs.append((idx1, idx2))  # store indices of clip1, clip2

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, idx):
        idx1, idx2 = self.pairs[idx]
        clip1_path, reward1 = self.clips[idx1]
        clip2_path, reward2 = self.clips[idx2]

        # ---- load audio ----
        audio1, sr1 = torchaudio.load(clip1_path)
        audio2, sr2 = torchaudio.load(clip2_path)

        audio1 = convert_audio(audio1, from_rate=sr1, to_rate=32000, to_channels=1)
        audio2 = convert_audio(audio2, from_rate=sr2, to_rate=32000, to_channels=1)

        if audio1.shape[0] > 1:
            audio1 = audio1.mean(dim=0, keepdim=True)
        if audio2.shape[0] > 1:
            audio2 = audio2.mean(dim=0, keepdim=True)

        audio1 = audio1.to(device)
        audio2 = audio2.to(device)

        # rewards as tensors
        reward1_tensor = torch.tensor([reward1], dtype=torch.float32).to(device)
        reward2_tensor = torch.tensor([reward2], dtype=torch.float32).to(device)

        return (audio1, reward1_tensor), (audio2, reward2_tensor)

# %%
csv_file = "filtered_output.csv"
dataset = MusicPairDataset(csv_file, 256)
dataloader = DataLoader(dataset, batch_size=4, shuffle=True, num_workers=0)

# --------


validate_csv = "clips_scores_validate.csv"
validate_dataset = MusicPairDataset(validate_csv, 256)
validate_dataloader = DataLoader(
    validate_dataset, batch_size=2, shuffle=False, num_workers=0
)

# %%
print(len(dataloader))
print(len(validate_dataloader))

# %%
def collate_fn(batch, device="cuda", token_len=256):
    # Move everything to the same device and stack

    audio_batch = torch.stack(
        [batch[0][0].to(device), batch[1][0].to(device)], dim=0
    )  # 2, batch, 1, audio_len
    reward_batch = torch.stack(
        [batch[0][1].to(device), batch[1][1].to(device)], dim=0
    )  # 2, batch, 1

    audio_tokens, _ = compression_model.encode(
        audio_batch.view(-1, 1, audio_batch.shape[-1])
    )  # (2*batch, codebook, token_len)
    reward_batch = reward_batch.view(-1, 1)
    audio_tokens = audio_tokens[..., :token_len]  # truncate to 256 tokens`]

    # audio_tokens = audio_tokens.view(2, batch_size, audio_tokens.shape[1], audio_tokens.shape[2])  # (2, batch, codebook, token_len)

    return (
        audio_tokens,
        reward_batch,
    )  # returns tuple. audio_tokens = (2*batch, 4, token_len), reward_batch = (2*batch, 1)

# %%


# %%
import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ------------------------
# Reward model: Conv1d + MLP
# ------------------------


class RewardModel(nn.Module):
    def __init__(self, hidden_dim=1024, hidden=32, dropout=0.3):
        super().__init__()

        self.fc1 = nn.Linear(hidden_dim, hidden)
        self.dropout = nn.Dropout(dropout)
        self.act = nn.ReLU()
        self.out = nn.Linear(hidden, 1)

    def forward(self, x):
        x = self.fc1(x)
        x = self.act(x)
        x = self.dropout(x)
        reward = self.out(x).squeeze(-1)
        return reward

# ------------------------
# Preference margin loss
# ------------------------
import torch
import torch.nn.functional as F


def combined_loss(
    r1_pred, r2_pred, reward_A, reward_B, margin_weight=1, mse_weight=0
):
    r1_pred = r1_pred.float()
    r2_pred = r2_pred.float()
    reward_A = reward_A.float()
    reward_B = reward_B.float()

    # -----------------------------
    # preference margin (Llama2 style)
    # -----------------------------
    # compute margin as absolute difference of rewards
    margin = torch.abs(reward_A - reward_B)

    # compute ranking loss exactly as L = -log sigma(r1 - r2 - margin)
    # add a small ep
    # 
    # silon inside log to avoid log(0)
    eps = 1e-12


        # Determine which is preferred
    r_winner = torch.where(reward_A >= reward_B, r1_pred, r2_pred)
    r_loser  = torch.where(reward_A >= reward_B, r2_pred, r1_pred)
    margin_loss = -torch.log(torch.sigmoid(r_winner - r_loser - margin) + eps).mean()
    # margin_loss = -torch.log(torch.sigmoid(r1_pred - r2_pred - margin) + eps).mean()

    # -----------------------------
    # regression MSE loss
    # -----------------------------
    mse_A = F.mse_loss(r1_pred, reward_A)
    mse_B = F.mse_loss(r2_pred, reward_B)
    mse = (mse_A + mse_B) / 2

    # -----------------------------
    # total loss with weighting
    # -----------------------------
    total_loss = margin_weight * margin_loss + mse_weight * mse 

    return total_loss, margin_loss, mse


# ------------------------
# Training setup
# ------------------------
reward_model = RewardModel().to(device)

optimizer = torch.optim.AdamW(
    [
        {"params": reward_model.parameters(), "lr": 1e-4},  # higher LR for reward model
    ]
    ,
    weight_decay=1e-2,
)

scheduler = torch.optim.lr_scheduler.StepLR(
    optimizer,
    step_size=500,  # number of optimizer steps before multiplying
    gamma=0.9,  # LR multiplier
)


num_epochs = 20  # example
accum_steps = 4  # for gradient accumulation

# ------------------------
# Training loopLinear
# ------------------------
# dataloader should yield: ((tokens1, reward1), (tokens2, reward2))

# %%
# checkpoint_path = "reward_model_checkpoints/reward_model_epoch.pt"
# checkpoint = torch.load(checkpoint_path, map_location=device)

# # 4. Load the model state dict
# reward_model.load_state_dict(checkpoint['model_state_dict'])

# # 5. Move the model to device
# reward_model.to(device)


# %%


# %%
import os

save_dir = "reward_model_checkpoints"
os.makedirs(save_dir, exist_ok=True)
optimizer.zero_grad()


total_loss_list = []
margin_loss_list = []
mse_loss_list = []

accum_loss_list = []
accum_margin_loss_list = []
accum_mse_loss_list = []

validate_loss_list = []
validate_margin_loss_list = []
validate_mse_loss_list = []

lm_model.eval()
reward_model.train()  # ensure reward model is in training mode

for epoch in range(num_epochs):

    for batch_idx, batch in enumerate(dataloader):
        audio_batch, reward_batch = collate_fn(
            batch
        )  # 2*batch,4,token_len and 2*batch,1

        # with torch.no_grad(): # no gradients for LM

        # print("audio batch shape", audio_batch.shape)  # should be [2*batch, 4, token_len]
        # print("reward batch shape", reward_batch.shape)  # should be [2*batch
    
    
        with torch.no_grad():
            hid_emb = lm_model.compute_predictions(
                audio_batch,
                # max_gen_len= audio_batch.shape[-1] + 1,
                conditions=[
                    ConditioningAttributes(text={"description": None})
                    for description in range(audio_batch.shape[0])
                ],
            )


        # print("hidden emb shape before", hid_emb.shape)  # should be [2*batch, token_len+1, 1024]

        batch_size = (
            hid_emb.shape[0] // 2
        )  # because half contains pair A and half contains pair B
        hid_emb_A = hid_emb[:batch_size]  # [batch_size, 257, 1024]
        hid_emb_B = hid_emb[batch_size:]  # [batch_size, 257, 1024]

        # print('hiden', hid_emb_A.shape)

        # last_emb_A = hid_emb_A.mean(dim=1)  # [batch_size, 1024]
        # last_emb_B = hid_emb_B.mean(dim=1)  # [batch_size, 1024]
        last_emb_A = hid_emb_A[:, -1, :]  # [batch_size, 1024]
        last_emb_B = hid_emb_B[:, -1, :]  # [batch_size, 1024]

        # last_emb_A = hid_emb_A.mean(dim=1)  # [batch_size, 1024]  #changed from mean but variable name kept because lazy
        # last_emb_B = hid_emb_B.mean(dim=1)  # [batch_size, 1024]
        reward_A = reward_batch[:batch_size]  # [batch_size  , 1]
        reward_B = reward_batch[batch_size:]  # [batch_size, 1]

        # ------------------------
        # 2. Predict rewards
        # ------------------------
        r1_pred = reward_model(last_emb_A)
        r2_pred = reward_model(last_emb_B)
        r1_pred = r1_pred.unsqueeze(-1)  # [batch_size]
        r2_pred = r2_pred.unsqueeze(-1)  # [batch_size]

        # print(r1_pred.shape, reward_A.shape)  # should both be [batch_size, 1]

        # ------------------------
        # 3. Compute preference margin
        # ------------------------
        margin = reward_A - reward_B  # use label difference
        loss, margin_loss, mse = combined_loss(r1_pred, r2_pred, reward_A, reward_B)

        # ------------------------
        # 4. Backprop and optimization
        # ------------------------
        (loss / accum_steps).backward()

        # perform optimizer step every `accum_steps` mini-batches

        accum_loss_list.append(loss.item())
        accum_margin_loss_list.append(margin_loss.item())
        accum_mse_loss_list.append(mse.item())

        if (batch_idx + 1) % accum_steps == 0:

            optimizer.step()
            scheduler.step()  # <-- step scheduler here
            optimizer.zero_grad()  # reset gradients for next accumulation cycle

            accum_loss = sum(accum_loss_list) / len(accum_loss_list)
            accum_margin_loss = sum(accum_margin_loss_list) / len(
                accum_margin_loss_list
            )
            accum_mse_loss = sum(accum_mse_loss_list) / len(accum_mse_loss_list)
            total_loss_list.append(accum_loss)
            margin_loss_list.append(accum_margin_loss)
            mse_loss_list.append(accum_mse_loss)

            print(
                f"Epoch {epoch}, Batch {batch_idx}, Avg Loss: {accum_loss:.4f}, Margin Loss: {accum_margin_loss:.4f}, MSE Loss: {accum_mse_loss:.4f}"
            )
            accum_loss_list = []
            accum_margin_loss_list = []
            accum_mse_loss_list = []

        if (batch_idx + 1) % (accum_steps * 25) == 0 or batch_idx == 0:
            val_total, val_margin, val_mse = [], [], []

            reward_model.train()  # switch to eval mode for validation
            lm_model.eval()

            for i, validate_data in enumerate(validate_dataloader):

                audio_batch, reward_batch = collate_fn(
                    validate_data
                )  # 2*batch,4,token_len and 2*batch,1

                with torch.no_grad():  # no gradients for LM
                    hid_emb = lm_model.compute_predictions(
                        audio_batch,
                        conditions=[
                            ConditioningAttributes(text={"description": None})
                            for description in range(audio_batch.shape[0])
                        ],
                    )  # [2*batch, token_len+1, 1024]

                batch_size = (
                    hid_emb.shape[0] // 2
                )  # because the batch contains pairs stacked together

                hid_emb_A = hid_emb[:batch_size]  # [batch_size, 257, 1024]
                hid_emb_B = hid_emb[batch_size:]  # [batch_size, 257, 1024]
                # last_emb_A = hid_emb_A.mean(dim=1)  # [batch_size, 1024]
                # last_emb_B = hid_emb_B.mean(dim=1) 

                last_emb_A = hid_emb_A[:, -1, :]  # [batch_size, 1024]
                last_emb_B = hid_emb_B[:, -1, :]  # [batch_size, 1024]

                reward_A = reward_batch[:batch_size]  # [batch_size  , 1]
                reward_B = reward_batch[batch_size:]  # [batch_size, 1]

                # ------------------------
                # 2. Predict rewards
                # ------------------------
                with torch.no_grad():
                    r1_pred = reward_model(last_emb_A)
                    r2_pred = reward_model(last_emb_B)
                    r1_pred = r1_pred.unsqueeze(-1)  # [batch_size,1]
                    r2_pred = r2_pred.unsqueeze(-1)  # [batch_size,1]

                    # p# should both be [batch_size, 1]
                    # print("this", r2_pred.shape, reward_B.shape)  # should both be [batch_size, 1]
                    validate_loss, validate_margin_loss, validate_mse_loss = (
                        combined_loss(r1_pred, r2_pred, reward_A, reward_B)
                    )

                val_total.append(validate_loss.item())
                val_margin.append(validate_margin_loss.item())
                val_mse.append(validate_mse_loss.item())

            avg_val_loss = sum(val_total) / len(val_total)
            avg_val_margin = sum(val_margin) / len(val_margin)
            avg_val_mse = sum(val_mse) / len(val_mse)

            print(f"Validation - Epoch {epoch}, Avg Loss: {avg_val_loss:.4f}, Margin: {avg_val_margin:.4f}, MSE: {avg_val_mse:.4f}")
            validate_loss_list.append(avg_val_loss)
            validate_margin_loss_list.append(avg_val_margin)
            validate_mse_loss_list.append(avg_val_mse)
            reward_model.train()  # switch back to training mode
           

        if (batch_idx + 1) % (accum_steps * 400) == 0:
            checkpoint = {
                "epoch": epoch,
                "model_state_dict": reward_model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "scheduler_state_dict": scheduler.state_dict(),  # <--- add this
                "total_loss_list": total_loss_list,
                "margin_loss_list": margin_loss_list,
                "mse_loss_list": mse_loss_list,
                "validate_loss_list": validate_loss_list,
                # "lm_model_state_dict": lm_model.state_dict(),
            }

            save_path = os.path.join(save_dir, f"reward_model_epoch.pt")

            torch.save(checkpoint, save_path)

            print(f"Saved checkpoint: {save_path}")

# %%


# # %%
# import matplotlib.pyplot as plt

# # Take every 100th value
# plt.plot(validate_loss_list, label="Validate Loss")
# # plt.plot(validate_margin_loss_list, label="Train Loss")
# # plt.plot(validate_mse_loss_list, label="MSE Loss")

# # %%
# validate_loss_list[-1]

# # %%
# plt.plot(total_loss_list, label="Train Loss")

# # %%
# total_loss_list[-1]

# %%


# # %%
# # Example iteration

# for (tokens1, reward1), (tokens2, reward2) in dataloader:
#     # tokens1, tokens2 shape: [B, 1, K, T]
#     print("tokens1 shape:", tokens1.shape)
#     print("tokens2 shape:", tokens2.shape)
#     print("reward1 shape:", reward1.shape)
#     print("reward1:", reward1)

#     # Remove the singleton dimension
#     tokens1 = tokens1.squeeze(1)  # [B, K, T]
#     tokens2 = tokens2.squeeze(1)  # [B, K, T]
#     batch = tokens1.shape[0]

#     # Concatenate along batch dimension
#     tokens_batch = torch.cat([tokens1, tokens2], dim=0)  # [2*B, K, T]
#     print("tokens_batch shape:", tokens_batch.shape)

#     # Generate LM embeddings
#     hid_emb = lm_model.generate(
#         tokens_batch,
#         max_gen_len=tokens_batch.shape[-1] + 1,
#         conditions=[
#             ConditioningAttributes(text={"description": None})
#             for description in range(tokens_batch.shape[0])
#         ],
#     )

#     print("hid_emb shape:", hid_emb.shape)
#     hid_emb2 = hid_emb[: tokens_batch.shape[0]]  # keep only first 4
#     print(hid_emb2.shape)
#     K = 4
#     hid_emb3 = hid_emb2.view(batch, 2, hid_emb.shape[1], hid_emb.shape[2])
#     print("final hid emb shape", hid_emb3.shape)
#     print("reward1 shape:", reward1.shape)
#     print("reward1:", reward1)
#     print("reward2 shape:", reward2.shape)
#     print("reward2:", reward2)

#     break  # just for testing one batch

# # %%


# # %%
# # hid_emb.shape = [8, 257, 1024]
# hid_emb = hid_emb[: tokens_batch.shape[0]]  # keep only first 4
# # shape now: [4, 257, 1024]

# # %%
# # hid_emb.shape

# # %%
# # B = 2
# # tokens_per_pair = 2

# # hid_emb_reshaped = hid_emb.view(B, tokens_per_pair, hid_emb.shape[1], hid_emb.shape[2])
# # # shape: [2, 2, 257, 1024]

# # %%


# # %%
# hid_emb = lm_model.generate(
#     torch.cat([tokens1, tokens2], dim=0),
#     max_gen_len=tokens1.shape[-1] + 1,
#     conditions=attributes,
# )

# # %%
# tokens2.shape

# # %%
# import torchaudio
# import torch

# # Path to your WAV file
# file_path = "musicgen_output_1.wav"
# file_path2 = "musicgen_output_2.wav"

# # Load WAV file
# audio_data, sample_rate = torchaudio.load(file_path)  # audio_data is a tensor
# audio_data2, sample_rate2 = torchaudio.load(file_path2)
# print("Sample rate:", sample_rate)
# print("Audio tensor shape:", audio_data.shape)  # [channels, samples]
# print("Data type:", audio_data.dtype)

# # Move to GPU if available
# device = "cuda" if torch.cuda.is_available() else "cpu"
# audio_data = audio_data.to(device)
# audio_data2 = audio_data2.to(device)
# print("Device:", audio_data.device)

# # %%
# with torch.no_grad():
#     data, _ = compression_model.encode(audio_data.unsqueeze(0))
#     data2, _ = compression_model.encode(audio_data2.unsqueeze(0))

# # %%
# data.device

# # %%
# attributes = [
#     ConditioningAttributes(text={"description": None})
#     for description in range(data.shape[0])
# ]

# # %%
# hid_emb = lm_model.generate(data, max_gen_len=data.shape[-1] + 1, conditions=attributes)

# # %%
# hid_emb.shape

# # %%
# data.shape

# # %%
# x = torch.cat([data, data2])
# x.shape

# # %%
# hid_emb.shape

# # %%
# x_first_two = hid_emb[0:2, :, :]  # shape: (2, 251, 1024)

# # %%
# x_last_two = hid_emb[-2:, :, :]

# # %%
# x_first_two.shape

# # %%
# x0, x1 = torch.split(x_first_two, 1, dim=0)

# # %%
# x_last_two.shape

# # %%
# x0.shape

# # %%
# x1.shape

# # %%
# x_first_two[1] == x_last_two[1]

# # %%
# print(x_last_two.shape)

# # %%


# # %%
# hid_emb.shape

# # %%
# import torch.nn as nn

# # Example: 1D conv over tokens to aggregate
# conv = nn.Conv1d(in_channels=1024, out_channels=512, kernel_size=1).to(device)
# x = hid_emb.permute(0, 2, 1)  # [codebooks, 1024, tokens]
# x = conv(x).mean(dim=2)  # [codebooks, 512]
# flattened = x.view(1, -1)  # [1, 4*512] = [1, 2048]

# # %%


# # %%
# for (tokens1, reward1), (tokens2, reward2) in dataloader:
#     # tokens1, tokens2 shape: [B, 1, K, T]
#     print("tokens1 shape:", tokens1.shape)
#     print("tokens2 shape:", tokens2.shape)
#     print("reward1 shape:", reward1.shape)
#     print("reward1:", reward1)

#     # Remove the singleton dimension
#     tokens1 = tokens1.squeeze(1)  # [B, K, T]
#     tokens2 = tokens2.squeeze(1)  # [B, K, T]
#     batch = tokens1.shape[0]

#     # Concatenate along batch dimension
#     tokens_batch = torch.cat([tokens1, tokens2], dim=0)  # [2*B, K, T]
#     print("tokens_batch shape:", tokens_batch.shape)

#     # Generate LM embeddings
#     hid_emb = lm_model.generate(
#         tokens_batch,
#         max_gen_len=tokens_batch.shape[-1] + 1,
#         conditions=[
#             ConditioningAttributes(text={"description": None})
#             for description in range(tokens_batch.shape[0])
#         ],
#     )

#     print("hid_emb shape:", hid_emb.shape)
#     hid_emb2 = hid_emb[: tokens_batch.shape[0]]  # keep only first 4
#     print(hid_emb2.shape)
#     K = 4
#     hid_emb3 = hid_emb2.view(batch, 2, hid_emb.shape[1], hid_emb.shape[2])
#     print("final hid emb shape", hid_emb3.shape)

#     break  #

# # %%
# print(flattened.shape)

# # %%
# ned

# # %%

# !sudo apt get install -y nodejs

# # %%
# nodejs - -version

# # %%



