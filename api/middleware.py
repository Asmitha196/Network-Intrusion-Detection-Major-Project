"""
api/middleware.py — Production Security & Utility Middlewares.

Features:
  - RequestIDMiddleware: Injects unique X-Request-ID headers into requests and responses.
  - SecurityHeadersMiddleware: Sets production security headers (X-Frame-Options, X-Content-Type-Options, etc.).
  - SimpleRateLimiter: In-memory sliding window rate limiter to protect ingestion endpoints.
"""
from __future__ import annotations

import time
import uuid
import logging
from typing import Callable

from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Assigns a unique UUID X-Request-ID to incoming requests and sets it in response headers."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id

        start_time = time.time()
        response: Response = await call_next(request)
        process_time = time.time() - start_time

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.4f}s"
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Sets standard HTTP security headers for web protection."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


class IngestionRateLimiter:
    """
    Sliding window rate limiter for protecting /ingest endpoints.
    Allows max_requests per window_seconds per IP.
    """

    def __init__(self, max_requests: int = 500, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._history: dict[str, list[float]] = {}

    def check_rate_limit(self, client_ip: str) -> None:
        now = time.time()
        cutoff = now - self.window_seconds

        if client_ip not in self._history:
            self._history[client_ip] = []

        # Remove expired timestamps
        self._history[client_ip] = [t for t in self._history[client_ip] if t > cutoff]

        if len(self._history[client_ip]) >= self.max_requests:
            logger.warning("Rate limit exceeded for client IP: %s", client_ip)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many ingestion requests. Please slow down.",
            )

        self._history[client_ip].append(now)


rate_limiter = IngestionRateLimiter(max_requests=1000, window_seconds=60)
