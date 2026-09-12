import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.models import FieldReport, Incident, Bridge, Alert, Corridor
from app.services.accessibility_service import AccessibilityEngine

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_test_sync_db():
    db = SessionLocal()
    db.query(FieldReport).filter(FieldReport.report_code.like("FLD-TEST-%")).delete()
    db.query(Incident).filter(Incident.description.like("%[FLD-TEST-%")).delete()
    db.commit()
    db.close()
    yield

# =========================================================================
# SIH GAP 7 EXPLICIT 10 TEST SCENARIOS
# =========================================================================

def test_gap7_scenario_01_online_sync_normal():
    """TEST 1: Standard field report synchronization uploads normally."""
    payload = {
        "reports": [
            {
                "report_code": "FLD-TEST-001",
                "incident_type": "LANDSLIDE",
                "description": "Minor scree on road shoulder",
                "latitude": 26.1445,
                "longitude": 91.7362,
                "location_name": "Guwahati ISBT Corridor",
                "district_name": "Kamrup Metropolitan",
                "severity": "LOW",
                "road_status": "PASSABLE",
                "sync_status": "PENDING_SYNC"
            }
        ]
    }
    res = client.post("/api/v1/field-reports/sync", json=payload)
    assert res.status_code == 200
    assert res.json()["synced_count"] == 1


