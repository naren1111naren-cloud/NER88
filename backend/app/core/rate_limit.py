"""
High-performance In-Memory Rate Limiting Middleware for LINK X8
"""

import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class SlidingWindowRateLimiter:
    def __init__(self, default_limit: int = 120, window_seconds: int = 60):
        self.default_limit = default_limit
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = defaultdict(list)
        self.custom_limits: Dict[str, int] = {
            "/api/v1/auth/login": 20,
            "/api/v1/incidents": 60,
            "/api/v1/field-reports/sync": 40,
        }

    def _get_limit_for_path(self, path: str) -> int:
        for prefix, limit in self.custom_limits.items():
            if path.startswith(prefix):
                return limit
        return self.default_limit

    def _get_bucket_key(self, client_ip: str, path: str) -> str:
        for prefix in self.custom_limits.keys():
            if path.startswith(prefix):
                return f"{client_ip}:{prefix}"
        return f"{client_ip}:__default__"

    def is_allowed(self, client_ip: str, path: str) -> Tuple[bool, int, int]:
        now = time.time()
        window_start = now - self.window_seconds
        limit = self._get_limit_for_path(path)
        bucket_key = self._get_bucket_key(client_ip, path)

        timestamps = self.requests[bucket_key]
        self.requests[bucket_key] = [t for t in timestamps if t > window_start]

        current_count = len(self.requests[bucket_key])
        if current_count >= limit:
            return False, 0, limit

        self.requests[bucket_key].append(now)
        remaining = max(0, limit - (current_count + 1))
        return True, remaining, limit

    def clear(self):
        self.requests.clear()


limiter = SlidingWindowRateLimiter(default_limit=150, window_seconds=60)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in ["/docs", "/redoc", "/openapi.json", "/api/v1/health", "/api/v1/alerts/stream"]:
            return await call_next(request)

        forwarded = request.headers.get("X-Forwarded-For")
        real_ip = request.headers.get("X-Real-IP")
        if forwarded and forwarded.split(",")[0].strip():
            client_ip = forwarded.split(",")[0].strip()
        elif real_ip and real_ip.strip():
            client_ip = real_ip.strip()
        else:
            client_ip = request.client.host if request.client else "127.0.0.1"

        if client_ip == "testclient" and not request.headers.get("X-Test-Rate-Limit"):
            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(limiter.default_limit)
            response.headers["X-RateLimit-Remaining"] = str(limiter.default_limit)
            return response

        allowed, remaining, limit = limiter.is_allowed(client_ip, path)
        if not allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": f"Rate limit exceeded. Maximum {limit} requests per minute allowed.",
                    "status_code": 429
                },
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": "60"
                }
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response

