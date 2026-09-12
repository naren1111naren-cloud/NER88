import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.rate_limit import limiter

client = TestClient(app)

def test_rate_limit_headers_present():
    res = client.get("/api/v1/corridors", headers={"X-Test-Rate-Limit": "true", "X-Forwarded-For": "203.0.113.10"})
    assert res.status_code == 200
    assert "X-RateLimit-Limit" in res.headers
    assert "X-RateLimit-Remaining" in res.headers

def test_rate_limit_exceeded_returns_429():
    limiter.clear()
    path = "/api/v1/auth/login"
    test_ip = "203.0.113.99"
    limit = limiter._get_limit_for_path(path)
    
    # Send requests up to limit
    for _ in range(limit):
        res = client.post(path, data={"username": "fake", "password": "bad"}, headers={"X-Test-Rate-Limit": "true", "X-Forwarded-For": test_ip})
        assert res.status_code != 429

    # Next request should be rate limited
    res = client.post(path, data={"username": "fake", "password": "bad"}, headers={"X-Test-Rate-Limit": "true", "X-Forwarded-For": test_ip})
    assert res.status_code == 429
    assert res.json()["status_code"] == 429
    assert "Rate limit exceeded" in res.json()["detail"]
    
    # Cleanup
    limiter.clear()
