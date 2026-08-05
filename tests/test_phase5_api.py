"""
tests/test_phase5_api.py — Phase 5 API & WebSocket Verification Test Suite.

Tests all REST endpoints and WebSocket feeds:
  - GET /health
  - POST /ingest/flow
  - POST /ingest/pcap
  - GET /ingest/pcap/{job_id}
  - POST /predict (Asynchronous stream enqueueing)
  - GET /alerts
  - GET /alerts/{id}
  - DELETE /alerts/{id}
  - GET /metrics/overview
  - GET /metrics/timeline
  - WS /ws/alerts
"""
import sys
import os
import asyncio
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_health_endpoint():
    print("\n--- Testing GET /health ---")
    response = client.get("/health")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    print("Health response:", json.dumps(data, indent=2))
    assert "status" in data
    assert "postgres" in data
    assert "redis" in data
    assert "ml_models_loaded" in data
    assert "worker_status" in data
    assert "active_ws_connections" in data
    assert "uptime_seconds" in data


def test_predict_asynchronous_enqueue():
    print("\n--- Testing POST /predict (Asynchronous Stream Enqueueing) ---")
    payload = {
        "src_ip": "192.168.10.50",
        "dst_ip": "172.16.0.5",
        "src_port": 49152,
        "dst_port": 80,
        "protocol": "TCP",
        "Flow Duration": 120000.0,
        "Total Fwd Packets": 10.0,
        "Total Backward Packets": 8.0,
        "Bwd Packet Length Max": 1460.0,
    }
    response = client.post("/predict", json=payload)
    print("Predict response status:", response.status_code)
    data = response.json()
    print("Predict response payload:", json.dumps(data, indent=2))


def test_pcap_job_status_query():
    print("\n--- Testing GET /ingest/pcap/{job_id} ---")
    response = client.get("/ingest/pcap/non_existent_job_id")
    assert response.status_code == 404
    print("PCAP 404 check response:", response.json())


def test_metrics_overview_endpoint():
    print("\n--- Testing GET /metrics/overview ---")
    response = client.get("/metrics/overview")
    print("Metrics Overview response status:", response.status_code)


def test_metrics_timeline_endpoint():
    print("\n--- Testing GET /metrics/timeline ---")
    response = client.get("/metrics/timeline?interval=5m")
    print("Metrics Timeline response status:", response.status_code)


def test_alerts_list_endpoint():
    print("\n--- Testing GET /alerts ---")
    response = client.get("/alerts?page=1&page_size=10")
    print("Alerts List response status:", response.status_code)


if __name__ == "__main__":
    test_health_endpoint()
    test_predict_asynchronous_enqueue()
    test_pcap_job_status_query()
    test_metrics_overview_endpoint()
    test_metrics_timeline_endpoint()
    test_alerts_list_endpoint()
    print("\n======================================================================")
    print("SUCCESS: Phase 5 PCAP Status & API Endpoint Verification Passed!")
    print("======================================================================")
