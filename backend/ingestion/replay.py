"""
ingestion/replay.py — PCAP File Replay & Parsing Engine.

Parses .pcap / .pcapng files, aggregates packets into 5-tuple bidirectional flows
using FlowBuilder, and extracts the 76 canonical CICIDS2017 features.
"""
from __future__ import annotations

import logging
import os
import time
from collections.abc import Callable
from typing import Any, List, Dict

from scapy.all import PcapReader, rdpcap
from feature_extraction.flow_builder import FlowBuilder

logger = logging.getLogger(__name__)


def parse_pcap(pcap_path: str) -> List[Dict[str, Any]]:
    """
    Parse a .pcap / .pcapng file, aggregate packets into flows using FlowBuilder,
    and return a list of flow feature dictionaries ready for ML inference.
    """
    if not os.path.exists(pcap_path):
        raise FileNotFoundError(f"PCAP file not found: {pcap_path}")

    logger.info("Reading PCAP file: %s", pcap_path)
    builder = FlowBuilder()

    try:
        # Use streaming PcapReader to avoid high memory consumption on large PCAP files
        with PcapReader(pcap_path) as pcap_reader:
            for pkt in pcap_reader:
                builder.add_packet(pkt)
    except Exception as e:
        logger.warning("Error reading PCAP with PcapReader: %s. Retrying with rdpcap...", e)
        try:
            packets = rdpcap(pcap_path)
            for pkt in packets:
                builder.add_packet(pkt)
        except Exception as ex:
            logger.error("Failed to parse PCAP file %s: %s", pcap_path, ex)
            raise RuntimeError(f"Failed to parse PCAP file: {ex}") from ex

    flows = builder.flush_expired_flows(force_all=True)
    logger.info("Successfully extracted %d flows from PCAP file: %s", len(flows), pcap_path)
    return flows


def replay_pcap(
    pcap_path: str,
    callback: Callable[[Any], None],
    speed_multiplier: float = 1.0,
) -> None:
    """
    Replay packets from a .pcap file, calling `callback` for each packet.
    """
    if not os.path.exists(pcap_path):
        raise FileNotFoundError(f"PCAP file not found: {pcap_path}")

    logger.info("Starting PCAP replay for %s (speed=%s)...", pcap_path, speed_multiplier)
    packets = rdpcap(pcap_path)
    
    if not packets:
        logger.warning("No packets found in PCAP file: %s", pcap_path)
        return

    last_ts: float | None = None

    for pkt in packets:
        current_ts = float(getattr(pkt, "time", time.time()))
        if last_ts is not None and speed_multiplier > 0:
            delay = (current_ts - last_ts) / speed_multiplier
            if delay > 0:
                time.sleep(min(delay, 1.0))  # Cap delay to max 1s per packet
        
        last_ts = current_ts
        callback(pkt)

    logger.info("Completed PCAP replay for %s", pcap_path)
