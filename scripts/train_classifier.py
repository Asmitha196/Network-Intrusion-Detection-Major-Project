"""
scripts/train_classifier.py — XGBoost Stage 1 multi-class classifier training.

Trains on the CICIDS2017 dataset and produces three artifacts:
  ml/artifacts/classifier.ubj          XGBoost Booster (binary UBJ format)
  ml/artifacts/classifier_encoder.pkl  sklearn LabelEncoder  (int ↔ class name)
  ml/artifacts/scaler.pkl              sklearn StandardScaler (shared with autoencoder)

Usage
-----
    # From the project root:
    $env:PYTHONPATH = (Get-Location)   # PowerShell
    export PYTHONPATH=$(pwd)           # bash

    python scripts/train_classifier.py \
        --data-path C:/data/cicids2017/ \
        --output-dir ml/artifacts/ \
        --n-estimators 300 \
        --max-depth 6 \
        --test-split 0.2

CICIDS2017 CSV notes
--------------------
  - The dataset ships as 8 separate CSV files (one per day / attack category).
    All of them are loaded and concatenated automatically.
  - Column names have leading/trailing whitespace — stripped automatically.
  - The "Label" column uses the exact strings in LABEL_VARIANTS below;
    all variants are normalised to a canonical short name.
  - CICFlowMeter v3 produces a duplicate "Fwd Header Length" column.
    It is dropped automatically before feature selection.
  - Rows with Inf / NaN values are dropped (these arise from zero-duration flows
    when computing bytes/s or packets/s).

Output artifacts
----------------
  classifier.ubj         — loaded by ml/classifier.py at inference time
  classifier_encoder.pkl — maps integer class index → string attack label
  scaler.pkl             — fitted on training split; used by both Stage 1 and Stage 2
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


# ---------------------------------------------------------------------------
# Label normalisation map
# CICIDS2017 uses slightly inconsistent label strings across CSV files.
# Map every variant to a canonical short name so the LabelEncoder is stable.
# ---------------------------------------------------------------------------
LABEL_VARIANTS: dict[str, str] = {
    "BENIGN":                           "BENIGN",
    "Bot":                              "Bot",
    "DDoS":                             "DDoS",
    "DoS GoldenEye":                    "DoS GoldenEye",
    "DoS Hulk":                         "DoS Hulk",
    "DoS Slowhttptest":                 "DoS Slowhttptest",
    "DoS slowloris":                    "DoS Slowloris",
    "DoS Slowloris":                    "DoS Slowloris",
    "FTP-Patator":                      "FTP-Patator",
    "Heartbleed":                       "Heartbleed",
    "Infiltration":                     "Infiltration",
    "PortScan":                         "PortScan",
    "SSH-Patator":                      "SSH-Patator",
    "Web Attack \x96 Brute Force":      "Web Attack - Brute Force",
    "Web Attack – Brute Force":         "Web Attack - Brute Force",
    "Web Attack - Brute Force":         "Web Attack - Brute Force",
    "Web Attack \x96 SQL Injection":    "Web Attack - SQL Injection",
    "Web Attack – SQL Injection":       "Web Attack - SQL Injection",
    "Web Attack - SQL Injection":       "Web Attack - SQL Injection",
    "Web Attack \x96 XSS":             "Web Attack - XSS",
    "Web Attack – XSS":                "Web Attack - XSS",
    "Web Attack - XSS":                "Web Attack - XSS",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train XGBoost Stage 1 classifier on CICIDS2017.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--data-path", required=True,
                        help="Directory containing CICIDS2017 CSV files.")
    parser.add_argument("--output-dir", default="ml/artifacts",
                        help="Directory where model artifacts will be saved.")
    parser.add_argument("--n-estimators", type=int, default=300,
                        help="Number of XGBoost boosting rounds.")
    parser.add_argument("--max-depth", type=int, default=6,
                        help="Maximum tree depth.")
    parser.add_argument("--learning-rate", type=float, default=0.1)
    parser.add_argument("--subsample", type=float, default=0.8)
    parser.add_argument("--colsample-bytree", type=float, default=0.8)
    parser.add_argument("--early-stopping-rounds", type=int, default=20,
                        help="Stop early if test loss doesn't improve.")
    parser.add_argument("--test-split", type=float, default=0.2)
    parser.add_argument("--random-seed", type=int, default=42)
    parser.add_argument("--shap-sample", type=int, default=2000,
                        help="Number of test rows to use for SHAP summary plot.")
    parser.add_argument("--no-shap", action="store_true",
                        help="Skip SHAP summary plot (faster, less memory).")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    # Force UTF-8 output so em-dashes and other Unicode survive on Windows cp1252
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

    print("=" * 60)
    print("IDS - Stage 1 XGBoost Classifier Training")
    print("=" * 60)
    print(f"  data_path:      {args.data_path}")
    print(f"  output_dir:     {args.output_dir}")
    print(f"  n_estimators:   {args.n_estimators}")
    print(f"  max_depth:      {args.max_depth}")
    print(f"  learning_rate:  {args.learning_rate}")
    print(f"  test_split:     {args.test_split}")
    print(f"  random_seed:    {args.random_seed}")
    print()

    # ------------------------------------------------------------------
    # Step 1: Load CSVs
    # ------------------------------------------------------------------
    import pandas as pd
    from pathlib import Path as P

    csv_files = sorted(P(args.data_path).glob("*.csv"))
    if not csv_files:
        sys.exit(f"[ERROR] No CSV files found in: {args.data_path}")

    print(f"[1/8] Loading {len(csv_files)} CSV file(s)...")
    t0 = time.time()
    chunks: list[pd.DataFrame] = []
    for f in csv_files:
        print(f"      reading {f.name} ...", end=" ", flush=True)
        # CSVs are UTF-8; the en-dash in Web Attack labels is U+FFFD (corrupted at source)
        df_part = pd.read_csv(f, low_memory=False, encoding="utf-8")
        print(f"{len(df_part):,} rows")
        chunks.append(df_part)
    df = pd.concat(chunks, ignore_index=True)
    print(f"      Total: {len(df):,} rows  ({time.time()-t0:.1f}s)\n")

    # ------------------------------------------------------------------
    # Step 2: Preprocess
    # ------------------------------------------------------------------
    print("[2/8] Preprocessing ...")

    # Strip whitespace from column names (CICFlowMeter quirk)
    df.columns = df.columns.str.strip()

    # Drop the duplicate "Fwd Header Length" column produced by CICFlowMeter v3
    df = df.loc[:, ~df.columns.duplicated()]

    # Replace Inf with NaN, then drop
    import numpy as np
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    n_before = len(df)
    df.dropna(inplace=True)
    print(f"      Dropped {n_before - len(df):,} rows with NaN/Inf  "
          f"({len(df):,} remaining)\n")

    # ------------------------------------------------------------------
    # Step 3: Feature selection + label normalisation
    # ------------------------------------------------------------------
    print("[3/8] Selecting features and normalising labels ...")

    from feature_extraction.feature_names import FEATURE_NAMES

    # Verify all features are present after deduplication
    missing_cols = [c for c in FEATURE_NAMES if c not in df.columns]
    if missing_cols:
        sys.exit(
            f"[ERROR] {len(missing_cols)} feature column(s) not found in CSV.\n"
            f"  Missing: {missing_cols[:5]}{'...' if len(missing_cols)>5 else ''}\n"
            f"  Available columns: {list(df.columns[:10])} ..."
        )

    X = df[FEATURE_NAMES].values.astype("float32")

    # Normalise label strings
    raw_labels = df["Label"].str.strip().values
    y_str = np.array([LABEL_VARIANTS.get(lbl, lbl) for lbl in raw_labels])

    unique_labels, counts = np.unique(y_str, return_counts=True)
    print(f"      {len(unique_labels)} classes found:")
    for lbl, cnt in zip(unique_labels, counts):
        print(f"        {lbl:<40} {cnt:>10,}")
    print()

    # ------------------------------------------------------------------
    # Step 4: Encode labels + train/test split
    # ------------------------------------------------------------------
    print("[4/8] Encoding labels and splitting data ...")

    from sklearn.preprocessing import LabelEncoder
    from sklearn.model_selection import train_test_split

    encoder = LabelEncoder()
    y = encoder.fit_transform(y_str)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=args.test_split,
        random_state=args.random_seed,
        stratify=y,
    )
    print(f"      Train: {len(X_train):,}   Test: {len(X_test):,}\n")

    # ------------------------------------------------------------------
    # Step 5: Fit StandardScaler (on train split only — no data leakage)
    # ------------------------------------------------------------------
    print("[5/8] Fitting StandardScaler on training data ...")

    from sklearn.preprocessing import StandardScaler
    import joblib

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled  = scaler.transform(X_test)

    scaler_path = os.path.join(args.output_dir, "scaler.pkl")
    joblib.dump(scaler, scaler_path)
    print(f"      Scaler saved → {scaler_path}\n")

    # ------------------------------------------------------------------
    # Step 6: Train RandomForestClassifier
    # ------------------------------------------------------------------
    print("[6/8] Training RandomForestClassifier ...")

    from sklearn.ensemble import RandomForestClassifier

    rf = RandomForestClassifier(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth if args.max_depth > 0 else None,
        random_state=args.random_seed,
        n_jobs=-1,
        verbose=1,
    )

    t_train = time.time()
    rf.fit(X_train_scaled, y_train)
    print(f"\n      Training complete in {time.time()-t_train:.1f}s\n")

    # ------------------------------------------------------------------
    # Step 7: Evaluate
    # ------------------------------------------------------------------
    print("[7/8] Evaluating on test set ...")

    from sklearn.metrics import classification_report, confusion_matrix

    y_pred = rf.predict(X_test_scaled)

    print(classification_report(
        y_test, y_pred,
        target_names=encoder.classes_,
        digits=4,
        zero_division=0,
    ))

    acc = (y_pred == y_test).mean()
    print(f"      Overall accuracy: {acc*100:.3f}%\n")

    # ------------------------------------------------------------------
    # Step 8: Save model artifacts
    # ------------------------------------------------------------------
    print("[8/8] Saving model artifacts ...")

    model_path   = os.path.join(args.output_dir, "classifier.joblib")
    model_path_pkl = os.path.join(args.output_dir, "classifier.pkl")
    encoder_path = os.path.join(args.output_dir, "classifier_encoder.pkl")

    joblib.dump(rf, model_path)
    joblib.dump(rf, model_path_pkl)
    joblib.dump(encoder, encoder_path)

    print(f"      Classifier model  → {model_path}")
    print(f"      Label encoder     → {encoder_path}")
    print(f"      Scaler            → {scaler_path}")
    print(f"\n      Classes ({len(encoder.classes_)}): {list(encoder.classes_)}\n")

    # Save feature importances as fallback explainability
    try:
        importances = rf.feature_importances_
        importances_data = {
            "feature_names": FEATURE_NAMES,
            "importances": importances.tolist(),
            "explanation_type": "global_feature_importance",
            "is_global_fallback": True,
            "note": "Global feature importance fallback from RandomForest (not per-alert SHAP values)",
        }
        imp_path = os.path.join(args.output_dir, "feature_importances.json")
        with open(imp_path, "w") as f:
            json.dump(importances_data, f, indent=2)
        print(f"      Global feature importances saved → {imp_path}\n")
    except Exception as e:
        print(f"      [WARN] Feature importances save failed: {e}\n")

    print("=" * 60)
    print("Training complete. Artifacts:")
    print(f"  {model_path}")
    print(f"  {encoder_path}")
    print(f"  {scaler_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()

