"""
End-to-End Automated Test Suite for Phase 2: Disruption Detection & Intelligent Rerouting
Tests the complete cascade:
EVENT (heavy rainfall/rockfall incident)
  → road risk increases
  → road becomes RESTRICTED/BLOCKED
  → vehicle is detected on affected route
  → alternative route calculated
  → ETA changes
  → alert generated
  → decision stored in backend
  → decision approved and executed
  → verified across all 4 Phase 2 APIs
"""

import json
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import SessionLocal
from app.models.models import (
    Corridor,
    Bridge,
    Incident,
    WeatherRecord,
    Vehicle,
    Delivery,
    Alert,
    RouteDecision,
    AuditLog
)
from app.services.accessibility_service import AccessibilityEngine
from app.services.rerouting_service import ReroutingService
from app.services.routing_service import (
    PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS,
    ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS
)
from app.database.seed import seed_database
from app.models.models import User
from app.core.security import create_access_token

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    seed_database()

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_headers(db):
    user = db.query(User).filter(User.email.in_(["dispatcher@linkx8.in", "admin@linkx8.in"])).first()
    if not user:
        user = User(email="dispatcher@linkx8.in", full_name="Dispatcher", hashed_password="pwd", role="Dispatcher")
        db.add(user)
        db.commit()
    token = create_access_token(subject=user.email, role=user.role)
    return {"Authorization": f"Bearer {token}"}

