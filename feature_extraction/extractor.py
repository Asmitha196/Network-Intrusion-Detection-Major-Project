"""
feature_extraction/extractor.py — Flow dict → normalised feature vector.

Converts a raw flow dict (produced by FlowBuilder or ingested via API) into a
numpy array whose columns correspond 1-to-1 with FEATURE_NAMES (76 deduplicated features).

Applies the fitted StandardScaler loaded from ml/artifacts/scaler.pkl.
"""
from __future__ import annotations

import logging
import os
from typing import Any

import numpy as np
import joblib

from feature_extraction.feature_names import FEATURE_NAMES

logger = logging.getLogger(__name__)

_scaler: Any | None = None


def _get_scaler() -> Any | None:
    """Lazily load and cache the StandardScaler fitted during model training."""
    global _scaler
    if _scaler is None:
        scaler_path = os.getenv("SCALER_PATH", "ml/artifacts/scaler.pkl")
        if os.path.exists(scaler_path):
            try:
                _scaler = joblib.load(scaler_path)
                logger.info("StandardScaler loaded successfully from %s", scaler_path)
            except Exception as e:
                logger.warning("Failed to load StandardScaler from %s: %s", scaler_path, e)
    return _scaler


def extract_features(flow: dict[str, Any]) -> np.ndarray:
    """
    Convert a raw flow dict into a scaled (1, 76) numpy feature array.

    Args:
        flow: Raw flow dict (from FlowBuilder or API payload).
              Keys match FEATURE_NAMES; missing keys default to 0.0.

    Returns:
        np.ndarray of shape (1, 76), dtype float32, scaled using StandardScaler.
    """
    raw = np.array(
        [float(flow.get(name, 0.0)) for name in FEATURE_NAMES], dtype=np.float32
    ).reshape(1, -1)

    # Sanitize NaN / Inf
    raw = np.nan_to_num(raw, nan=0.0, posinf=0.0, neginf=0.0)

    scaler = _get_scaler()
    if scaler is not None:
        try:
            return scaler.transform(raw).astype(np.float32)
        except Exception as e:
            logger.warning("Scaling failed: %s — returning raw vector", e)

    return raw

