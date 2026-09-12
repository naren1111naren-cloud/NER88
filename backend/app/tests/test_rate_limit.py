import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.rate_limit import limiter

client = TestClient(app)

def test_rate_limit_headers_present():
    limiter.clear()
    res = client.get("/api/v1/corridors")
    assert res.status_code == 200
    assert "X-RateLimit-Limit" in res.headers
    assert "X-RateLimit-Remaining" in res.headers

def test_rate_limit_exceeded_returns_429():
    limiter.clear()
    # Path with small custom limit
    path = "/api/v1/auth/login"
    limit = limiter._get_limit_for_path(path)
    
    # Send requests up to limit
    for _ in range(limit):
        res = client.post(path, data={"username": "fake", "password": "bad"})
        assert res.status_code != 429

    # Next request should be rate limited
    res = client.post(path, data={"username": "fake", "password": "bad"})
    assert res.status_code == 429
    assert res.json()["status_code"] == 429
    assert "Rate limit exceeded" in res.json()["detail"]
    
    # Cleanup
    limiter.clear()
