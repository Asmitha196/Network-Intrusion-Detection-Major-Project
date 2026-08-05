"""
scripts/train_autoencoder.py — Keras Autoencoder Stage 2 anomaly detector training.

Trains a symmetric autoencoder exclusively on BENIGN (normal) traffic flows.
At inference time, flows whose reconstruction MSE exceeds the threshold are
flagged as anomalies (potential zero-day / novel attacks).

Produces four artifacts:
  ml/artifacts/autoencoder.keras           Keras SavedModel
  ml/artifacts/autoencoder_threshold.json  {"threshold": float, "percentile": int,
                                            "val_mse_min": float, "val_mse_p50": float,
                                            "val_mse_p95": float, "val_mse_max": float}
  ml/artifacts/scaler.pkl                  StandardScaler — if it already exists from
                                           train_classifier.py it is REUSED, not re-fitted,
                                           to ensure both models use identical scaling.
  ml/artifacts/training_history.json       Loss curve (for inspection / plotting)

Usage
-----
    # Run AFTER train_classifier.py so scaler.pkl already exists.
    # From the project root:
    $env:PYTHONPATH = (Get-Location)   # PowerShell
    export PYTHONPATH=$(pwd)           # bash

    python scripts/train_autoencoder.py \
        --data-path C:/data/cicids2017/ \
        --output-dir ml/artifacts/ \
        --epochs 50 \
        --batch-size 256 \
        --threshold-percentile 95

    # Or, to generate a fresh scaler (if running standalone):
    python scripts/train_autoencoder.py \
        --data-path C:/data/cicids2017/ \
        --output-dir ml/artifacts/ \
        --fit-scaler

Architecture
------------
    Input(76) → Dense(64, relu) → Dense(32, relu) → Dense(16, relu)   [encoder]
              → Dense(32, relu) → Dense(64, relu) → Dense(76, linear)  [decoder]

The bottleneck (16 units) forces the model to compress normal traffic into a
latent representation.  Attack flows cannot be reconstructed accurately from
that representation, producing high MSE that triggers Stage 2 alerts.

Threshold selection
-------------------
    After training, reconstruction MSE is computed on a held-out BENIGN validation
    set.  The threshold is set at the Nth percentile (default: 95th) of those errors.

    Lower percentile  → more sensitive  (more false positives on edge-case normal flows)
    Higher percentile → less sensitive  (misses subtle anomalies)

    The chosen threshold is saved to autoencoder_threshold.json and must be copied
    into .env as AUTOENCODER_THRESHOLD=<value>.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Ensure project root is in sys.path for feature_extraction imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train Keras Autoencoder Stage 2 anomaly detector on CICIDS2017 BENIGN flows.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--data-path", required=True,
                        help="Directory containing CICIDS2017 CSV files.")
    parser.add_argument("--output-dir", default="ml/artifacts",
                        help="Directory where model artifacts will be saved.")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--threshold-percentile", type=int, default=95,
                        help="Percentile of validation MSE to use as anomaly threshold.")
    parser.add_argument("--validation-split", type=float, default=0.1,
                        help="Fraction of BENIGN data held out for threshold calibration.")
    parser.add_argument("--fit-scaler", action="store_true",
                        help="Fit a new StandardScaler even if scaler.pkl already exists. "
                             "Use this if running standalone without train_classifier.py.")
    parser.add_argument("--random-seed", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    # Force UTF-8 output on Windows cp1252 consoles
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

    print("=" * 60)
    print("IDS - Stage 2 Autoencoder Anomaly Detector Training")
    print("=" * 60)
    print(f"  data_path:            {args.data_path}")
    print(f"  output_dir:           {args.output_dir}")
    print(f"  epochs:               {args.epochs}")
    print(f"  batch_size:           {args.batch_size}")
    print(f"  threshold_percentile: {args.threshold_percentile}th")
    print(f"  validation_split:     {args.validation_split}")
    print(f"  fit_scaler:           {args.fit_scaler}")
    print()

    # ------------------------------------------------------------------
    # Step 1: Load CSVs
    # ------------------------------------------------------------------
    import pandas as pd
    import numpy as np

    csv_files = sorted(Path(args.data_path).glob("*.csv"))
    if not csv_files:
        sys.exit(f"[ERROR] No CSV files found in: {args.data_path}")

    print(f"[1/6] Loading {len(csv_files)} CSV file(s)...")
    t0 = time.time()
    chunks: list[pd.DataFrame] = []
    for f in csv_files:
        print(f"      reading {f.name} ...", end=" ", flush=True)
        df_part = pd.read_csv(f, low_memory=False, encoding="utf-8")
        print(f"{len(df_part):,} rows")
        chunks.append(df_part)
    df = pd.concat(chunks, ignore_index=True)
    print(f"      Total: {len(df):,} rows  ({time.time()-t0:.1f}s)\n")

    # ------------------------------------------------------------------
    # Step 2: Preprocess + filter BENIGN rows
    # ------------------------------------------------------------------
    print("[2/6] Preprocessing and filtering BENIGN flows ...")

    df.columns = df.columns.str.strip()
    df = df.loc[:, ~df.columns.duplicated()]   # drop duplicate "Fwd Header Length"
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    n_before = len(df)
    df.dropna(inplace=True)
    print(f"      Dropped {n_before - len(df):,} rows with NaN/Inf")

    # Filter BENIGN only — autoencoder must see normal traffic only
    df_benign = df[df["Label"].str.strip() == "BENIGN"].copy()
    pct = 100 * len(df_benign) / len(df)
    print(f"      BENIGN rows: {len(df_benign):,} of {len(df):,} total ({pct:.1f}%)\n")

    if len(df_benign) < 1000:
        sys.exit(f"[ERROR] Too few BENIGN rows ({len(df_benign)}). "
                 "Check that your CSV files contain BENIGN-labelled traffic.")

    from feature_extraction.feature_names import FEATURE_NAMES

    missing_cols = [c for c in FEATURE_NAMES if c not in df_benign.columns]
    if missing_cols:
        sys.exit(
            f"[ERROR] {len(missing_cols)} feature column(s) missing.\n"
            f"  {missing_cols[:5]}{'...' if len(missing_cols) > 5 else ''}"
        )

    X = df_benign[FEATURE_NAMES].values.astype("float32")
    n_features = X.shape[1]   # 76
    print(f"      Feature matrix: {X.shape}\n")

    # ------------------------------------------------------------------
    # Step 3: Train/validation split + scaler
    # ------------------------------------------------------------------
    print("[3/6] Splitting data and fitting / loading StandardScaler ...")

    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    import joblib

    X_train, X_val = train_test_split(
        X,
        test_size=args.validation_split,
        random_state=args.random_seed,
        shuffle=True,
    )
    print(f"      Train: {len(X_train):,}   Val: {len(X_val):,}")

    scaler_path = os.path.join(args.output_dir, "scaler.pkl")
    if not args.fit_scaler and os.path.exists(scaler_path):
        print(f"      Reusing existing scaler from {scaler_path}")
        scaler: StandardScaler = joblib.load(scaler_path)
        X_train_scaled = scaler.transform(X_train)
        X_val_scaled   = scaler.transform(X_val)
    else:
        if args.fit_scaler:
            print("      --fit-scaler: fitting a new StandardScaler on BENIGN train split")
        else:
            print(f"      No existing scaler found — fitting new StandardScaler")
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_val_scaled   = scaler.transform(X_val)
        joblib.dump(scaler, scaler_path)
        print(f"      Scaler saved → {scaler_path}")
    print()

    # ------------------------------------------------------------------
    # Step 4: Define and train PyTorch autoencoder
    # ------------------------------------------------------------------
    print("[4/6] Building and training PyTorch autoencoder ...")

    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset

    torch.manual_seed(args.random_seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"      PyTorch {torch.__version__} | Device: {device}\n")

    from ml.anomaly_detector import PyTorchAutoencoder

    model = PyTorchAutoencoder(input_dim=n_features).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.MSELoss()

    train_tensor = torch.tensor(X_train_scaled, dtype=torch.float32)
    val_tensor = torch.tensor(X_val_scaled, dtype=torch.float32).to(device)

    train_loader = DataLoader(
        TensorDataset(train_tensor),
        batch_size=args.batch_size,
        shuffle=True,
    )

    t_train = time.time()
    history: dict[str, list[float]] = {"loss": [], "val_loss": []}
    best_val_loss = float("inf")
    patience = 5
    patience_counter = 0

    for epoch in range(1, args.epochs + 1):
        model.train()
        epoch_loss = 0.0
        for (batch_x,) in train_loader:
            batch_x = batch_x.to(device)
            optimizer.zero_grad()
            outputs = model(batch_x)
            loss = criterion(outputs, batch_x)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item() * len(batch_x)

        epoch_loss /= len(X_train_scaled)

        model.eval()
        with torch.no_grad():
            val_outputs = model(val_tensor)
            val_loss = criterion(val_outputs, val_tensor).item()

        history["loss"].append(epoch_loss)
        history["val_loss"].append(val_loss)

        if epoch % 5 == 0 or epoch == 1 or epoch == args.epochs:
            print(f"      Epoch {epoch:3d}/{args.epochs} - loss: {epoch_loss:.6f} - val_loss: {val_loss:.6f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            best_state_dict = model.state_dict()
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"      Early stopping triggered at epoch {epoch}")
                break

    if "best_state_dict" in locals():
        model.load_state_dict(best_state_dict)

    print(f"\n      Training complete in {time.time()-t_train:.1f}s")
    print(f"      Epochs trained: {len(history['loss'])}  Best val_loss: {best_val_loss:.6f}\n")

    # ------------------------------------------------------------------
    # Step 5: Compute reconstruction error threshold on validation set
    # ------------------------------------------------------------------
    print("[5/6] Computing anomaly threshold on validation set ...")

    model.eval()
    with torch.no_grad():
        reconstructed = model(val_tensor)
        mse = torch.mean((val_tensor - reconstructed) ** 2, dim=1).cpu().numpy()

    threshold = float(np.percentile(mse, args.threshold_percentile))
    mse_stats = {
        "val_mse_min": float(mse.min()),
        "val_mse_p50": float(np.percentile(mse, 50)),
        "val_mse_p90": float(np.percentile(mse, 90)),
        "val_mse_p95": float(np.percentile(mse, 95)),
        "val_mse_p99": float(np.percentile(mse, 99)),
        "val_mse_max": float(mse.max()),
    }

    print(f"      Validation MSE distribution:")
    for k, v in mse_stats.items():
        marker = " ← threshold" if k == f"val_mse_p{args.threshold_percentile}" else ""
        print(f"        {k}: {v:.8f}{marker}")
    print(f"\n      Anomaly threshold ({args.threshold_percentile}th percentile): {threshold:.8f}")
    print(f"      → Set AUTOENCODER_THRESHOLD={threshold:.8f} in your .env file\n")

    # ------------------------------------------------------------------
    # Step 6: Save artifacts
    # ------------------------------------------------------------------
    print("[6/6] Saving artifacts ...")

    model_path     = os.path.join(args.output_dir, "autoencoder.pt")
    threshold_path = os.path.join(args.output_dir, "autoencoder_threshold.json")
    history_path   = os.path.join(args.output_dir, "training_history.json")

    torch.save(model.state_dict(), model_path)
    print(f"      Autoencoder model → {model_path}")

    threshold_data = {
        "threshold":  threshold,
        "percentile": args.threshold_percentile,
        **mse_stats,
    }
    with open(threshold_path, "w") as f:
        json.dump(threshold_data, f, indent=2)
    print(f"      Threshold JSON    → {threshold_path}")

    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)
    print(f"      Training history  → {history_path}")

    print()
    print("=" * 60)
    print("Training complete. Next steps:")
    print(f"  1. Add to .env:  AUTOENCODER_THRESHOLD={threshold:.8f}")
    print(f"  2. Verify artifacts exist in:  {args.output_dir}/")
    print("=" * 60)


if __name__ == "__main__":
    main()

