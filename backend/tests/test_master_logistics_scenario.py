"""
End-to-End Test Suite for Phase 5 Master Logistics Scenario (SIH26002)
Validates the complete Regional Logistics Intelligence workflow:
FIELD/EXTERNAL DATA -> RISK/DISRUPTION -> ACCESSIBILITY IMPACT ->
VEHICLE IMPACT -> ROUTE OPTIMIZATION -> ETA CHANGE -> ALERT ->
FIELD RESPONSE -> COMMAND CENTER UPDATE -> DELIVERY COMPLETION
"""

import json
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database.database import get_db, SessionLocal
from app.models.models import Vehicle, Delivery, Corridor, Incident, Alert, RouteDecision, FieldReport
from app.services.assistant_service import Assistant88Service

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()

def test_master_scenario_lifecycle():
    """
    Executes the full 11-step master demonstration scenario from start to delivery completion.
    """
    # 1. Step 1: Initialize Master Scenario (Guwahati -> Shillong, V-102, MED-102, COR-NH40)
    res_start = client.post("/api/v1/demo/scenario/start")
    assert res_start.status_code == 200
    start_data = res_start.json()
    assert start_data["success"] is True
    assert start_data["step"] == 1
    assert "V-102" in start_data["vehicle"]
    assert "MED-102" in start_data["consignment"]

    # Verify database state after Step 1
    res_status = client.get("/api/v1/demo/scenario/status")
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["corridor"]["status"] == "OPEN"
    assert status_data["corridor"]["accessibility_score"] >= 90.0
    assert status_data["vehicle"]["code"] == "V-102"
    assert status_data["vehicle"]["status"] == "IN_TRANSIT"
    assert status_data["shipment"]["shipment_id"] == "MED-102"
    assert status_data["shipment"]["status"] == "IN_TRANSIT"
    assert status_data["shipment"]["priority"] == "EMERGENCY"

    # 2. Step 2: Trigger Landslide Disruption on COR-NH40 (GS Road near Nongpoh)
    res_disrupt = client.post("/api/v1/demo/scenario/disrupt")
    assert res_disrupt.status_code == 200
    disrupt_data = res_disrupt.json()
    assert disrupt_data["success"] is True
    assert disrupt_data["step"] == 2
    assert disrupt_data["incident"]["type"] == "LANDSLIDE"
    assert disrupt_data["incident"]["status"] == "BLOCKED"
    assert disrupt_data["corridor_impact"]["current_status"] == "BLOCKED"
    assert disrupt_data["corridor_impact"]["accessibility_score"] == 0.0

    # Verify vehicle and shipment impact
    assert disrupt_data["affected_entities"]["vehicle"] == "V-102"
    assert disrupt_data["affected_entities"]["delivery"] == "MED-102"

    # Verify RouteDecision proposal generated
    opt = disrupt_data["route_optimization"]
    assert opt["status"] == "PROPOSED"
    assert "Eastern Bypass" in opt["alternative_route"]
    assert opt["additional_distance_km"] > 0
    assert opt["estimated_delay_mins"] > 0
    assert opt["risk_score_after"] < opt["risk_score_before"]

    # 3. Step 3: Field Ground Verification Synced from Low-Connectivity Patrol
    res_field = client.post("/api/v1/demo/scenario/field-confirm")
    assert res_field.status_code == 200
    field_data = res_field.json()
    assert field_data["success"] is True
    assert field_data["step"] == 3
    assert field_data["field_report"]["road_status"] == "BLOCKED"
    assert field_data["field_report"]["sync_status"] == "SYNCED"

    # 4. Step 4: Dispatcher / Command Center Approves Reroute
    res_approve = client.post("/api/v1/demo/scenario/reroute-approve")
    assert res_approve.status_code == 200
    approve_data = res_approve.json()
    assert approve_data["success"] is True
    assert approve_data["step"] == 4
    assert approve_data["status"] == "APPROVED"
    assert "Eastern Bypass" in approve_data["active_route"]

    # Check vehicle moved to bypass link
    assert approve_data["vehicle_position"]["lat"] == 25.68
    assert approve_data["vehicle_position"]["lng"] == 92.02

    # 5. Step 5: Advance Vehicle GPS Telemetry
    res_adv = client.post("/api/v1/demo/scenario/telemetry-advance")
    assert res_adv.status_code == 200
    adv_data = res_adv.json()
    assert adv_data["success"] is True
    assert adv_data["vehicle"] == "V-102"
    assert adv_data["lat"] == 25.61
    assert adv_data["lng"] == 91.95

    # 6. Step 6: Complete Delivery at Shillong Destination
    res_deliv = client.post("/api/v1/demo/scenario/deliver")
    assert res_deliv.status_code == 200
    deliv_data = res_deliv.json()
    assert deliv_data["success"] is True
    assert deliv_data["step"] == 5
    assert deliv_data["delivery_code"] == "MED-102"
    assert deliv_data["status"] == "DELIVERED"
    assert deliv_data["completed_at"] is not None
    assert deliv_data["actual_duration_hours"] > 0

    # 7. Verify Operational Timeline with Real Timestamps
    res_timeline = client.get("/api/v1/demo/scenario/timeline")
    assert res_timeline.status_code == 200
    timeline_data = res_timeline.json()
    assert timeline_data["success"] is True
    assert timeline_data["events_count"] >= 5
    events = timeline_data["timeline"]
    categories = [e["category"] for e in events]
    assert "DISPATCH" in categories
    assert "TELEMETRY" in categories
    assert "INCIDENT" in categories
    assert "REROUTE" in categories
    assert "DELIVERED" in categories

    # 8. Reset Scenario to Baseline
    res_reset = client.post("/api/v1/demo/scenario/reset")
    assert res_reset.status_code == 200
    assert res_reset.json()["success"] is True

def test_assistant_88_operational_queries(db_session: Session):
    """
    Validates that Assistant 88 answers operational questions based on real database models.
    """
    # Initialize scenario and trigger disruption so there is active context
    client.post("/api/v1/demo/scenario/start")
    client.post("/api/v1/demo/scenario/disrupt")

    # Query 1: Affected vehicles
    q1 = Assistant88Service.process_query("Which vehicles are affected by the blocked corridor?", None, db_session)
    assert "V-102" in q1["message"]
    assert "COR-NH40" in q1["message"] or "40" in q1["message"]
    assert "MED-102" in q1["message"]

    # Query 2: Why was V-102 rerouted?
    q2 = Assistant88Service.process_query("Why was V-102 rerouted?", None, db_session)
    assert "V-102" in q2["message"]
    assert "Route B" in q2["message"] or "Bypass" in q2["message"]
    assert "km" in q2["message"]

    # Query 3: Field reports awaiting synchronization
    q3 = Assistant88Service.process_query("Which field reports are awaiting synchronization?", None, db_session)
    assert "Field Report" in q3["message"] or "field reports" in q3["message"].lower()

    # Query 4: Delayed shipments
    q4 = Assistant88Service.process_query("Which shipments are delayed?", None, db_session)
    assert "MED-102" in q4["message"] or "Consignments" in q4["message"]

    # Query 5: Overall accessibility status
    q5 = Assistant88Service.process_query("What is the current accessibility status?", None, db_session)
    assert "Accessibility Index" in q5["message"] or "Corridors" in q5["message"]

    # Clean up
    client.post("/api/v1/demo/scenario/reset")
