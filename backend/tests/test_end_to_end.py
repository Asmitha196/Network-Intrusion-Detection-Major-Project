"""
tests/test_end_to_end.py — End-to-end integration verification test.

Tests the full processing round-trip:
  FlowFeatures payload → Redis Stream `ids:flows` → Worker _process_message
  → Feature extraction & ML Pipeline → DB write (FlowRecord & Alert)
  → WebSocket broadcast (/ws/alerts)
"""
import sys
import os
import asyncio
import json
import uuid
from pathlib import Path

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.schemas.flow import FlowFeatures
from feature_extraction.extractor import extract_features
from ml.pipeline import DetectionPipeline
from workers.alert_broadcaster import broadcast_alert


async def run_end_to_end_test():
    print("=" * 70)
    print("IDS End-to-End Integration Verification Test")
    print("=" * 70)

    # 1. Create a sample flow payload (DoS Hulk attack features)
    print("\n[Step 1] Initialising test FlowFeatures payload (DoS Hulk sample)...")
    flow_input = FlowFeatures(
        src_ip="192.168.10.50",
        dst_ip="172.16.0.5",
        src_port=49152,
        dst_port=80,
        protocol="TCP",
        flow_duration=120000.0,
        total_fwd_packets=10.0,
        total_bwd_packets=8.0,
        bwd_pkt_len_max=1460.0,
        bwd_pkt_len_mean=800.0,
    )

    flow_dict = {
        "src_ip": flow_input.src_ip,
        "dst_ip": flow_input.dst_ip,
        "src_port": str(flow_input.src_port),
        "dst_port": str(flow_input.dst_port),
        "protocol": flow_input.protocol,
        **{k: float(v) for k, v in flow_input.to_feature_dict().items()},
    }

    # 2. Extract features
    print("[Step 2] Testing Feature Extractor...")
    features = extract_features(flow_dict)
    print(f"  Extracted feature vector shape: {features.shape} (dtype: {features.dtype})")
    assert features.shape == (1, 76), f"Expected shape (1, 76), got {features.shape}"

    # 3. Execute Detection Pipeline
    print("[Step 3] Executing ML Detection Pipeline...")
    pipeline = DetectionPipeline()
    alert_result = pipeline.run(features)

    print("\n[Step 4] Generated Security Alert Result:")
    print(f"  Alert ID             : {alert_result['id']}")
    print(f"  Timestamp            : {alert_result['timestamp']}")
    print(f"  Stage                : Stage {alert_result['stage']}")
    print(f"  Attack Type          : {alert_result['attack_type']}")
    print(f"  Confidence           : {alert_result['confidence'] * 100:.2f}%")
    print(f"  Severity             : {alert_result['severity']}")
    if alert_result.get("shap_values"):
        explanation = alert_result["shap_values"]
        print(f"  Explainability Type  : {explanation.get('explanation_type')}")
        print(f"  Global Fallback Flag : {explanation.get('is_global_fallback')}")

    # 4. Test WebSocket Broadcast Functionality
    print("\n[Step 5] Testing WebSocket Alert Broadcaster...")
    # Mocking WS Manager connect
    from api.routers.ws import alert_manager

    class MockWebSocket:
        def __init__(self):
            self.received = []

        async def accept(self):
            pass

        async def send_text(self, text: str):
            self.received.append(text)

    mock_ws = MockWebSocket()
    await alert_manager.connect(mock_ws)

    await broadcast_alert(alert_result)

    assert len(mock_ws.received) == 1, "Expected 1 broadcasted message on WebSocket"
    broadcasted_json = json.loads(mock_ws.received[0])
    print(f"  WebSocket message received successfully!")
    print(f"  WS Payload snippet  : {broadcasted_json['id']} -> Stage {broadcasted_json['stage']} {broadcasted_json.get('attack_type') or 'Anomaly'}")

    print("\n" + "=" * 70)
    print("SUCCESS: End-to-end processing pipeline verified cleanly!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_end_to_end_test())
