import sys
import os
import time
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
import numpy as np
import joblib
from sklearn.metrics import confusion_matrix
from sklearn.model_selection import train_test_split

from feature_extraction.feature_names import FEATURE_NAMES
from scripts.train_classifier import LABEL_VARIANTS

def main():
    print("=" * 60)
    print("Stage 1 (RandomForest) Detailed Error Analysis & Confusion Matrix")
    print("=" * 60)

    data_path = "data/cicids2017"
    artifacts_dir = "ml/artifacts"

    csv_files = sorted(Path(data_path).glob("*.csv"))
    print(f"Loading {len(csv_files)} CSV files...")
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

    print("Evaluating classifier on test split (565,576 samples)...")
    y_pred = clf.predict(X_test_scaled)

    cm = confusion_matrix(y_test, y_pred)
    classes = list(encoder.classes_)

    print("\n" + "=" * 60)
    print("Full Confusion Matrix (Rows = True Label, Cols = Predicted Label)")
    print("=" * 60)
    cm_df = pd.DataFrame(cm, index=classes, columns=classes)
    print(cm_df.to_string())

    # Focus on Web Attack - XSS
    if "Web Attack - XSS" in classes:
        xss_idx = classes.index("Web Attack - XSS")
        xss_true_mask = (y_test == xss_idx)
        xss_counts = pd.Series(y_pred[xss_true_mask]).value_counts()

        print("\n" + "=" * 60)
        print("Breakdown of 'Web Attack - XSS' Predictions:")
        print("=" * 60)
        total_xss = xss_true_mask.sum()
        print(f"Total True 'Web Attack - XSS' samples in test set: {total_xss}")
        for pred_class_idx, count in xss_counts.items():
            pred_label = classes[pred_class_idx]
            pct = 100.0 * count / total_xss
            print(f"  -> Predicted as '{pred_label}': {count} ({pct:.2f}%)")

if __name__ == "__main__":
    main()
