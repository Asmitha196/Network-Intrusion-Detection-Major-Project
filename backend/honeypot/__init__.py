"""
backend/honeypot — Decoy Server & Honeypot Event Capture Module.
"""
from __future__ import annotations

from honeypot.decoy_server import DecoyServer, get_decoy_server
from honeypot.enrichment import enrich_alert_with_honeypot, correlate_ip_events

__all__ = ["DecoyServer", "get_decoy_server", "enrich_alert_with_honeypot", "correlate_ip_events"]
