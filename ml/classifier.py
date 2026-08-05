"""
ml/classifier.py — Stage 1: RandomForest multi-class classifier.

Loaded at runtime from ml/artifacts/classifier.joblib (or classifier.pkl)
and ml/artifacts/classifier_encoder.pkl (sklearn LabelEncoder).

Produced by: scripts/train_classifier.py
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CICIDS2017 canonical label map (matches LABEL_VARIANTS in train_classifier.py)
# Overwritten at load time from the actual fitted LabelEncoder.
# ---------------------------------------------------------------------------
LABEL_MAP: dict[int, str] = {
    0: "BENIGN",
    1: "Bot",
    2: "DDoS",
    3: "DoS GoldenEye",
    4: "DoS Hulk",
    5: "DoS Slowhttptest",
    6: "DoS Slowloris",
    7: "FTP-Patator",
    8: "Heartbleed",
    9: "Infiltration",
    10: "PortScan",
    11: "SSH-Patator",
    12: "Web Attack - Brute Force",
    13: "Web Attack - SQL Injection",
    14: "Web Attack - XSS",
}


class XGBoostClassifier:
    """
    Wraps a RandomForestClassifier for multi-class flow classification.
    Maintains class name XGBoostClassifier for backward compatibility.
    """

    def __init__(self, model_path: str, encoder_path: Optional[str] = None) -> None:
        """
        Args:
            model_path:    Absolute path to the classifier model file (.joblib or .pkl).
            encoder_path:  Path to the classifier_encoder.pkl LabelEncoder.
        """
        self.model_path = model_path
        if encoder_path:
            self.encoder_path = encoder_path
        else:
            base_dir = os.path.dirname(model_path)
            self.encoder_path = os.path.join(base_dir, "classifier_encoder.pkl")

        self._model: Optional[object] = None          # sklearn RandomForestClassifier
        self._label_encoder: Optional[object] = None  # sklearn.LabelEncoder
        self._is_loaded: bool = False

    def load(self) -> None:
        """Load the RandomForestClassifier and LabelEncoder from disk."""
        import joblib

        target_path = self.model_path
        if not os.path.exists(target_path):
            base_dir = os.path.dirname(self.model_path)
            for alt in ["classifier.joblib", "classifier.pkl", "classifier.ubj"]:
                alt_path = os.path.join(base_dir, alt)
                if os.path.exists(alt_path):
                    target_path = alt_path
                    break

        if not os.path.exists(target_path):
            logger.error(
                "Classifier model not found at %s. "
                "Run scripts/train_classifier.py first.",
                self.model_path,
            )
            return

        logger.info("Loading RandomForest classifier from %s", target_path)
        try:
            self._model = joblib.load(target_path)
        except Exception as e:
            logger.error("Failed to load classifier model from %s: %s", target_path, e)
            return

        if os.path.exists(self.encoder_path):
            self._label_encoder = joblib.load(self.encoder_path)
            global LABEL_MAP
            LABEL_MAP = {i: cls for i, cls in enumerate(self._label_encoder.classes_)}
            logger.info(
                "Loaded LabelEncoder with %d classes: %s",
                len(LABEL_MAP),
                list(LABEL_MAP.values()),
            )
        else:
            logger.warning(
                "LabelEncoder not found at %s — using default LABEL_MAP.",
                self.encoder_path,
            )

        self._is_loaded = True
        logger.info("RandomForestClassifier ready.")

    def predict(self, features: np.ndarray) -> tuple[str, float]:
        """
        Classify a single flow.

        Args:
            features: np.ndarray of shape (1, 76), dtype float32, scaled.

        Returns:
            (attack_type, confidence)
              attack_type  — e.g. "DoS Hulk", "BENIGN", "PortScan"
              confidence   — max class probability in [0, 1]
        """
        if not self._is_loaded or self._model is None:
            logger.debug("predict: model not loaded — returning BENIGN/0.0")
            return "BENIGN", 0.0

        proba = self._model.predict_proba(features)   # shape: (1, n_classes)

        class_idx = int(np.argmax(proba[0]))
        confidence = float(proba[0][class_idx])

        if self._label_encoder is not None:
            attack_type = str(self._label_encoder.inverse_transform([class_idx])[0])
        else:
            attack_type = LABEL_MAP.get(class_idx, f"class_{class_idx}")

        return attack_type, confidence

    def get_feature_importances(self) -> np.ndarray | None:
        """Return global feature importances from the fitted RandomForest model."""
        if self._is_loaded and self._model is not None and hasattr(self._model, "feature_importances_"):
            return self._model.feature_importances_
        return None


# Alias for clarity
RandomForestClassifierWrapper = XGBoostClassifier

