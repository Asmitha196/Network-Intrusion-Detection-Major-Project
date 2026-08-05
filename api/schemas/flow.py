"""
api/schemas/flow.py — Pydantic v2 input schema for a single network flow.

FlowFeatures maps to the 78 CICFlowMeter-style features defined in
feature_extraction/feature_names.FEATURE_NAMES, plus metadata fields
(src_ip, dst_ip, src_port, dst_port, protocol) for storage and display.

All numeric feature fields default to 0.0 so partial payloads can be
accepted during development / testing.  Production ingestion should always
provide all 78 values.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class FlowFeatures(BaseModel):
    """
    A single bidirectional network flow with all 76 CICFlowMeter features (deduplicated).
    Used as the request body for POST /ingest/flow and POST /predict.
    """

    model_config = ConfigDict(frozen=True)

    # --- Metadata (not fed to the model, used for storage and display) --------
    src_ip: str = Field(default="0.0.0.0", description="Source IP address.")
    dst_ip: str = Field(default="0.0.0.0", description="Destination IP address.")
    src_port: int = Field(default=0, ge=0, le=65535)
    dst_port: int = Field(default=0, ge=0, le=65535)
    protocol: str = Field(default="TCP", description="Transport protocol (TCP/UDP/ICMP).")

    # --- CICFlowMeter features (78 total) ------------------------------------
    flow_duration: float = Field(default=0.0, alias="Flow Duration")
    total_fwd_packets: float = Field(default=0.0, alias="Total Fwd Packets")
    total_bwd_packets: float = Field(default=0.0, alias="Total Backward Packets")
    total_len_fwd_packets: float = Field(default=0.0, alias="Total Length of Fwd Packets")
    total_len_bwd_packets: float = Field(default=0.0, alias="Total Length of Bwd Packets")
    fwd_pkt_len_max: float = Field(default=0.0, alias="Fwd Packet Length Max")
    fwd_pkt_len_min: float = Field(default=0.0, alias="Fwd Packet Length Min")
    fwd_pkt_len_mean: float = Field(default=0.0, alias="Fwd Packet Length Mean")
    fwd_pkt_len_std: float = Field(default=0.0, alias="Fwd Packet Length Std")
    bwd_pkt_len_max: float = Field(default=0.0, alias="Bwd Packet Length Max")
    bwd_pkt_len_min: float = Field(default=0.0, alias="Bwd Packet Length Min")
    bwd_pkt_len_mean: float = Field(default=0.0, alias="Bwd Packet Length Mean")
    bwd_pkt_len_std: float = Field(default=0.0, alias="Bwd Packet Length Std")
    flow_bytes_per_s: float = Field(default=0.0, alias="Flow Bytes/s")
    flow_pkts_per_s: float = Field(default=0.0, alias="Flow Packets/s")
    flow_iat_mean: float = Field(default=0.0, alias="Flow IAT Mean")
    flow_iat_std: float = Field(default=0.0, alias="Flow IAT Std")
    flow_iat_max: float = Field(default=0.0, alias="Flow IAT Max")
    flow_iat_min: float = Field(default=0.0, alias="Flow IAT Min")
    fwd_iat_total: float = Field(default=0.0, alias="Fwd IAT Total")
    fwd_iat_mean: float = Field(default=0.0, alias="Fwd IAT Mean")
    fwd_iat_std: float = Field(default=0.0, alias="Fwd IAT Std")
    fwd_iat_max: float = Field(default=0.0, alias="Fwd IAT Max")
    fwd_iat_min: float = Field(default=0.0, alias="Fwd IAT Min")
    bwd_iat_total: float = Field(default=0.0, alias="Bwd IAT Total")
    bwd_iat_mean: float = Field(default=0.0, alias="Bwd IAT Mean")
    bwd_iat_std: float = Field(default=0.0, alias="Bwd IAT Std")
    bwd_iat_max: float = Field(default=0.0, alias="Bwd IAT Max")
    bwd_iat_min: float = Field(default=0.0, alias="Bwd IAT Min")
    fwd_psh_flags: float = Field(default=0.0, alias="Fwd PSH Flags")
    bwd_psh_flags: float = Field(default=0.0, alias="Bwd PSH Flags")
    fwd_urg_flags: float = Field(default=0.0, alias="Fwd URG Flags")
    bwd_urg_flags: float = Field(default=0.0, alias="Bwd URG Flags")
    fwd_header_length: float = Field(default=0.0, alias="Fwd Header Length")
    bwd_header_length: float = Field(default=0.0, alias="Bwd Header Length")
    fwd_pkts_per_s: float = Field(default=0.0, alias="Fwd Packets/s")
    bwd_pkts_per_s: float = Field(default=0.0, alias="Bwd Packets/s")
    min_pkt_length: float = Field(default=0.0, alias="Min Packet Length")
    max_pkt_length: float = Field(default=0.0, alias="Max Packet Length")
    pkt_length_mean: float = Field(default=0.0, alias="Packet Length Mean")
    pkt_length_std: float = Field(default=0.0, alias="Packet Length Std")
    pkt_length_variance: float = Field(default=0.0, alias="Packet Length Variance")
    fin_flag_count: float = Field(default=0.0, alias="FIN Flag Count")
    syn_flag_count: float = Field(default=0.0, alias="SYN Flag Count")
    rst_flag_count: float = Field(default=0.0, alias="RST Flag Count")
    psh_flag_count: float = Field(default=0.0, alias="PSH Flag Count")
    ack_flag_count: float = Field(default=0.0, alias="ACK Flag Count")
    urg_flag_count: float = Field(default=0.0, alias="URG Flag Count")
    cwe_flag_count: float = Field(default=0.0, alias="CWE Flag Count")
    ece_flag_count: float = Field(default=0.0, alias="ECE Flag Count")
    down_up_ratio: float = Field(default=0.0, alias="Down/Up Ratio")
    avg_pkt_size: float = Field(default=0.0, alias="Average Packet Size")
    avg_fwd_segment_size: float = Field(default=0.0, alias="Avg Fwd Segment Size")
    avg_bwd_segment_size: float = Field(default=0.0, alias="Avg Bwd Segment Size")
    fwd_avg_bytes_bulk: float = Field(default=0.0, alias="Fwd Avg Bytes/Bulk")
    fwd_avg_pkts_bulk: float = Field(default=0.0, alias="Fwd Avg Packets/Bulk")
    fwd_avg_bulk_rate: float = Field(default=0.0, alias="Fwd Avg Bulk Rate")
    bwd_avg_bytes_bulk: float = Field(default=0.0, alias="Bwd Avg Bytes/Bulk")
    bwd_avg_pkts_bulk: float = Field(default=0.0, alias="Bwd Avg Packets/Bulk")
    bwd_avg_bulk_rate: float = Field(default=0.0, alias="Bwd Avg Bulk Rate")
    subflow_fwd_packets: float = Field(default=0.0, alias="Subflow Fwd Packets")
    subflow_fwd_bytes: float = Field(default=0.0, alias="Subflow Fwd Bytes")
    subflow_bwd_packets: float = Field(default=0.0, alias="Subflow Bwd Packets")
    subflow_bwd_bytes: float = Field(default=0.0, alias="Subflow Bwd Bytes")
    init_win_bytes_fwd: float = Field(default=0.0, alias="Init_Win_bytes_forward")
    init_win_bytes_bwd: float = Field(default=0.0, alias="Init_Win_bytes_backward")
    act_data_pkt_fwd: float = Field(default=0.0, alias="act_data_pkt_fwd")
    min_seg_size_forward: float = Field(default=0.0, alias="min_seg_size_forward")
    active_mean: float = Field(default=0.0, alias="Active Mean")
    active_std: float = Field(default=0.0, alias="Active Std")
    active_max: float = Field(default=0.0, alias="Active Max")
    active_min: float = Field(default=0.0, alias="Active Min")
    idle_mean: float = Field(default=0.0, alias="Idle Mean")
    idle_std: float = Field(default=0.0, alias="Idle Std")
    idle_max: float = Field(default=0.0, alias="Idle Max")
    idle_min: float = Field(default=0.0, alias="Idle Min")

    def to_feature_dict(self) -> dict[str, float]:
        """Return a dict keyed by CICFlowMeter alias names (FEATURE_NAMES order)."""
        return {
            field_info.alias: getattr(self, field_name)
            for field_name, field_info in self.model_fields.items()
            if field_info.alias and field_name not in (
                "src_ip", "dst_ip", "src_port", "dst_port", "protocol"
            )
        }
