import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token, get_current_user, get_current_active_user
from app.models.models import User, Incident
from app.database.database import SessionLocal

client = TestClient(app)

def test_unauthenticated_write_rejected():
    # Temporarily remove dependency overrides to test raw auth guard
    saved_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    try:
        res = client.post("/api/v1/incidents", json={
            "incident_type": "LANDSLIDE",
            "description": "Unauthorized incident report test",
            "latitude": 26.15,
            "longitude": 91.75,
            "location_name": "Test Point",
            "severity": "HIGH",
            "road_status": "BLOCKED"
        })
        assert res.status_code == 401
    finally:
        app.dependency_overrides.update(saved_overrides)

def test_invalid_token_rejected():
    saved_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    try:
        res = client.post(
            "/api/v1/incidents",
            headers={"Authorization": "Bearer invalid.garbage.token"},
            json={
                "incident_type": "LANDSLIDE",
                "description": "Invalid token test",
                "latitude": 26.15,
                "longitude": 91.75,
                "location_name": "Test Point",
                "severity": "HIGH",
                "road_status": "BLOCKED"
            }
        )
        assert res.status_code == 401
    finally:
        app.dependency_overrides.update(saved_overrides)

def test_valid_token_accepted():
    saved_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    db = SessionLocal()
    try:
        token = create_access_token(subject="admin@linkx8.in", role="Admin")
        res = client.post(
            "/api/v1/incidents",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "incident_type": "LANDSLIDE",
                "description": "Valid token incident report",
                "latitude": 26.15,
                "longitude": 91.75,
                "location_name": "Test Point",
                "severity": "LOW",
                "road_status": "CLEAR"
            }
        )
        assert res.status_code in [200, 201]
    finally:
        app.dependency_overrides.update(saved_overrides)
        db.query(Incident).filter(Incident.description == "Valid token incident report").delete()
        db.commit()
        db.close()

def test_role_forbidden_for_non_admin():
    saved_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    try:
        # Create token for Viewer role
        token = create_access_token(subject="viewer@linkx8.in", role="Viewer")
        res = client.post(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "email": "new.user@linkx8.in",
                "full_name": "New User",
                "password": "Password123!",
                "role": "Viewer"
            }
        )
        assert res.status_code == 403
    finally:
        app.dependency_overrides.update(saved_overrides)
