"""
ingestion/capture.py — Phase 7 Live Packet Capture Engine & Interface Discovery.
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
import threading
import time
import traceback
from typing import Any, Dict, List, Optional

import psutil
import redis.asyncio as aioredis
from scapy.all import AsyncSniffer, get_working_ifaces, Packet, conf, IFACES
try:
    from scapy.supersocket import L3RawSocket
except ImportError:
    L3RawSocket = None

from scapy.layers.inet import IP, TCP, UDP, ICMP
from scapy.layers.inet6 import IPv6

from feature_extraction.flow_builder import FlowBuilder
from api.dependencies import get_redis_url

logger = logging.getLogger(__name__)


def resolve_scapy_interface(iface_name: str) -> Any:
    """
    Map user-selected interface name (e.g. 'Wi-Fi', 'Ethernet', '10.10.10.73')
    to a Scapy NetworkInterface object or Npcap GUID identifier.
    """
    try:
        # Direct key match in conf.ifaces
        if iface_name in conf.ifaces:
            return conf.ifaces[iface_name]

        # Check IFACES dict if available
        if hasattr(IFACES, "data") and iface_name in IFACES.data:
            return IFACES.data[iface_name]

        # Scan all Scapy known interfaces
        all_scapy_ifaces = list(conf.ifaces.values()) if hasattr(conf, "ifaces") else []
        for dev in all_scapy_ifaces:
            win_name = getattr(dev, 'win_name', '')
            desc = getattr(dev, 'description', '')
            name = getattr(dev, 'name', '')
            pcap_name = getattr(dev, 'pcap_name', '')
            guid = getattr(dev, 'guid', '')
            ip = getattr(dev, 'ip', '')
            ips = getattr(dev, 'ips', [])

            # Match by name / description / GUID
            if iface_name in (win_name, desc, name, pcap_name, guid):
                return dev

            if win_name and iface_name.lower() == win_name.lower():
                return dev

            if desc and iface_name.lower() == desc.lower():
                return dev

            if name and iface_name.lower() == name.lower():
                return dev

            # Match by IP address
            if iface_name in (ip, *ips):
                return dev

        # Check if user passed a friendly name matching a psutil interface IP
        ps_addrs = psutil.net_if_addrs()
        if iface_name in ps_addrs:
            for addr in ps_addrs[iface_name]:
                if getattr(addr, 'family', None) in (2, '2', 'AF_INET'):
                    ip_to_match = addr.address
                    for dev in all_scapy_ifaces:
                        if getattr(dev, 'ip', '') == ip_to_match or ip_to_match in getattr(dev, 'ips', []):
                            return dev

    except Exception as e:
        logger.warning("Scapy interface resolution note: %s", e)

    return iface_name


def enumerate_interfaces() -> List[Dict[str, Any]]:
    """
    Enumerate all available network interfaces on the host system.

    Returns a list of dicts with keys:
        - name: Interface identifier (e.g., 'eth0', 'Wi-Fi', '\\Device\\NPF_...')
        - description: Friendly display name
        - mac_address: MAC hardware address
        - ip_address: IPv4 address assigned to the NIC
        - status: 'up' or 'down'
        - speed: Speed in Mbps or 'N/A'
    """
    interfaces = []

    ps_stats = psutil.net_if_stats()
    ps_addrs = psutil.net_if_addrs()

    # Collect Scapy interfaces index by IP and MAC
    scapy_by_ip: Dict[str, Any] = {}
    scapy_by_mac: Dict[str, Any] = {}
    scapy_by_name: Dict[str, Any] = {}

    try:
        all_scapy = list(conf.ifaces.values()) if hasattr(conf, "ifaces") else []
        for dev in all_scapy:
            dev_ip = getattr(dev, 'ip', None)
            dev_mac = getattr(dev, 'mac', None)
            dev_win_name = getattr(dev, 'win_name', None)
            dev_name = getattr(dev, 'name', None)

            if dev_ip:
                scapy_by_ip[dev_ip] = dev
            for dev_alt_ip in getattr(dev, 'ips', []):
                scapy_by_ip[dev_alt_ip] = dev
            if dev_mac:
                scapy_by_mac[dev_mac.lower()] = dev
            if dev_win_name:
                scapy_by_name[dev_win_name] = dev
            if dev_name:
                scapy_by_name[dev_name] = dev
    except Exception as e:
        logger.debug("Could not index Scapy interfaces: %s", e)

    for iface_name, addrs in ps_addrs.items():
        ip_addr = "0.0.0.0"
        mac_addr = "00:00:00:00:00:00"

        for addr in addrs:
            family_str = str(getattr(addr, 'family', ''))
            if 'INET' in family_str or family_str in ('2', 'AF_INET'):
                ip_addr = addr.address
            elif 'LINK' in family_str or 'PACKET' in family_str or family_str in ('17', '-1', 'AF_LINK'):
                mac_addr = addr.address

        stat = ps_stats.get(iface_name)
        is_up = stat.isup if stat else True
        speed_str = f"{stat.speed} Mbps" if stat and stat.speed > 0 else "N/A"

        # Correlate description from Scapy device if available
        matched_scapy = (
            scapy_by_ip.get(ip_addr) or
            scapy_by_mac.get(mac_addr.lower()) or
            scapy_by_name.get(iface_name)
        )
        desc = getattr(matched_scapy, 'description', iface_name) if matched_scapy else iface_name

        interfaces.append({
            "name": iface_name,
            "description": desc,
            "mac_address": mac_addr,
            "ip_address": ip_addr,
            "status": "up" if is_up else "down",
            "speed": speed_str,
        })

    logger.info("Discovered %d network interfaces", len(interfaces))
    return interfaces


class LiveCaptureEngine:
    """
    Singleton-style continuous live packet capture engine.
    Captures raw Layer 2/Layer 3 network packets from the host interface,
    extracts flow features via FlowBuilder, and streams completed flows to Redis.
    """
    _instance: Optional['LiveCaptureEngine'] = None
    _lock = threading.Lock()

    def __new__(cls) -> 'LiveCaptureEngine':
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._init_engine()
            return cls._instance

    def _init_engine(self) -> None:
        self.active: bool = False
        self.interface: Optional[str] = None
        self.start_time: Optional[float] = None
        self.error_message: Optional[str] = None

        self.total_packets_captured: int = 0
        self.total_flows_processed: int = 0
        self.known_attacks_detected: int = 0
        self.unknown_attacks_detected: int = 0

        self._pkt_window_count: int = 0
        self._flow_window_count: int = 0
        self._bytes_window_count: int = 0
        self._last_rate_calc_time: float = time.time()
        self.packets_per_sec: float = 0.0
        self.flows_per_sec: float = 0.0
        self.bandwidth_bps: float = 0.0

        self._sniffer: Optional[AsyncSniffer] = None
        self._harvest_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._builder = FlowBuilder()
        self._async_loop: Optional[asyncio.AbstractEventLoop] = None

    def start(self, interface_name: str, redis_url: Optional[str] = None) -> Dict[str, Any]:
        if redis_url is None:
            redis_url = get_redis_url()

        with self._lock:
            if self.active:
                return {
                    "status": "error",
                    "message": f"Monitoring is already running on interface '{self.interface}'",
                }

            # Check if pcap provider is available on Windows
            if os.name == "nt" and not getattr(conf, "use_pcap", False):
                err_msg = (
                    "Npcap is required for real-time live network packet capture on Windows. "
                    "Please install Npcap with 'WinPcap API-compatible mode' enabled (installer located at C:\\Users\\Ashmitha\\Downloads\\npcap-installer.exe)."
                )
                logger.error("Cannot start capture: %s", err_msg)
                self.active = False
                self.error_message = err_msg
                return {"status": "error", "message": err_msg}

            self.interface = interface_name
            self.error_message = None
            self._stop_event.clear()

            self.total_packets_captured = 0
            self.total_flows_processed = 0
            self.known_attacks_detected = 0
            self.unknown_attacks_detected = 0
            self._pkt_window_count = 0
            self._flow_window_count = 0
            self._bytes_window_count = 0
            self._last_rate_calc_time = time.time()
            self.packets_per_sec = 0.0
            self.flows_per_sec = 0.0
            self.bandwidth_bps = 0.0

            target_iface = resolve_scapy_interface(interface_name)
            logger.info("Starting AsyncSniffer on interface '%s' (resolved to: %s)...", interface_name, target_iface)

            try:
                self._sniffer = AsyncSniffer(
                    iface=target_iface,
                    prn=self._packet_callback,
                    store=False,
                    filter="ip or ip6",
                )
                self._sniffer.start()

                # Verify sniffer thread successfully started
                time.sleep(0.15)
                if self._sniffer.thread and not self._sniffer.thread.is_alive():
                    raise RuntimeError(f"AsyncSniffer thread failed to start or terminated immediately on interface '{interface_name}'.")

                self.active = True
                self.start_time = time.time()
                logger.info("AsyncSniffer actively running on interface '%s'", interface_name)

            except Exception as e:
                logger.error("AsyncSniffer failed to start on interface '%s': %s", interface_name, e, exc_info=True)
                self.active = False
                self.error_message = f"Failed to start packet capture on '{interface_name}': {str(e)}"
                if self._sniffer:
                    try:
                        self._sniffer.stop()
                    except Exception:
                        pass
                    self._sniffer = None
                return {"status": "error", "message": self.error_message}

            # Start background flow harvest loop
            self._harvest_thread = threading.Thread(
                target=self._harvest_loop_wrapper,
                args=(redis_url,),
                daemon=True,
                name="LiveCapture-HarvestLoop",
            )
            self._harvest_thread.start()

            return {
                "status": "success",
                "message": f"Live packet capture started on interface '{interface_name}'",
                "interface": interface_name,
            }

    def stop(self) -> Dict[str, Any]:
        with self._lock:
            if not self.active:
                return {"status": "error", "message": "Monitoring is not currently active"}

            logger.info("Stopping LiveCaptureEngine...")
            self._stop_event.set()
            self.active = False

            if self._sniffer:
                try:
                    if getattr(self._sniffer, 'running', False):
                        self._sniffer.stop()
                except Exception as e:
                    logger.warning("Error stopping AsyncSniffer: %s", e)
                self._sniffer = None

            uptime = time.time() - (self.start_time or time.time())
            self.packets_per_sec = 0.0
            self.flows_per_sec = 0.0
            self.bandwidth_bps = 0.0
            self._pkt_window_count = 0
            self._flow_window_count = 0
            self._bytes_window_count = 0

            return {
                "status": "success",
                "message": "Live monitoring stopped successfully",
                "uptime_seconds": round(uptime, 2),
                "total_packets": self.total_packets_captured,
                "total_flows": self.total_flows_processed,
            }

    def get_status(self) -> Dict[str, Any]:
        now = time.time()

        # Check for unexpected sniffer thread termination
        if self.active and self._sniffer:
            sniffer_thread = getattr(self._sniffer, 'thread', None)
            if sniffer_thread is not None and not sniffer_thread.is_alive():
                logger.warning("Sniffer thread is no longer alive. Marking capture engine as inactive.")
                self.active = False
                if not self.error_message:
                    self.error_message = "Packet capture thread terminated unexpectedly."

        if not self.active:
            self.packets_per_sec = 0.0
            self.flows_per_sec = 0.0
            self.bandwidth_bps = 0.0
            uptime = 0.0
            active_flows = 0
        else:
            uptime = now - self.start_time if self.start_time else 0.0
            dt = now - self._last_rate_calc_time
            if dt >= 1.0:
                self.packets_per_sec = round(self._pkt_window_count / dt, 1)
                self.flows_per_sec = round(self._flow_window_count / dt, 1)
                self.bandwidth_bps = round((self._bytes_window_count * 8) / dt, 1)

                self._pkt_window_count = 0
                self._flow_window_count = 0
                self._bytes_window_count = 0
                self._last_rate_calc_time = now

            active_flows = getattr(self._builder, "active_flow_count", len(getattr(self._builder, "_active_flows", {})))

        return {
            "active": self.active,
            "interface": self.interface if self.active else None,
            "uptime_seconds": round(uptime, 1),
            "packets_per_sec": self.packets_per_sec,
            "flows_per_sec": self.flows_per_sec,
            "active_flows": active_flows,
            "bandwidth_bps": self.bandwidth_bps,
            "total_packets_captured": self.total_packets_captured,
            "total_flows_processed": self.total_flows_processed,
            "known_attacks_detected": self.known_attacks_detected,
            "unknown_attacks_detected": self.unknown_attacks_detected,
            "error_message": self.error_message,
        }

    def _packet_callback(self, pkt: Packet) -> None:
        if not self.active:
            return

        self.total_packets_captured += 1
        self._pkt_window_count += 1
        self._bytes_window_count += len(pkt)

        try:
            self._builder.add_packet(pkt)
        except Exception as e:
            logger.debug("Error adding packet to FlowBuilder: %s", e)

    def _harvest_loop_wrapper(self, redis_url: str) -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        self._async_loop = loop

        async def _harvest_loop() -> None:
            logger.info("Harvest loop connected to Redis at %s", redis_url)
            redis_client = aioredis.Redis.from_url(redis_url, encoding="utf-8", decode_responses=True)

            try:
                while not self._stop_event.is_set():
                    try:
                        expired_flows = self._builder.flush_expired_flows()

                        if expired_flows:
                            pipe = redis_client.pipeline()
                            for flow in expired_flows:
                                payload = {k: str(v) for k, v in flow.items()}
                                pipe.xadd("ids:flows", payload)

                            await pipe.execute()
                            count = len(expired_flows)
                            self.total_flows_processed += count
                            self._flow_window_count += count
                            logger.debug("Pushed %d finished flows to Redis stream 'ids:flows'", count)
                    except Exception as loop_err:
                        logger.warning("Harvest loop iteration warning: %s", loop_err)

                    await asyncio.sleep(0.5)
            except Exception as e:
                logger.error("Harvest loop error: %s", e)
                self.error_message = f"Harvest loop error: {str(e)}"
            finally:
                await redis_client.aclose()

        try:
            loop.run_until_complete(_harvest_loop())
        finally:
            loop.close()