def test_gap7_scenario_02_offline_report_accepted():
    """TEST 2: Offline collected incident report is accepted upon network availability."""
    payload = {
        "reports": [
            {
                "report_code": "FLD-TEST-002",
                "incident_type": "ROAD_DAMAGE",
                "description": "Culvert subsidence at Km 42",
                "latitude": 25.5788,
                "longitude": 91.8933,
                "location_name": "Shillong Bypass",
                "district_name": "East Khasi Hills",
                "severity": "HIGH",
                "road_status": "RESTRICTED",
                "sync_status": "PENDING_SYNC"
            }
        ]
    }
    res = client.post("/api/v1/field-reports/sync", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "SUCCESS"


def test_gap7_scenario_03_report_appears_in_synced_list():
    """TEST 3: Synced report is persisted in central database and accessible via GET /field-reports."""
    test_gap7_scenario_01_online_sync_normal()
    res = client.get("/api/v1/field-reports")
    assert res.status_code == 200
    reports = res.json()
    assert any(r["report_code"] == "FLD-TEST-001" for r in reports)


def test_gap7_scenario_04_batch_synchronization():
    """TEST 4: Multiple queued offline reports synchronize in a single atomic batch."""
    payload = {
        "reports": [
            {
                "report_code": "FLD-TEST-003",
                "incident_type": "WATERLOGGING",
                "description": "Low-lying road flooded 0.5m",
                "latitude": 26.3467,
                "longitude": 92.6840,
                "location_name": "Nagaon Bypass",
                "district_name": "Nagaon",
                "severity": "MEDIUM",
                "road_status": "RESTRICTED",
                "sync_status": "PENDING_SYNC"
            },
            {
                "report_code": "FLD-TEST-004",
                "incident_type": "ROCKFALL",
                "description": "Boulder on left lane",
                "latitude": 25.6751,
                "longitude": 94.1086,
                "location_name": "Kohima Ridge",
                "district_name": "Kohima",
                "severity": "HIGH",
                "road_status": "PARTIAL",
                "sync_status": "PENDING_SYNC"
            }
        ]
    }
    res = client.post("/api/v1/field-reports/sync", json=payload)
    assert res.status_code == 200
    assert res.json()["synced_count"] == 2


def test_gap7_scenario_05_marked_synced():
    """TEST 5: Synced records have status updated to SYNCED in the database."""
    test_gap7_scenario_01_online_sync_normal()
    db = SessionLocal()
    fr = db.query(FieldReport).filter(FieldReport.report_code == "FLD-TEST-001").first()
    assert fr is not None
    assert fr.sync_status == "SYNCED"
    db.close()


def test_gap7_scenario_06_idempotent_deduplication():
    """TEST 6: Retrying sync with the same report_code does not create duplicate Incidents or FieldReports."""
    payload = {
        "reports": [
            {
                "report_code": "FLD-TEST-005",
                "incident_type": "LANDSLIDE",
                "description": "Mudslide on NH29",
                "latitude": 25.2676,
                "longitude": 94.0210,
                "location_name": "Senapati Hill Pass",
                "district_name": "Senapati",
                "severity": "HIGH",
                "road_status": "BLOCKED",
                "sync_status": "PENDING_SYNC"
            }
        ]
    }
    # First sync
    res1 = client.post("/api/v1/field-reports/sync", json=payload)
    assert res1.status_code == 200

    # Second sync (simulating network retry / re-upload)
    res2 = client.post("/api/v1/field-reports/sync", json=payload)
    assert res2.status_code == 200

    # Verify only ONE FieldReport exists for this report_code
    db = SessionLocal()
    reports = db.query(FieldReport).filter(FieldReport.report_code == "FLD-TEST-005").all()
    assert len(reports) == 1

    # Verify only ONE Incident exists with this report tag
    incidents = db.query(Incident).filter(Incident.description.like("%[FLD-TEST-005]%")).all()
    assert len(incidents) == 1
    db.close()


def test_gap7_scenario_07_invalid_coordinates_rejected():
    """TEST 7: Offline report with invalid coordinates (>90 lat) is rejected with HTTP 422."""
    bad_payload = {
        "reports": [
            {
                "report_code": "FLD-TEST-BAD-01",
                "incident_type": "LANDSLIDE",
                "description": "Corrupted GPS coordinates",
                "latitude": 105.5000, # Out of range
                "longitude": 91.7362,
                "location_name": "Invalid Location",
                "district_name": "Kamrup",
                "severity": "HIGH",
                "road_status": "BLOCKED",
                "sync_status": "PENDING_SYNC"
            }
        ]
    }
    res = client.post("/api/v1/field-reports/sync", json=bad_payload)
    assert res.status_code == 422
    assert "latitude" in res.json()["detail"].lower()


def test_gap7_scenario_08_bridge_damage_updates_bridge_and_accessibility():
    """TEST 8: Synced bridge damage report updates Bridge model and triggers accessibility recalculation."""
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH37-02").first()
    assert bridge is not None
    db.close()

    payload = {
        "reports": [
            {
                "report_code": "FLD-TEST-BRG-01",
                "incident_type": "BRIDGE_DAMAGE",
                "description": "Pier displacement after flash flood",
                "latitude": bridge.latitude,
                "longitude": bridge.longitude,
                "location_name": bridge.name,
                "district_name": bridge.district_name,
                "affected_bridge_code": bridge.bridge_code,
                "severity": "CRITICAL",
                "road_status": "CLOSED",
                "sync_status": "PENDING_SYNC"
            }
        ]
    }
    res = client.post("/api/v1/field-reports/sync", json=payload)
    assert res.status_code == 200

    # Verify bridge status updated to CLOSED
    db = SessionLocal()
    updated_b = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH37-02").first()
    assert updated_b.status == "CLOSED"
    assert updated_b.load_restriction_type == "Closed"

    # Reset bridge
    updated_b.status = "OPERATIONAL"
    updated_b.load_restriction_type = "No Restriction"
    db.commit()
    db.close()


def test_gap7_scenario_09_operational_alert_created_on_sync():
    """TEST 9: Syncing high/critical severity report automatically generates an operational Alert in the database."""
    payload = {
        "reports": [
            {
                "report_code": "FLD-TEST-ALERT-01",
                "incident_type": "MUDSLIDE",
                "description": "Massive mudslide blocking both lanes",
                "latitude": 25.2676,
                "longitude": 94.0210,
                "location_name": "Senapati Gorge Pass",
                "district_name": "Senapati",
                "severity": "CRITICAL",
                "road_status": "BLOCKED",
                "sync_status": "PENDING_SYNC"
            }
        ]
    }
    res = client.post("/api/v1/field-reports/sync", json=payload)
    assert res.status_code == 200

    alerts_res = client.get("/api/v1/alerts")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert any(a["alert_type"] == "OFFLINE_SYNC_INCIDENT" for a in alerts)


def test_gap7_scenario_10_integrated_offline_to_route_optimization():
    """TEST 10: Integrated flow — offline incident sync directly impacts downstream AI route optimization."""
    # Step 1: Sync a blockage report on NH29
    payload = {
        "reports": [
            {
                "report_code": "FLD-TEST-REROUTE-01",
                "incident_type": "MAJOR_LANDSLIDE",
                "description": "Complete highway blockage at Kohima Pass",
                "latitude": 25.6751,
                "longitude": 94.1086,
                "location_name": "Kohima Pass (NH29)",
                "district_name": "Kohima",
                "severity": "CRITICAL",
                "road_status": "BLOCKED",
                "sync_status": "PENDING_SYNC"
            }
        ]
    }
    sync_res = client.post("/api/v1/field-reports/sync", json=payload)
    assert sync_res.status_code == 200

    # Step 2: Query route optimizer for Guwahati -> Imphal
    opt_res = client.post("/api/v1/routes/optimize", json={
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "optimization_objective": "SAFEST"
    })
    assert opt_res.status_code == 200
    opt_data = opt_res.json()

    # Route A should be marked blocked / disqualified, recommending alternate Route B
    route_a = [r for r in opt_data["candidate_routes"] if r["id"] == "ROUTE_A"][0]
    assert route_a["is_blocked"] is True or opt_data["recommended_route_id"] != "ROUTE_A"