def test_e2e_disruption_detection_and_rerouting_scenario(db):
    """
    Complete Phase 2 Scenario:
    1. Active vehicle NER-V001 / delivery DEL-2026-001 en route Guwahati -> Imphal.
    2. Event: Critical landslide and torrential rain on Senapati sector.
    3. Road status transitions to BLOCKED, accessibility score = 0.
    4. ReroutingService detects affected vehicle & consignment.
    5. Calculates alternative Route B via Silchar / Jiribam (NH37).
    6. Verifies deterministic comparisons (distance, time, ETA shift).
    7. Verifies RouteDecision stored in DB with PROPOSED status.
    8. Verifies operational REROUTE_RECOMMENDED Alert created.
    9. Approves route decision and confirms delivery trajectory updated.
    """
    # --- 1. INITIAL STATE SETUP ---
    corridor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH27").first()
    assert corridor is not None, "COR-NH27 must exist"
    
    # Clean previous test incidents on this corridor
    db.query(Incident).filter(Incident.location_name.ilike("%Senapati%")).delete()
    db.query(Alert).filter(Alert.corridor_code == "COR-NH27").delete()
    db.query(RouteDecision).filter(RouteDecision.corridor_code == "COR-NH27").delete()
    db.commit()

    # Ensure active delivery DEL-2026-001 exists and is in IN_TRANSIT state
    deliv = db.query(Delivery).filter(Delivery.delivery_code == "DEL-2026-001").first()
    veh = db.query(Vehicle).filter(Vehicle.vehicle_code == "NER-V001").first()
    now = datetime.utcnow()
    if not deliv:
        deliv = Delivery(
            delivery_code="DEL-2026-001",
            cargo_name="Critical Vaccines & Essential Medicines",
            cargo_type="Medical Supplies",
            cargo_category="Medicines",
            priority="EMERGENCY",
            origin_city="Guwahati",
            destination_city="Imphal",
            assigned_vehicle_id=veh.id if veh else None,
            driver_name="Ramesh Sharma",
            status="IN_TRANSIT",
            original_eta=now + timedelta(hours=11),
            revised_eta=now + timedelta(hours=11),
            estimated_delay_mins=0,
            route_risk_score=18.0,
            route_risk_category="LOW",
            active_route_path=json.dumps(PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS)
        )
        db.add(deliv)
    else:
        deliv.status = "IN_TRANSIT"
        deliv.origin_city = "Guwahati"
        deliv.destination_city = "Imphal"
        deliv.active_route_path = json.dumps(PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS)
        deliv.assigned_vehicle_id = veh.id if veh else deliv.assigned_vehicle_id
        db.query(RouteDecision).filter(RouteDecision.delivery_id == deliv.id).delete()
    db.commit()
    db.refresh(deliv)


    # Initial recalculation to verify OPEN baseline
    AccessibilityEngine.recalculate_all_accessibility(db)
    db.refresh(corridor)

    # --- 2. DISRUPTION EVENT TRIGGER ---
    # Report a critical landslide at Senapati Mountain Pass
    test_incident = Incident(
        incident_type="LANDSLIDE",
        description="Massive rockfall and slope collapse blocking NH27/NH2 mountain pass near Senapati",
        latitude=25.2676,
        longitude=94.0210,
        location_name="Senapati Mountain Pass",
        district_name="Senapati",
        severity="CRITICAL",
        road_status="BLOCKED",
        reporter_name="Inspector T. Kipgen",
        is_synced=True
    )
    db.add(test_incident)

    # Add torrential rainfall weather record (55 mm/hr)
    weather = WeatherRecord(
        location_name="Senapati",
        state="Manipur",
        temperature_c=18.0,
        rainfall_mm_hr=55.0,
        condition="Torrential Downpour",
        wind_kmh=45.0
    )
    db.add(weather)
    db.commit()
    db.refresh(test_incident)

    # --- 3. ACCESSIBILITY UPDATE CASCADE ---
    result = AccessibilityEngine.recalculate_all_accessibility(db, source_incident=test_incident)
    db.refresh(corridor)

    # Verify accessibility has dropped to BLOCKED
    assert corridor.accessibility_score == 0.0, f"Expected 0.0 but got {corridor.accessibility_score}"
    assert corridor.status == "BLOCKED"
    assert corridor.accessibility_status == "BLOCKED"
    assert corridor.risk_level == "CRITICAL"
    assert "Landslide" in corridor.reason or "blockage" in corridor.factor_summary.lower()

    # --- 4. IDENTIFY AFFECTED VEHICLES & DELIVERIES ---
    affected = ReroutingService.find_affected_vehicles_and_deliveries(corridor, db)
    assert len(affected["deliveries"]) >= 1, "Must find at least DEL-2026-001"
    matched_codes = [d.delivery_code for d in affected["deliveries"]]
    assert "DEL-2026-001" in matched_codes
    assert len(affected["vehicles"]) >= 1, "Must identify active assigned vehicle"

    # --- 5. ALTERNATIVE ROUTE & DETERMINISTIC COMPARISONS ---
    decision = db.query(RouteDecision).filter(
        RouteDecision.delivery_id == deliv.id,
        RouteDecision.corridor_code == "COR-NH27"
    ).first()
    assert decision is not None, "RouteDecision must be stored in database"

    # Verify deterministic comparisons
    assert decision.original_distance_km == 480.0
    assert decision.alternative_distance_km == 535.0
    assert decision.additional_distance_km == 55.0, f"Expected +55.0 km, got {decision.additional_distance_km}"
    assert decision.additional_time_minutes >= 120, "Detour should add expected transit time"
    assert decision.new_eta > decision.original_eta
    assert decision.risk_score_after < decision.risk_score_before
    assert decision.status == "PROPOSED"
    assert "Route B" in decision.alternative_route_name or "NH-37" in decision.alternative_route_name
    assert decision.waypoints_json is not None

    # Verify predictive components are explicitly labeled
    metadata = json.loads(decision.decision_metadata)
    assert "predictive_components" in metadata
    assert len(metadata["predictive_components"]) >= 3

    # --- 6. OPERATIONAL ALERT GENERATION ---
    alert = db.query(Alert).filter(
        Alert.alert_type == "REROUTE_RECOMMENDED",
        Alert.delivery_id == deliv.id
    ).first()
    assert alert is not None, "Operational Alert must be generated for affected delivery"
    assert alert.severity in ["CRITICAL", "HIGH"]
    assert "DEL-2026-001" in alert.title

    assert "Route B" in alert.message or "NH37" in alert.message or "detour" in alert.message.lower()
    assert alert.recommended_action is not None

    # --- 7. DISPATCHER APPROVAL & EXECUTION ---
    approved_dec = ReroutingService.approve_route_decision(
        decision_id=decision.id,
        user_email="dispatcher@linkx8.in",
        db=db,
        notes="Approved emergency detour for vaccine shipment"
    )

    db.refresh(deliv)
    assert approved_dec.status == "APPROVED"
    assert approved_dec.approved_by == "dispatcher@linkx8.in"
    assert deliv.status == "REROUTED"
    assert deliv.revised_eta == decision.new_eta
    assert deliv.estimated_delay_mins == decision.additional_time_minutes

    # Verify delivery active_route_path has been updated to alternative waypoints
    updated_path = json.loads(deliv.active_route_path)
    assert len(updated_path) == len(ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS)

    # Verify audit log recorded
    audit = db.query(AuditLog).filter(
        AuditLog.action == "APPROVE_ROUTE_DECISION",
        AuditLog.resource == "RouteDecision"
    ).order_by(AuditLog.timestamp.desc()).first()
    assert audit is not None
    assert "DEL-2026-001" in audit.details

    # Clean up test incident
    db.delete(test_incident)
    db.commit()

