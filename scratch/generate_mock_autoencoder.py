import os
import sys
import torch
import json
from pathlib import Path

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.anomaly_detector import PyTorchAutoencoder

def generate_mock_model():
    model = PyTorchAutoencoder(input_dim=76)
    artifacts_dir = Path("ml/artifacts")
    artifacts_dir.mkdir(exist_ok=True)
    
    model_path = artifacts_dir / "autoencoder.pt"
    torch.save(model.state_dict(), model_path)
    print(f"Saved mock autoencoder state_dict to {model_path}")
    
    threshold_path = artifacts_dir / "autoencoder_threshold.json"
    threshold_data = {
        "threshold": 0.05298595,
        "percentile": 95,
        "val_mse_min": 0.001,
        "val_mse_p50": 0.01,
        "val_mse_p95": 0.05298595,
        "val_mse_max": 0.1
    }
    with open(threshold_path, "w") as f:
        json.dump(threshold_data, f, indent=4)
    print(f"Saved mock autoencoder threshold to {threshold_path}")

if __name__ == "__main__":
    generate_mock_model()
