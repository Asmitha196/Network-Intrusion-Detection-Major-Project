from __future__ import annotations

"""
feature_extraction/feature_names.py — Canonical CICFlowMeter feature list.

This module defines the authoritative ordered list of 78 flow-level features
used throughout the IDS system:
  - feature_extraction/extractor.py  — maps flow dicts to this order
  - ml/classifier.py                 — expected input column order for XGBoost
  - ml/explainer.py                  — zips SHAP values with these names
  - scripts/train_classifier.py      — column selection from raw CSV

The names match exactly the column headers produced by CICFlowMeter and
present in the CICIDS2017 dataset CSVs (after stripping leading whitespace).

# =============================================================================
# TODO — UNSW-NB15 dataset support
# =============================================================================
# UNSW-NB15 uses a different feature schema (~49 features with different names,
# e.g. `dur`, `proto`, `spkts`, `dpkts`, `sbytes`, `dbytes`, `rate`, etc.).
#
# If UNSW-NB15 support is added later:
#   1. Define a separate UNSW_FEATURE_NAMES list below.
#   2. Write a mapping function:
#          map_unsw_to_cicids(unsw_row: dict) -> dict
#      that produces values for every name in FEATURE_NAMES where possible,
#      and fills missing features with 0.0 or a learned mean from training.
#   3. Add a --dataset flag to scripts/train_classifier.py to switch schemas.
# =============================================================================
"""

FEATURE_NAMES: list[str] = [
    # Flow identification / duration
    "Flow Duration",
    # Packet counts
    "Total Fwd Packets",
    "Total Backward Packets",
    # Byte totals
    "Total Length of Fwd Packets",
    "Total Length of Bwd Packets",
    # Forward packet length stats
    "Fwd Packet Length Max",
    "Fwd Packet Length Min",
    "Fwd Packet Length Mean",
    "Fwd Packet Length Std",
    # Backward packet length stats
    "Bwd Packet Length Max",
    "Bwd Packet Length Min",
    "Bwd Packet Length Mean",
    "Bwd Packet Length Std",
    # Flow rate
    "Flow Bytes/s",
    "Flow Packets/s",
    # Inter-arrival times (flow)
    "Flow IAT Mean",
    "Flow IAT Std",
    "Flow IAT Max",
    "Flow IAT Min",
    # Inter-arrival times (forward)
    "Fwd IAT Total",
    "Fwd IAT Mean",
    "Fwd IAT Std",
    "Fwd IAT Max",
    "Fwd IAT Min",
    # Inter-arrival times (backward)
    "Bwd IAT Total",
    "Bwd IAT Mean",
    "Bwd IAT Std",
    "Bwd IAT Max",
    "Bwd IAT Min",
    # TCP flags (forward)
    "Fwd PSH Flags",
    "Bwd PSH Flags",
    "Fwd URG Flags",
    "Bwd URG Flags",
    # Header lengths
    "Fwd Header Length",
    "Bwd Header Length",
    # Packet rates
    "Fwd Packets/s",
    "Bwd Packets/s",
    # Packet length distribution (all packets)
    "Min Packet Length",
    "Max Packet Length",
    "Packet Length Mean",
    "Packet Length Std",
    "Packet Length Variance",
    # TCP flag counts (entire flow)
    "FIN Flag Count",
    "SYN Flag Count",
    "RST Flag Count",
    "PSH Flag Count",
    "ACK Flag Count",
    "URG Flag Count",
    "CWE Flag Count",
    "ECE Flag Count",
    # Ratio features
    "Down/Up Ratio",
    "Average Packet Size",
    "Avg Fwd Segment Size",
    "Avg Bwd Segment Size",
    # Bulk transfer features
    "Fwd Avg Bytes/Bulk",
    "Fwd Avg Packets/Bulk",
    "Fwd Avg Bulk Rate",
    "Bwd Avg Bytes/Bulk",
    "Bwd Avg Packets/Bulk",
    "Bwd Avg Bulk Rate",
    # Subflow features
    "Subflow Fwd Packets",
    "Subflow Fwd Bytes",
    "Subflow Bwd Packets",
    "Subflow Bwd Bytes",
    # TCP initial window sizes
    "Init_Win_bytes_forward",
    "Init_Win_bytes_backward",
    # Active / idle time statistics
    "act_data_pkt_fwd",
    "min_seg_size_forward",
    "Active Mean",
    "Active Std",
    "Active Max",
    "Active Min",
    "Idle Mean",
    "Idle Std",
    "Idle Max",
    "Idle Min",
]

# ---------------------------------------------------------------------------
# Note on feature count
# ---------------------------------------------------------------------------
# CICFlowMeter v3 (used to generate CICIDS2017) produces CSVs with 78 columns,
# but two of those are duplicate entries of "Fwd Header Length" (columns 35
# and 57 — a known CICFlowMeter bug).  After deduplication the canonical list
# has 76 unique features.
#
# When loading CICIDS2017 CSVs in training scripts, use:
#     df = df.loc[:, ~df.columns.duplicated()]   # drop duplicate "Fwd Header Length"
# before selecting features, so that X = df[FEATURE_NAMES] resolves correctly.
#
# If you choose to keep the duplicate (e.g. to match a pre-trained model that
# was trained with 78 columns), rename one: "Fwd Header Length.1" and add it
# back here, then update FEATURE_COUNT to 78.
# ---------------------------------------------------------------------------
FEATURE_COUNT: int = len(FEATURE_NAMES)   # 76

assert FEATURE_COUNT == 76, (
    f"FEATURE_NAMES must have exactly 76 unique entries; got {FEATURE_COUNT}. "
    "See the note above about CICFlowMeter duplicate columns."
)