def test_api_affected_routes(client):
    """Verifies GET /api/v1/routes/affected returns active disrupted corridors and vehicles."""
    response = client.get("/api/v1/routes/affected")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        item = data[0]
        assert "corridor_code" in item
        assert "accessibility_status" in item
        assert "affected_vehicles_count" in item
        assert "affected_deliveries_count" in item
        assert "recommended_detour" in item

def test_api_alternative_candidates(client):
    """Verifies GET /api/v1/routes/alternative-candidates calculates candidate options."""
    response = client.get(
        "/api/v1/routes/alternative-candidates",
        params={"origin": "Guwahati", "destination": "Imphal", "avoid_corridor": "COR-NH27"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "candidate_routes" in data
    assert len(data["candidate_routes"]) >= 2
    assert "recommended_route_id" in data
    assert "tradeoff_analysis" in data

def test_api_eta_comparison(client):
    """Verifies GET /api/v1/routes/eta-comparison returns deterministic comparison and labeled predictive items."""
    response = client.get(
        "/api/v1/routes/eta-comparison",
        params={"origin": "Guwahati", "destination": "Imphal"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "original_route" in data
    assert "alternative_route" in data
    assert "comparison" in data
    assert "additional_distance_km" in data["comparison"]
    assert "additional_time_minutes" in data["comparison"]
    assert "predictive_components" in data
    assert isinstance(data["predictive_components"], list)

def test_api_route_decisions_endpoints(client, db, auth_headers):
    """Verifies GET /api/v1/routes/decisions and approval endpoint."""
    # List decisions
    list_res = client.get("/api/v1/routes/decisions")
    assert list_res.status_code == 200
    decisions = list_res.json()
    assert isinstance(decisions, list)

    if len(decisions) > 0:
        dec_id = decisions[0]["id"]
        # Fetch by ID
        get_res = client.get(f"/api/v1/routes/decisions/{dec_id}")
        assert get_res.status_code == 200
        assert get_res.json()["id"] == dec_id

        # Test approval endpoint
        appr_res = client.post(
            f"/api/v1/routes/decisions/{dec_id}/approve",
            json={"notes": "Approved via REST API test"},
            headers=auth_headers
        )
        assert appr_res.status_code == 200
        assert appr_res.json()["status"] == "APPROVED"

def test_delivery_reroute_endpoint(client, db, auth_headers):
    """Verifies POST /api/v1/deliveries/{id}/reroute delegates cleanly through ReroutingService."""
    deliv = db.query(Delivery).filter(Delivery.delivery_code == "DEL-2026-001").first()
    assert deliv is not None
    response = client.post(f"/api/v1/deliveries/{deliv.id}/reroute", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "REROUTED"
    assert data["route_risk_score"] <= 45.0

