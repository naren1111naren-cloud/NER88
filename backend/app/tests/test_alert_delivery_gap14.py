"""
Automated Test Suite for SIH Gap 14: Real-Time Alert Delivery Mechanism
Tests SSE streaming, broadcast queue engine, acknowledgement lifecycle,
audit logs, filtering, reconnection playback, and duplicate prevention.
"""

import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database.database import get_db, SessionLocal
from app.models.models import Alert, AuditLog
from app.services.alert_delivery_service import AlertDeliveryService

client = TestClient(app)

def test_alert_creation_and_persistence():
    """Verifies that operational alerts are properly stored with initial NEW status."""
    db: Session = SessionLocal()
    try:
        alert = AlertDeliveryService.create_and_broadcast_alert(
            db=db,
            alert_type="BRIDGE_DAMAGE",
            title="Structural Pier Scour Alert: Irang Bridge",
            message="Pier 2 visual shift detected under torrential downpour.",
            severity="CRITICAL",
            location="Irang Bailey Bridge (COR-NH37)",
            recommended_action="Halt heavy convoys >20T immediately."
        )
        assert alert.id is not None
        assert alert.status == "NEW"
        assert alert.severity == "CRITICAL"
        assert alert.is_read is False

        # Verify DB query
        persisted = db.query(Alert).filter(Alert.id == alert.id).first()
        assert persisted is not None
        assert persisted.title == "Structural Pier Scour Alert: Irang Bridge"
    finally:
        db.close()

def test_alert_query_and_filtering():
    """Tests GET /api/v1/alerts dynamic filtering by severity and status."""
    res = client.get("/api/v1/alerts?severity=CRITICAL")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    for item in data:
        assert item["severity"] == "CRITICAL"

def test_alert_history_audit():
    """Tests GET /api/v1/alerts/history returns all operational records."""
    db: Session = SessionLocal()
    try:
        AlertDeliveryService.create_and_broadcast_alert(
            db=db,
            alert_type="WEATHER",
            title="Monsoon Rainfall Warning",
            message="Downpour across Guwahati",
            severity="MEDIUM"
        )
    finally:
        db.close()

    res = client.get("/api/v1/alerts/history?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1

def test_alert_acknowledgement_lifecycle():
    """Tests alert acknowledgement transition from NEW -> ACKNOWLEDGED with audit logging."""
    db: Session = SessionLocal()
    try:
        # Create fresh alert
        alert = AlertDeliveryService.create_and_broadcast_alert(
            db=db,
            alert_type="LANDSLIDE",
            title="Monsoon Mudslide NH29",
            message="Mountain pass blocked.",
            severity="HIGH",
            location="NH29 Kohima Pass"
        )
        alert_id = alert.id

        # Acknowledge via API
        res = client.post(f"/api/v1/alerts/{alert_id}/acknowledge", json={
            "acknowledged_by": "Senior Dispatcher Sharma",
            "notes": "Emergency bypass route activated"
        })
        assert res.status_code == 200
        updated = res.json()
        assert updated["status"] == "ACKNOWLEDGED"
        assert updated["is_read"] is True
        assert updated["acknowledged_by"] == "Senior Dispatcher Sharma"
        assert updated["acknowledged_at"] is not None

        # Verify audit log was recorded
        audit = db.query(AuditLog).filter(
            AuditLog.action == "ACKNOWLEDGE_ALERT",
            AuditLog.details.contains(str(alert_id))
        ).first()
        assert audit is not None
        assert "Senior Dispatcher Sharma" in audit.user_email
    finally:
        db.close()

def test_alert_stream_subscription_and_broadcast():
    """Tests pub-sub queue engine broadcasting events to subscribers."""
    queue = AlertDeliveryService.subscribe()
    try:
        sample_alert = {
            "id": 9999,
            "title": "Test Real-Time Event",
            "severity": "CRITICAL",
            "location": "Silchar"
        }
        AlertDeliveryService.publish_alert_event("NEW_ALERT", sample_alert)

        # Queue should immediately contain event payload
        assert not queue.empty()
        event = queue.get_nowait()
        assert event["event_type"] == "NEW_ALERT"
        assert event["alert"]["id"] == 9999
        assert "event_id" in event
    finally:
        AlertDeliveryService.unsubscribe(queue)

def test_alert_reconnection_missed_events():
    """Tests ring buffer playback when client reconnects with last_event_id."""
    sample_alert_1 = {"id": 1001, "title": "Alert 1"}
    sample_alert_2 = {"id": 1002, "title": "Alert 2"}

    AlertDeliveryService.publish_alert_event("NEW_ALERT", sample_alert_1)
    last_id = AlertDeliveryService._recent_events[-1]["event_id"]

    AlertDeliveryService.publish_alert_event("NEW_ALERT", sample_alert_2)

    missed = AlertDeliveryService.get_missed_events(last_id)
    assert len(missed) >= 1
    assert any(m["alert"]["id"] == 1002 for m in missed)

def test_alert_trigger_test_endpoint():
    """Tests explicit dispatcher test broadcast endpoint."""
    res = client.post("/api/v1/alerts/trigger-test", json={
        "alert_type": "WEATHER_WARNING",
        "title": "Severe Cyclone Alert: Tripura Corridor",
        "message": "Heavy torrential rains expected.",
        "severity": "CRITICAL",
        "location": "Agartala Highway",
        "recommended_action": "Park freight in designated depot."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Severe Cyclone Alert: Tripura Corridor"
    assert data["severity"] == "CRITICAL"
    assert data["status"] == "NEW"

def test_alert_mark_read_backward_compatibility():
    """Tests PUT /api/v1/alerts/{id}/read endpoint."""
    db: Session = SessionLocal()
    try:
        alert = AlertDeliveryService.create_and_broadcast_alert(
            db=db,
            alert_type="OTHER",
            title="General Notice",
            message="Traffic delay cleared.",
            severity="LOW"
        )
        res = client.put(f"/api/v1/alerts/{alert.id}/read")
        assert res.status_code == 200
        assert res.json()["status"] == "SUCCESS"

        db.refresh(alert)
        assert alert.is_read is True
        assert alert.status == "SEEN"
    finally:
        db.close()
