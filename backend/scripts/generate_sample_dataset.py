import os
import sys
import numpy as np
import pandas as pd
from pathlib import Path

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from feature_extraction.feature_names import FEATURE_NAMES

def generate_dataset(output_dirs=None, samples_per_file=1000):
    if output_dirs is None:
        project_root = Path(__file__).resolve().parent.parent.parent
        output_dirs = [
            project_root / "data" / "cicids2017",
            project_root / "backend" / "data" / "cicids2017"
        ]

    for output_dir in output_dirs:
        os.makedirs(output_dir, exist_ok=True)
        print(f"\nGenerating CICIDS2017 sample dataset files in '{output_dir}'...")

        files_config = {
            "Monday-WorkingHours.pcap_ISCX.csv": [("BENIGN", 1.0)],
            "Tuesday-WorkingHours.pcap_ISCX.csv": [("BENIGN", 0.7), ("FTP-Patator", 0.15), ("SSH-Patator", 0.15)],
            "Wednesday-workingHours.pcap_ISCX.csv": [("BENIGN", 0.5), ("DoS Slowloris", 0.1), ("DoS Slowhttptest", 0.1), ("DoS Hulk", 0.15), ("DoS GoldenEye", 0.1), ("Heartbleed", 0.05)],
            "Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv": [("BENIGN", 0.7), ("Web Attack – Brute Force", 0.15), ("Web Attack – XSS", 0.1), ("Web Attack – SQL Injection", 0.05)],
            "Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv": [("BENIGN", 0.85), ("Infiltration", 0.15)],
            "Friday-WorkingHours-Morning.pcap_ISCX.csv": [("BENIGN", 0.8), ("Bot", 0.2)],
            "Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv": [("BENIGN", 0.6), ("PortScan", 0.4)],
            "Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv": [("BENIGN", 0.5), ("DDoS", 0.5)],
        }

        np.random.seed(42)

        for fname, class_dist in files_config.items():
            filepath = os.path.join(output_dir, fname)
            labels = []

            for label, ratio in class_dist:
                count = int(samples_per_file * ratio)
                labels.extend([label] * count)

            n_samples = len(labels)
            
            # Generate random feature values with realistic scales
            data = np.random.exponential(scale=100.0, size=(n_samples, len(FEATURE_NAMES)))
            
            df_feat = pd.DataFrame(data, columns=FEATURE_NAMES)
            df_feat.insert(34, "Fwd Header Length.1", df_feat["Fwd Header Length"])
            df_feat["Label"] = labels

            # Match exact CICIDS2017 header style (leading space on feature column names)
            df_feat.columns = [f" {col}" if col != "Label" else "Label" for col in df_feat.columns]

            df_feat.to_csv(filepath, index=False)
            print(f"  Created: {fname} ({n_samples} rows, {len(df_feat.columns)} columns)")

    print("\nDataset generation complete! All 8 CSV files created successfully in both root and backend data paths.")

if __name__ == "__main__":
    generate_dataset()
