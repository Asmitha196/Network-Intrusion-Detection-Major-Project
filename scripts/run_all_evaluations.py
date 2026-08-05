import sys
import os
import json
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
import numpy as np
import joblib
import torch
from sklearn.metrics import confusion_matrix
from sklearn.model_selection import train_test_split

from feature_extraction.feature_names import FEATURE_NAMES
from scripts.train_classifier import LABEL_VARIANTS
from ml.anomaly_detector import PyTorchAutoencoder, AutoencoderDetector

def main():
    print("=" * 70)
    print("IDS Pipeline Complete Analysis: Stage 1 Confusion Matrix & Stage 2 Anomaly Test")
    print("=" * 70)

    data_path = "data/cicids2017"
    artifacts_dir = "ml/artifacts"

    # 1. Verify Autoencoder Threshold & Stats
    thresh_file = os.path.join(artifacts_dir, "autoencoder_threshold.json")
    if os.path.exists(thresh_file):
        with open(thresh_file) as f:
            thresh_data = json.load(f)
        print("\n--- 1. Stage 2 (PyTorch Autoencoder) Threshold & Validation MSE Distribution ---")
        print(f"  Anomaly Threshold (95th percentile) : {thresh_data.get('threshold'):.8f}")
        print(f"  Validation MSE Min                  : {thresh_data.get('val_mse_min'):.8f}")
        print(f"  Validation MSE Median (p50)         : {thresh_data.get('val_mse_p50'):.8f}")
        print(f"  Validation MSE p90                  : {thresh_data.get('val_mse_p90'):.8f}")
        print(f"  Validation MSE p95 (Threshold)      : {thresh_data.get('val_mse_p95'):.8f}")
        print(f"  Validation MSE p99                  : {thresh_data.get('val_mse_p99'):.8f}")
        print(f"  Validation MSE Max                  : {thresh_data.get('val_mse_max'):.8f}")
    else:
        print("\n[!] autoencoder_threshold.json not found yet.")

    # 2. Load dataset and models
    print("\nLoading dataset CSVs for evaluation...")
    csv_files = sorted(Path(data_path).glob("*.csv"))
    chunks = [pd.read_csv(f, low_memory=False, encoding="utf-8") for f in csv_files]
    df = pd.concat(chunks, ignore_index=True)

    df.columns = df.columns.str.strip()
    df = df.loc[:, ~df.columns.duplicated()]
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.dropna(inplace=True)

    X = df[FEATURE_NAMES].values.astype("float32")
    raw_labels = df["Label"].str.strip().values
    y_str = np.array([LABEL_VARIANTS.get(lbl, lbl) for lbl in raw_labels])

    encoder = joblib.load(os.path.join(artifacts_dir, "classifier_encoder.pkl"))
    scaler = joblib.load(os.path.join(artifacts_dir, "scaler.pkl"))
    clf = joblib.load(os.path.join(artifacts_dir, "classifier.joblib"))

    y = encoder.transform(y_str)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    X_test_scaled = scaler.transform(X_test)

    print("Evaluating Stage 1 RandomForest on test set (565,576 samples)...")
    y_pred = clf.predict(X_test_scaled)
    classes = list(encoder.classes_)

    # 3. Print Confusion Matrix
    print("\n" + "=" * 70)
    print("Stage 1 Confusion Matrix (Rows = True Class, Cols = Predicted Class)")
    print("=" * 70)
    cm = confusion_matrix(y_test, y_pred)
    cm_df = pd.DataFrame(cm, index=classes, columns=classes)
    print(cm_df.to_string())

    # 4. Detailed XSS Misclassification Analysis
    if "Web Attack - XSS" in classes:
        xss_idx = classes.index("Web Attack - XSS")
        xss_mask = (y_test == xss_idx)
        xss_preds = pd.Series(y_pred[xss_mask]).value_counts()
        total_xss = xss_mask.sum()

        print("\n" + "=" * 70)
        print(f"Breakdown of 'Web Attack - XSS' Predictions (Total True Samples: {total_xss}):")
        print("=" * 70)
        for pred_idx, count in xss_preds.items():
            pred_label = classes[pred_idx]
            pct = 100.0 * count / total_xss
            print(f"  -> Predicted as '{pred_label:<25}': {count:>4d} ({pct:6.2f}%)")

    # 5. Test Weak Classes (Bot, Infiltration, XSS) through Stage 2 PyTorch Autoencoder
    pt_model_path = os.path.join(artifacts_dir, "autoencoder.pt")
    if os.path.exists(pt_model_path):
        print("\n" + "=" * 70)
        print("Stage 2 PyTorch Autoencoder Anomaly Detection on Stage 1 False BENIGN Samples")
        print("=" * 70)

        threshold = thresh_data.get("threshold", 0.02041140) if 'thresh_data' in locals() else 0.02041140
        detector = AutoencoderDetector(model_path=pt_model_path, threshold=threshold)
        detector.load()

        benign_idx = classes.index("BENIGN") if "BENIGN" in classes else 0
        weak_classes = ["Bot", "Infiltration", "Web Attack - XSS"]

        for target_cls in weak_classes:
            if target_cls not in classes:
                continue
            cls_idx = classes.index(target_cls)
            # Find samples of target_cls that Stage 1 misclassified as BENIGN
            missed_mask = (y_test == cls_idx) & (y_pred == benign_idx)
            n_missed = missed_mask.sum()
            total_cls = (y_test == cls_idx).sum()

            print(f"\nTarget Class: '{target_cls}'")
            print(f"  Total test samples          : {total_cls}")
            print(f"  Stage 1 Misclassified as BENIGN: {n_missed}")

            if n_missed > 0:
                X_missed = X_test_scaled[missed_mask]
                flagged_anomalies = 0
                errors = []
                for i in range(len(X_missed)):
                    sample = X_missed[i:i+1]
                    is_anom, mse = detector.detect(sample)
                    errors.append(mse)
                    if is_anom:
                        flagged_anomalies += 1

                mean_mse = np.mean(errors)
                pct_flagged = 100.0 * flagged_anomalies / n_missed
                print(f"  Stage 2 Reconstruction Error Mean : {mean_mse:.8f} (Threshold = {threshold:.8f})")
                print(f"  Stage 2 Flagged as Anomaly        : {flagged_anomalies} / {n_missed} ({pct_flagged:.1f}%)")
                if pct_flagged > 0:
                    print(f"  --> SUCCESS: Stage 2 hybrid escalation caught {pct_flagged:.1f}% of Stage 1 missed attacks!")

    # 6. Final ml/artifacts directory listing
    print("\n" + "=" * 70)
    print("Final ml/artifacts/ Directory Contents:")
    print("=" * 70)
    for fname in sorted(os.listdir(artifacts_dir)):
        fpath = os.path.join(artifacts_dir, fname)
        size_kb = os.path.getsize(fpath) / 1024.0
        print(f"  - {fname:<30} ({size_kb:,.1f} KB)")

if __name__ == "__main__":
    main()
