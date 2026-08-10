"""
honeypot/decoy_server.py — Safe Local HTTP Decoy Server & Interaction Recorder.

Runs an isolated local HTTP decoy service on a designated local port (default: 8080).
Completely safe:
  - NO shell access
  - NO command execution
  - NO real credentials or sensitive backend logic
  - NO arbitrary file processing

Records incoming HTTP probes, suspicious paths (/admin, /login, /etc/passwd),
and connection metadata directly into PostgreSQL `honeypot_events`.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from db.session import AsyncSessionLocal
from db.models import HoneypotEvent
from api.dependencies import get_redis_pool

logger = logging.getLogger(__name__)


class DecoyServer:
    """
    Isolated Local HTTP Decoy Server.
    Listens on host/port, captures interaction metrics, and persists HoneypotEvents.
    """

    def __init__(self, host: str = "127.0.0.1", port: int = 8080, service_name: str = "http-decoy") -> None:
        self.host = host
        self.port = port
        self.service_name = service_name
        self._server: Optional[asyncio.Server] = None
        self._is_running: bool = False
        self._recent_requests: Dict[str, List[float]] = {}
        self.total_interactions: int = 0
        self.start_time: Optional[float] = None

    def is_running(self) -> bool:
        return self._is_running and self._server is not None

    async def start(self) -> bool:
        """Start the async TCP/HTTP decoy server listener with automatic fallback ports."""
        if self.is_running():
            logger.info("Decoy server already running on %s:%d", self.host, self.port)
            return True

        candidate_ports = [self.port, 8085, 8888, 9090]
        for p in candidate_ports:
            try:
                self._server = await asyncio.start_server(
                    self._handle_client_connection, self.host, p
                )
                self.port = p
                self._is_running = True
                self.start_time = time.time()
                logger.info("Safe Local Decoy HTTP Server started successfully on %s:%d (%s)", self.host, self.port, self.service_name)
                return True
            except Exception as e:
                logger.debug("Port %d busy for decoy server: %s", p, e)

        logger.error("Failed to bind Decoy HTTP Server on candidate ports %s", candidate_ports)
        self._is_running = False
        return False

    async def stop(self) -> None:
        """Stop the decoy server listener."""
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
            self._server = None
        self._is_running = False
        logger.info("Decoy HTTP Server stopped.")

    async def _handle_client_connection(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ) -> None:
        """Handle incoming raw TCP/HTTP connection cleanly without executing commands."""
        peer = writer.get_extra_info("peername")
        sock = writer.get_extra_info("sockname")

        src_ip, src_port = (peer[0], peer[1]) if peer else ("127.0.0.1", 0)
        dst_ip, dst_port = (sock[0], sock[1]) if sock else (self.host, self.port)

        session_id = str(uuid.uuid4())
        request_line = "RAW_TCP_CONNECT"
        headers_dict: Dict[str, str] = {}
        body_sample = ""

        try:
            # Read first chunk up to 4096 bytes with 3s timeout
            data = await asyncio.wait_for(reader.read(4096), timeout=3.0)
            if data:
                raw_text = data.decode("utf-8", errors="ignore")
                lines = raw_text.split("\r\n")
                if lines:
                    request_line = lines[0].strip() or "EMPTY_REQUEST"

                for line in lines[1:]:
                    if ":" in line:
                        k, v = line.split(":", 1)
                        headers_dict[k.strip().lower()] = v.strip()
                    elif line == "" and len(lines) > lines.index(line) + 1:
                        body_sample = "\r\n".join(lines[lines.index(line) + 1:])[:500]
                        break
        except asyncio.TimeoutError:
            request_line = "TIMEOUT_NO_PAYLOAD"
        except Exception as e:
            logger.debug("Error reading payload in decoy server: %s", e)

        # Classify Event Type & Severity
        event_type, severity = self._classify_interaction(src_ip, request_line, body_sample, headers_dict)
        self.total_interactions += 1

        # Record Honeypot Event in PostgreSQL
        event_payload = {
            "headers": headers_dict,
            "body_sample": body_sample,
            "raw_request": request_line,
        }

        asyncio.create_task(
            self._save_and_broadcast_event(
                src_ip=src_ip,
                src_port=src_port,
                dst_ip=dst_ip,
                dst_port=dst_port,
                protocol="TCP",
                service=self.service_name,
                request_type=request_line[:64],
                event_type=event_type,
                severity=severity,
                session_id=session_id,
                payload=event_payload,
            )
        )

        # Send realistic fake response and close connection
        try:
            fake_response = (
                "HTTP/1.1 404 Not Found\r\n"
                "Server: Apache/2.4.52 (Ubuntu)\r\n"
                "Content-Type: text/html; charset=iso-8859-1\r\n"
                "Content-Length: 205\r\n"
                "Connection: close\r\n\r\n"
                "<!DOCTYPE HTML PUBLIC \"-//IETF//DTD HTML 2.0//EN\">\n"
                "<html><head><title>404 Not Found</title></head>\n"
                "<body><h1>Not Found</h1>\n"
                "<p>The requested URL was not found on this server.</p></body></html>\n"
            )
            writer.write(fake_response.encode("utf-8"))
            await writer.drain()
        except Exception:
            pass
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    def _classify_interaction(
        self, src_ip: str, request_line: str, body: str, headers: Dict[str, str]
    ) -> Tuple[str, str]:
        """Classify Honeypot interaction into event_type and severity."""
        req_upper = request_line.upper()
        now = time.time()

        # Track IP request timestamps for rate detection
        timestamps = self._recent_requests.setdefault(src_ip, [])
        timestamps.append(now)
        # Keep timestamps within 10s
        self._recent_requests[src_ip] = [t for t in timestamps if (now - t) <= 10.0]

        if len(self._recent_requests[src_ip]) >= 5:
            return "REPEATED_REQUEST", "MEDIUM"

        # Check for Critical Attack Patterns (traversal, sql, command injection)
        critical_keywords = ["/etc/passwd", "cmd.exe", ".env", "union select", "<script>", "eval(", "exec("]
        if any(kw in request_line.lower() or kw in body.lower() for kw in critical_keywords):
            return "SUSPICIOUS_REQUEST", "CRITICAL"

        # Check for Suspicious Probes (/admin, /login, /phpmyadmin, /api)
        suspicious_paths = ["/admin", "/login", "/wp-login", "/phpmyadmin", "/config", "/api/v1/users", "POST"]
        if any(sp in req_upper for sp in suspicious_paths):
            return "SUSPICIOUS_REQUEST", "HIGH"

        if request_line in ("RAW_TCP_CONNECT", "TIMEOUT_NO_PAYLOAD", "EMPTY_REQUEST"):
            return "CONNECTION_ATTEMPT", "LOW"

        return "HTTP_PROBE", "LOW"

    async def _save_and_broadcast_event(
        self,
        src_ip: str,
        src_port: int,
        dst_ip: str,
        dst_port: int,
        protocol: str,
        service: str,
        request_type: str,
        event_type: str,
        severity: str,
        session_id: str,
        payload: Dict[str, Any],
    ) -> None:
        """Persist HoneypotEvent to DB and publish to Redis Pub/Sub."""
        try:
            async with AsyncSessionLocal() as session:
                event = HoneypotEvent(
                    timestamp=datetime.now(timezone.utc),
                    src_ip=src_ip,
                    src_port=src_port,
                    dst_ip=dst_ip,
                    dst_port=dst_port,
                    protocol=protocol,
                    service=service,
                    request_type=request_type,
                    event_type=event_type,
                    severity=severity,
                    session_id=session_id,
                    payload=payload,
                )
                session.add(event)
                await session.commit()
                await session.refresh(event)

                event_dict = {
                    "id": str(event.id),
                    "timestamp": event.timestamp.isoformat(),
                    "src_ip": event.src_ip,
                    "src_port": event.src_port,
                    "dst_ip": event.dst_ip,
                    "dst_port": event.dst_port,
                    "protocol": event.protocol,
                    "service": event.service,
                    "request_type": event.request_type,
                    "event_type": event.event_type,
                    "severity": event.severity,
                    "session_id": event.session_id,
                }

                logger.info("Recorded HoneypotEvent [%s] %s -> %s (%s)", event_type, src_ip, request_type, severity)

                # Broadcast via Redis Pub/Sub if available
                try:
                    redis = get_redis_pool()
                    await redis.publish("ids:honeypot_events", json.dumps(event_dict))
                except Exception as re:
                    logger.debug("Redis pubsub broadcast skipped: %s", re)

                # Broadcast to connected WebSocket clients via existing alert_manager
                try:
                    from api.routers.ws import alert_manager
                    await alert_manager.broadcast({
                        "type": "honeypot_event",
                        "event": event_dict,
                    })
                except Exception as wse:
                    logger.debug("WS alert_manager broadcast skipped for honeypot_event: %s", wse)

        except Exception as e:
            logger.error("Failed to save HoneypotEvent to PostgreSQL: %s", e, exc_info=True)


# Singleton Instance Provider
_decoy_server_instance: Optional[DecoyServer] = None


def get_decoy_server() -> DecoyServer:
    global _decoy_server_instance
    if _decoy_server_instance is None:
        _decoy_server_instance = DecoyServer(host="127.0.0.1", port=8080, service_name="http-decoy")
    return _decoy_server_instance
