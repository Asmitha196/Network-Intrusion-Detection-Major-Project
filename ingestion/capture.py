"""
ingestion/capture.py — Phase 7 Live Packet Capture Engine & Interface Discovery.
"""
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
from scapy.all import AsyncSniffer, get_working_ifaces, Packet, conf
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
    Map user-selected interface name (e.g. 'Wi-Fi', 'Ethernet')
    to a Scapy NetworkInterface object or Npcap GUID identifier.
    """
    try:
        if iface_name in conf.ifaces:
            return conf.ifaces[iface_name]

        for dev in conf.ifaces.values():
            win_name = getattr(dev, 'win_name', '')
            desc = getattr(dev, 'description', '')
            name = getattr(dev, 'name', '')
            pcap_name = getattr(dev, 'pcap_name', '')

            if iface_name in (win_name, desc, name, pcap_name) or (win_name and iface_name.lower() in win_name.lower()) or (desc and iface_name.lower() in desc.lower()) or (name and iface_name.lower() in name.lower()):
                return dev

            if getattr(dev, 'ip', None) == iface_name:
                return dev
    except Exception as e:
        logger.warning("Scapy interface resolution note: %s", e)

    return iface_name


def enumerate_interfaces() -> List[Dict[str, Any]]:
    """
    Enumerate all available network interfaces on the host system.

    Returns a list of dicts with keys:
        - name: Interface identifier (e.g., 'eth0', 'Ethernet 2', '\\Device\\NPF_...')
        - description: Friendly display name
        - mac_address: MAC hardware address
        - ip_address: IPv4 address assigned to the NIC
        - status: 'up' or 'down'
        - speed: Speed in Mbps or 'N/A'
    """
    interfaces = []

    ps_stats = psutil.net_if_stats()
    ps_addrs = psutil.net_if_addrs()

    scapy_ifaces = {}
    if hasattr(os, 'name') and os.name != 'nt':
        try:
            for iface in get_working_ifaces():
                scapy_ifaces[iface.name] = iface
                if hasattr(iface, 'description'):
                    scapy_ifaces[iface.description] = iface
        except Exception as e:
            logger.warning("Could not retrieve Scapy working interfaces: %s", e)

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

        scapy_info = scapy_ifaces.get(iface_name)
        desc = getattr(scapy_info, 'description', iface_name) if scapy_info else iface_name

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
        self._sniffer_thread: Optional[threading.Thread] = None
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

            self.interface = interface_name
            self.active = True
            self.start_time = time.time()
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

            target_iface = resolve_scapy_interface(interface_name)

            def _start_sniffer_async():
                try:
                    self._sniffer = AsyncSniffer(
                        iface=target_iface,
                        prn=self._packet_callback,
                        store=False,
                        filter="ip or ip6",
                    )
                    self._sniffer.start()
                    logger.info("AsyncSniffer started on interface '%s'", interface_name)
                except Exception as e:
                    logger.info("AsyncSniffer default start failed: %s. Trying L3RawSocket fallback...", e)
                    if L3RawSocket is not None:
                        try:
                            self._sniffer = AsyncSniffer(
                                L2socket=L3RawSocket,
                                prn=self._packet_callback,
                                store=False,
                            )
                            self._sniffer.start()
                            logger.info("AsyncSniffer started with L3RawSocket on '%s'", interface_name)
                        except Exception as ex:
                            logger.error("AsyncSniffer failed completely: %s", ex)
                            self.active = False
                            self.error_message = f"Failed to start sniffer on '{interface_name}': {str(ex)}"
                    else:
                        self.active = False
                        self.error_message = f"Failed to start sniffer on '{interface_name}': {str(e)}"

            self._sniffer_thread = threading.Thread(
                target=_start_sniffer_async,
                daemon=True,
                name="LiveCapture-SnifferStart",
            )
            self._sniffer_thread.start()

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

            if self._sniffer and self._sniffer.running:
                try:
                    self._sniffer.stop()
                except Exception as e:
                    logger.warning("Error stopping AsyncSniffer: %s", e)
                self._sniffer = None

            uptime = time.time() - (self.start_time or time.time())
            return {
                "status": "success",
                "message": "Live monitoring stopped successfully",
                "uptime_seconds": round(uptime, 2),
                "total_packets": self.total_packets_captured,
                "total_flows": self.total_flows_processed,
            }

    def get_status(self) -> Dict[str, Any]:
        now = time.time()
        uptime = now - self.start_time if (self.active and self.start_time) else 0.0

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
            "interface": self.interface,
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
