"""
ml/explainer.py — Feature importance explainer for Stage 1 (RandomForest) alerts.

Uses sklearn's feature_importances_ as the explainability fallback,
clearly labeled as global feature importance (not per-alert SHAP),
allowing accurate reporting of this design limitation.

Output schema stored in Alert.shap_values (JSONB):
    {
        "feature_names": ["Flow Duration", "Total Fwd Packets", ...],  # 76 names
        "shap_values":   [0.12, 0.05, ...],                           # 76 global feature importance values
        "base_value":    0.0,
        "explanation_type": "global_feature_importance",
        "is_global_fallback": True,
        "note": "Global feature importance fallback from RandomForest (not per-alert SHAP values)"
    }
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Optional

import numpy as np

from feature_extraction.feature_names import FEATURE_NAMES

if TYPE_CHECKING:
    from ml.classifier import XGBoostClassifier

logger = logging.getLogger(__name__)


class SHAPExplainer:
    """
    Wraps global feature importance extraction from the Stage 1 RandomForest model.
    Maintains class name SHAPExplainer for backward compatibility across the codebase.
    """

    def __init__(self, classifier: "XGBoostClassifier") -> None:
        self._classifier = classifier
        self._feature_importances: Optional[np.ndarray] = None
        self._explainer_obj: Optional[object] = None

        if classifier._is_loaded and classifier._model is not None:
            self._init_explainer()
        else:
            logger.warning(
                "SHAPExplainer: classifier not yet loaded — "
                "call _init_explainer() after classifier.load()."
            )

    @property
    def _explainer(self) -> Optional[object]:
        if self._explainer_obj is not None:
            return self._explainer_obj
        return self._feature_importances

    def _init_explainer(self) -> None:
        """Extract global feature importances from the loaded classifier."""
        try:
            importances = self._classifier.get_feature_importances()
            if importances is not None:
                self._feature_importances = importances
                self._explainer_obj = importances
                logger.info("SHAPExplainer (Global Feature Importance Fallback) initialised.")
            else:
                logger.warning("Classifier does not expose feature_importances_.")
        except Exception as e:
            logger.error("Failed to initialise SHAPExplainer fallback: %s", e)

    def explain(self, features: np.ndarray, predicted_class_idx: int = 0) -> dict:
        """
        Return global feature importances clearly labeled as a fallback.

        Args:
            features:            np.ndarray of shape (1, 76), dtype float32 (scaled).
            predicted_class_idx: Integer class index of the predicted attack type.

        Returns:
            dict with keys matching ShapExplanation schema plus global fallback annotations.
        """
        # Re-check importances if they were not cached yet
        if self._feature_importances is None and self._classifier._is_loaded:
            self._init_explainer()

        if self._feature_importances is not None:
            importances = self._feature_importances.tolist()
        else:
            importances = [0.0] * len(FEATURE_NAMES)

        return {
            "feature_names": FEATURE_NAMES,
            "shap_values": importances,
            "base_value": 0.0,
            "explanation_type": "global_feature_importance",
            "is_global_fallback": True,
            "note": "Global feature importance fallback from RandomForest (not per-alert SHAP values)",
        }

