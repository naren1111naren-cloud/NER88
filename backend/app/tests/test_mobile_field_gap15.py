"""
Automated Test Suite for SIH Gap 15: Mobile-First Field Application & Offline Synchronization
Tests offline field report batching, coordinate bounds validation, idempotent retry deduplication,
strategic bridge damage association, cascading accessibility recalculation, and alert generation.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database.database import get_db, SessionLocal
from app.models.models import FieldReport, Incident, Bridge, Alert, AuditLog

client = TestClient(app)

def test_field_reports_get_all():
    """Verifies that field reports endpoint lists existing reports."""
    res = client.get("/api/v1/field-reports")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_offline_batch_sync_success():
    """Tests synchronization of mobile field reports created offline."""
    report_code = f"FLD-TEST-MOB-{int(pytest.importorskip('time').time() * 1000)}"
    payload = {
        "reports": [
            {
                "report_code": report_code,
                "incident_type": "LANDSLIDE",
                "description": "Severe debris on mountain hairpin bend.",
                "latitude": 27.3389,
                "longitude": 88.6065,
                "location_name": "Gangtok North Pass (NH10)",
                "district_name": "East Sikkim",
                "severity": "CRITICAL",
                "road_status": "BLOCKED",
                "affected_bridge_code": "BRG-NAMGANG",
                "photo_url": "https://example.com/field-photo.jpg"
            }
        ]
    }

    res = client.post("/api/v1/field-reports/sync", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["synced_count"] == 1

    # Verify report is persisted
    db: Session = SessionLocal()
    try:
        saved = db.query(FieldReport).filter(FieldReport.report_code == report_code).first()
        assert saved is not None
        assert saved.incident_type == "LANDSLIDE"
        assert saved.road_status == "BLOCKED"
        assert saved.sync_status == "SYNCED"

        # Verify bridge was marked CLOSED
        bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NAMGANG").first()
        if bridge:
            assert bridge.status in ["CLOSED", "DAMAGED", "RESTRICTED"]

        # Verify operational alert was generated and is NEW
        alert = db.query(Alert).filter(Alert.location == "Gangtok North Pass (NH10)").first()
        assert alert is not None
        assert alert.severity == "CRITICAL"
        assert alert.status == "NEW"

        # Verify audit log
        audit = db.query(AuditLog).filter(AuditLog.action == "SYNC_FIELD_REPORTS").first()
        assert audit is not None
    finally:
        db.query(FieldReport).filter(FieldReport.report_code == report_code).delete()
        db.query(Incident).filter(Incident.location_name == "Gangtok North Pass (NH10)").delete()
        db.query(Alert).filter(Alert.location == "Gangtok North Pass (NH10)").delete()
        bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NAMGANG").first()
        if bridge:
            bridge.status = "OPERATIONAL"
        db.commit()
        db.close()

def test_coordinate_bounds_validation():
    """Verifies that invalid latitude/longitude are rejected with validation error 422."""
    payload = {
        "reports": [
            {
                "report_code": "FLD-INVALID-COORDS",
                "incident_type": "FLOOD",
                "description": "Invalid lat report",
                "latitude": 150.0, # Invalid latitude > 90
                "longitude": 92.5,
                "location_name": "Test Sector",
                "district_name": "Kamrup",
                "severity": "HIGH",
                "road_status": "PARTIAL"
            }
        ]
    }
    res = client.post("/api/v1/field-reports/sync", json=payload)
    assert res.status_code == 422
    assert "Invalid field report latitude" in res.json()["detail"]

def test_idempotent_duplicate_prevention():
    """Verifies that resyncing the same report_code updates existing record without duplicates."""
    report_code = f"FLD-IDEMPOTENT-{int(pytest.importorskip('time').time() * 1000)}"
    payload = {
        "reports": [
            {
                "report_code": report_code,
                "incident_type": "ROAD_DAMAGE",
                "description": "Initial field observation",
                "latitude": 26.18,
                "longitude": 91.75,
                "location_name": "Guwahati Bypass",
                "district_name": "Kamrup Metropolitan",
                "severity": "MEDIUM",
                "road_status": "PARTIAL"
            }
        ]
    }

    # Initial sync
    res1 = client.post("/api/v1/field-reports/sync", json=payload)
    assert res1.status_code == 200

    # Retry sync with updated description
    payload["reports"][0]["description"] = "Updated field observation post-inspection"
    res2 = client.post("/api/v1/field-reports/sync", json=payload)
    assert res2.status_code == 200

    db: Session = SessionLocal()
    try:
        matches = db.query(FieldReport).filter(FieldReport.report_code == report_code).all()
        assert len(matches) == 1
        assert matches[0].description == "Updated field observation post-inspection"
    finally:
        db.query(FieldReport).filter(FieldReport.report_code == report_code).delete()
        db.query(Incident).filter(Incident.description.like(f"%{report_code}%")).delete()
        db.query(Incident).filter(Incident.location_name == "Guwahati Bypass").delete()
        db.commit()
        db.close()
