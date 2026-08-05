"""
ml/pipeline.py — Hybrid detection pipeline orchestrator.

Decision logic:
  1. Run Stage 1 (XGBoost).
     - attack_type != "BENIGN" AND confidence >= STAGE1_CONFIDENCE_THRESHOLD
         → Known attack.  Compute SHAP.  Return stage=1 alert.
     - attack_type == "BENIGN" OR confidence < STAGE1_CONFIDENCE_THRESHOLD
         → Uncertain.  Escalate to Stage 2.

  2. Run Stage 2 (Autoencoder).
     - is_anomaly == True
         → Zero-day / novel.  Return stage=2 alert (no SHAP, use recon_error).
     - is_anomaly == False
         → Benign.  Return stage=1 BENIGN alert.

Severity mapping (both stages):
    confidence >= 0.90  → critical
    confidence >= 0.70  → high
    confidence >= 0.50  → medium
    below 0.50          → low

    For Stage 2: confidence = min(1.0, reconstruction_error / threshold)

Called by:
    api/routers/prediction.py   (synchronous /predict endpoint)
    workers/flow_consumer.py    (async stream-processing loop)
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import numpy as np

from ml.anomaly_detector import AutoencoderDetector
from ml.classifier import XGBoostClassifier
from ml.explainer import SHAPExplainer

logger = logging.getLogger(__name__)

_DEFAULT_CONFIDENCE_THRESHOLD = 0.70


class DetectionPipeline:
    """
    Singleton-style orchestrator: load models once, call run() per flow.

    Usage:
        pipeline = DetectionPipeline()
        alert_dict = pipeline.run(features)
    """

    def __init__(self) -> None:
        self._confidence_threshold = float(
            os.getenv("STAGE1_CONFIDENCE_THRESHOLD", str(_DEFAULT_CONFIDENCE_THRESHOLD))
        )

        classifier_path    = os.getenv("CLASSIFIER_MODEL_PATH",
                                        "ml/artifacts/classifier.joblib")
        autoencoder_path   = os.getenv("AUTOENCODER_MODEL_PATH",
                                        "ml/artifacts/autoencoder.pt")
        autoencoder_thresh = float(os.getenv("AUTOENCODER_THRESHOLD", "0.05"))

        self._classifier = XGBoostClassifier(model_path=classifier_path)
        self._detector   = AutoencoderDetector(
            model_path=autoencoder_path,
            threshold=autoencoder_thresh,
        )
        self._explainer: Optional[SHAPExplainer] = None

        # Load models (gracefully no-ops if artifacts don't exist yet)
        self._classifier.load()
        self._detector.load()

        # Only initialise SHAP if the classifier loaded successfully
        if self._classifier._is_loaded:
            self._explainer = SHAPExplainer(self._classifier)

        loaded = (
            f"classifier={'✓' if self._classifier._is_loaded else '✗'}  "
            f"autoencoder={'✓' if self._detector._is_loaded else '✗'}  "
            f"shap={'✓' if self._explainer and self._explainer._explainer is not None else '✗'}"
        )
        logger.info("DetectionPipeline ready — %s", loaded)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _severity(confidence: float) -> str:
        if confidence >= 0.90:
            return "critical"
        if confidence >= 0.70:
            return "high"
        if confidence >= 0.50:
            return "medium"
        return "low"

    @staticmethod
    def _raw_features_dict(features: np.ndarray) -> dict:
        from feature_extraction.feature_names import FEATURE_NAMES
        return {
            name: float(features[0, i])
            for i, name in enumerate(FEATURE_NAMES)
            if features.shape[1] > i
        }

    # ------------------------------------------------------------------
    # Main pipeline entry point
    # ------------------------------------------------------------------
    def run(self, features: np.ndarray) -> dict:
        """
        Run the full hybrid detection pipeline on a single (1, 76) feature array.

        Args:
            features: np.ndarray of shape (1, 76), dtype float32, already scaled
                      by the StandardScaler from ml/artifacts/scaler.pkl.

        Returns:
            Alert dict compatible with api/schemas/alert.AlertOut and db/models.Alert:
            {
                "id":                   uuid.UUID,
                "timestamp":            datetime (UTC),
                "stage":                int (1 or 2),
                "attack_type":          str | None,
                "confidence":           float,
                "severity":             str,
                "reconstruction_error": float | None,
                "shap_values":          dict | None,
                "raw_features":         dict,
            }
        """
        raw_features = self._raw_features_dict(features)

        # ------------------------------------------------------------------
        # Stage 1: XGBoost classifier
        # ------------------------------------------------------------------
        attack_type, confidence = self._classifier.predict(features)

        is_known_attack = (
            attack_type != "BENIGN"
            and confidence >= self._confidence_threshold
        )

        if is_known_attack:
            # Known attack — compute SHAP for explainability
            shap_values: Optional[dict] = None
            if self._explainer is not None:
                # Get predicted class index for per-class SHAP selection
                from ml.classifier import LABEL_MAP
                class_idx = next(
                    (k for k, v in LABEL_MAP.items() if v == attack_type), 0
                )
                shap_values = self._explainer.explain(features, class_idx)

            return {
                "id":                   uuid.uuid4(),
                "timestamp":            datetime.now(timezone.utc),
                "stage":                1,
                "attack_type":          attack_type,
                "confidence":           confidence,
                "severity":             self._severity(confidence),
                "reconstruction_error": None,
                "shap_values":          shap_values,
                "raw_features":         raw_features,
            }

        # ------------------------------------------------------------------
        # Stage 2: Autoencoder anomaly detector
        # Escalate when Stage 1 says BENIGN or is below confidence threshold
        # ------------------------------------------------------------------
        is_anomaly, recon_error = self._detector.detect(features)

        if is_anomaly:
            # Derive pseudo-confidence from how far above threshold the error is
            stage2_confidence = min(1.0, recon_error / max(self._detector.threshold, 1e-9))
            return {
                "id":                   uuid.uuid4(),
                "timestamp":            datetime.now(timezone.utc),
                "stage":                2,
                "attack_type":          None,   # unknown by definition
                "confidence":           stage2_confidence,
                "severity":             self._severity(stage2_confidence),
                "reconstruction_error": recon_error,
                "shap_values":          None,
                "raw_features":         raw_features,
            }

        # ------------------------------------------------------------------
        # Benign — neither stage flagged this flow
        # ------------------------------------------------------------------
        return {
            "id":                   uuid.uuid4(),
            "timestamp":            datetime.now(timezone.utc),
            "stage":                1,
            "attack_type":          "BENIGN",
            "confidence":           confidence,
            "severity":             "low",
            "reconstruction_error": None,
            "shap_values":          None,
            "raw_features":         raw_features,
        }
