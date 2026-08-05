"""
ingestion/replay.py — pcap file replay stub.

Reads packets from a .pcap file and replays them at configurable speed,
calling a callback for each packet.  Used for demos and offline testing.

Activated when CAPTURE_MODE=replay in .env.
Requires: scapy (pip), libpcap-dev (system).

TODO — Implementation steps:
  1. Load the pcap with Scapy:
         from scapy.all import rdpcap
         packets = rdpcap(pcap_path)
  2. Compute inter-packet delays from packet timestamps:
         delay = (pkt[i+1].time - pkt[i].time) / speed_multiplier
  3. For each packet in order:
         callback(pkt)
         time.sleep(max(0, delay))
  4. speed_multiplier=0 means replay as fast as possible (no sleep).
  5. Run in a thread so the main event loop stays unblocked.
  6. Accept a stop_event: threading.Event so the loop can be cancelled cleanly.
"""
from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import Any

logger = logging.getLogger(__name__)


def replay_pcap(
    pcap_path: str,
    callback: Callable[[Any], None],
    speed_multiplier: float = 1.0,
) -> None:
    """
    Replay packets from a .pcap file, calling `callback` for each packet.

    Args:
        pcap_path:         Absolute path to the .pcap file.
        callback:          Function that accepts a single Scapy Packet object.
        speed_multiplier:  1.0 = real-time; 2.0 = double speed; 0 = max speed.

    Raises:
        NotImplementedError: Until Scapy pcap reading is implemented.
        FileNotFoundError:   If pcap_path does not exist.

    TODO:
      - Import scapy.all.rdpcap
      - Read packets and compute per-packet timing delays
      - Loop with time.sleep(delay / speed_multiplier) between packets
      - Accept and honour a threading.Event for clean cancellation
    """
    logger.warning(
        "replay_pcap: pcap replay not yet implemented. "
        "pcap_path=%s speed_multiplier=%s",
        pcap_path,
        speed_multiplier,
    )
    raise NotImplementedError(
        "pcap replay is not yet implemented. "
        "See ingestion/replay.py for TODO instructions."
    )
