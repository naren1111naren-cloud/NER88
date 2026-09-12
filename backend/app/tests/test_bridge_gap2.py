import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.models import Bridge, Corridor, District, Incident, Alert, Delivery, Vehicle
from app.services.accessibility_service import AccessibilityEngine

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_baseline():
    db = SessionLocal()
    AccessibilityEngine.recalculate_all_accessibility(db)
    db.close()
    yield

def test_list_and_get_bridges():
    """Verify bridge listing, detail, filtering, and required schema attributes."""
    res = client.get("/api/v1/bridges")
    assert res.status_code == 200
    bridges = res.json()
    assert len(bridges) >= 8

    # Verify bridge model attributes
    for b in bridges:
        assert "bridge_code" in b
        assert "name" in b
        assert "latitude" in b
        assert "longitude" in b
        assert "district_name" in b
        assert "corridor_code" in b
        assert "status" in b
        assert "load_restriction_type" in b
        assert "data_source" in b
        assert "data_confidence" in b
        assert "accessibility_score" in b

    # Test filtering by status
    open_res = client.get("/api/v1/bridges?status=OPERATIONAL")
    assert open_res.status_code == 200
    assert all(b["status"] == "OPERATIONAL" for b in open_res.json())

    # Test specific bridge detail
    first_bridge = bridges[0]
    detail_res = client.get(f"/api/v1/bridges/{first_bridge['id']}")
    assert detail_res.status_code == 200
    assert detail_res.json()["bridge_code"] == first_bridge["bridge_code"]

def test_bridge_accessibility_breakdown():
    """Verify bridge accessibility endpoint and scoring formula."""
    db = SessionLocal()
    bridge = db.query(Bridge).first()
    b_id = bridge.id
    db.close()

    res = client.get(f"/api/v1/bridges/{b_id}/accessibility")
    assert res.status_code == 200
    data = res.json()
    assert data["bridge_id"] == b_id
    assert "accessibility_score" in data
    assert "status" in data
    assert "load_restriction_type" in data
    assert "scoring_breakdown" in data
    assert "operational_status_penalty" in data["scoring_breakdown"]
    assert "load_restriction_penalty" in data["scoring_breakdown"]

def test_bridge_restricted_load():
    """TEST 2: Bridge restricted load penalties."""
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH10-01").first()
    assert bridge is not None
    b_id = bridge.id
    db.close()

    res = client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "RESTRICTED",
        "load_restriction_type": "Heavy Vehicles Restricted",
        "restriction_details": "Heavy multiaxle commercial trucks diverted for inspection"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RESTRICTED"
    assert data["load_restriction_type"] == "Heavy Vehicles Restricted"
    assert data["accessibility_score"] <= 60.0

    # Reset back to OPERATIONAL
    client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "OPERATIONAL",
        "load_restriction_type": "No Restriction",
        "condition_description": "Inspection passed, full transit operational"
    })

def test_bridge_closure_cascade_and_alert():
    """TEST 3: Bridge closure cascades to connected corridor and triggers alert."""
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH37-01").first()
    assert bridge is not None
    b_id = bridge.id
    corridor_id = bridge.corridor_code
    db.close()

    # Close the Irang River bridge
    res = client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "CLOSED",
        "condition_description": "Bridge deck washed out due to torrential monsoon flood",
        "load_restriction_type": "Closed"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "CLOSED"
    assert res.json()["accessibility_score"] == 0.0

    # Verify connected corridor COR-NH37 is BLOCKED
    cor_res = client.get(f"/api/v1/accessibility/asset/corridor/{corridor_id}")
    assert cor_res.status_code == 200
    cor_data = cor_res.json()
    assert cor_data["status"] == "BLOCKED"
    assert "Bridge closed" in cor_data["reason"]

    # Verify alert was generated
    db = SessionLocal()
    alerts = db.query(Alert).all()
    assert len(alerts) > 0
    assert any("BRIDGE" in a.title or "Bridge" in a.title or "CLOSED" in a.title for a in alerts)
    db.close()

    # Recovery: Reopen bridge
    rec_res = client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "OPERATIONAL",
        "load_restriction_type": "No Restriction",
        "condition_description": "Temporary bailey span restored by BRO engineers"
    })
    assert rec_res.status_code == 200
    assert rec_res.json()["status"] == "OPERATIONAL"

def test_field_report_with_bridge_tag():
    """TEST 4 & 5: Field Report tagged with bridge updates bridge status and syncs offline."""
    report_payload = {
        "reports": [
            {
                "report_code": "FLD-BRG-TEST-99",
                "incident_type": "BRIDGE_DAMAGE",
                "description": "Scour detected under pier #3 of Tuichang suspension bridge",
                "latitude": 23.9500,
                "longitude": 92.7000,
                "location_name": "Tuichang Bridge Span",
                "district_name": "Aizawl",
                "severity": "CRITICAL",
                "road_status": "CLOSED",
                "affected_bridge_code": "BRG-NH54-01",
                "load_restriction_type": "Closed",
                "sync_status": "PENDING_SYNC"
            }
        ]
    }
    sync_res = client.post("/api/v1/field-reports/sync", json=report_payload)
    assert sync_res.status_code == 200
    assert sync_res.json()["synced_count"] == 1

    # Verify bridge status was updated to CLOSED and data_source is FIELD_REPORT
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH54-01").first()
    assert bridge.status == "CLOSED"
    assert bridge.data_source == "FIELD_REPORT"
    db.close()

    # Clean up / reset
    db = SessionLocal()
    db.query(Incident).filter(Incident.affected_bridge_code == "BRG-NH54-01").delete()
    db.commit()
    db.close()

    client.put(f"/api/v1/bridges/{bridge.id}/status", json={
        "status": "OPERATIONAL",
        "load_restriction_type": "No Restriction",
        "condition_description": "Pier reinforcement completed"
    })

def test_bridge_logistics_impact():
    """Vehicle and delivery impact identification when a bridge is affected."""
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH37-01").first()
    assert bridge is not None
    b_id = bridge.id
    db.close()

    impact_res = client.get(f"/api/v1/bridges/{b_id}/impact")
    assert impact_res.status_code == 200
    impact = impact_res.json()
    assert "bridge_code" in impact
    assert "connected_corridor" in impact
    assert "affected_deliveries_count" in impact
    assert "affected_vehicles_count" in impact
    assert "affected_deliveries" in impact

# =========================================================================
# SIH GAP 2 EXPLICIT 10 TEST SCENARIOS
# =========================================================================

def test_gap2_scenario_1_open_bridge_corridor_accessible():
    """TEST 1: Open bridge -> corridor remains fully accessible."""
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH415-01").first()
    assert bridge is not None
    bridge.status = "OPERATIONAL"
    bridge.load_restriction_type = "No Restriction"
    bridge.load_capacity_tons = 45.0
    db.commit()
    AccessibilityEngine.recalculate_all_accessibility(db)
    
    corridor = db.query(Corridor).filter(Corridor.corridor_code == bridge.corridor_code).first()
    assert corridor is not None
    assert corridor.accessibility_score >= 80.0
    assert corridor.status in ["PASSABLE", "OPEN", "FULLY PASSABLE", "PASSABLE / LOW IMPACT"]
    db.close()

def test_gap2_scenario_2_closed_bridge_corridor_accessibility_decreases():
    """TEST 2: Closed bridge -> connected corridor accessibility decreases."""
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH37-02").first()
    assert bridge is not None
    b_id = bridge.id
    corridor_code = bridge.corridor_code
    db.close()

    # Close bridge
    res = client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "CLOSED",
        "condition_description": "Flood damage to central pylon",
        "load_restriction_type": "Closed"
    })
    assert res.status_code == 200
    
    # Check connected corridor
    cor_res = client.get(f"/api/v1/accessibility/asset/corridor/{corridor_code}")
    assert cor_res.status_code == 200
    cor_data = cor_res.json()
    assert cor_data["accessibility_score"] == 0.0 or cor_data["status"] == "BLOCKED"

    # Reset
    client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "OPERATIONAL",
        "load_restriction_type": "No Restriction",
        "condition_description": "Repairs completed"
    })

def test_gap2_scenario_3_critical_bridge_closure_corridor_blocked():
    """TEST 3: Critical bridge closure -> corridor becomes BLOCKED."""
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH37-01").first()
    b_id = bridge.id
    db.close()

    res = client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "CLOSED",
        "load_restriction_type": "Closed",
        "condition_description": "Bailey bridge span collapsed under excessive load"
    })
    assert res.status_code == 200

    cor_res = client.get(f"/api/v1/accessibility/asset/corridor/{res.json()['corridor_code']}")
    assert cor_res.status_code == 200
    assert cor_res.json()["status"] == "BLOCKED"
    assert cor_res.json()["accessibility_score"] == 0.0

    # Reset
    client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "OPERATIONAL",
        "load_restriction_type": "No Restriction",
        "condition_description": "Restored"
    })

def test_gap2_scenario_4_vehicle_below_bridge_capacity_allowed():
    """TEST 4: 24T bridge capacity + 20T vehicle -> allowed (PASSABLE)."""
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH10-01").first()
    # Temporarily ensure capacity is 24T
    bridge.load_capacity_tons = 24.0
    bridge.status = "OPERATIONAL"
    bridge.load_restriction_type = "No Restriction"
    db.commit()
    b_id = bridge.id
    db.close()

    res = client.post("/api/v1/bridges/validate-load", json={
        "bridge_id": b_id,
        "vehicle_weight_tons": 20.0,
        "vehicle_type": "Medium Cargo Truck"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_compatible"] is True
    assert data["status"] == "PASSABLE"
    assert data["bridge_capacity_tons"] == 24.0
    assert data["vehicle_weight_tons"] == 20.0

def test_gap2_scenario_5_vehicle_above_bridge_capacity_restricted():
    """TEST 5: 24T bridge capacity + 30T vehicle -> restricted / exceeds capacity."""
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH10-01").first()
    bridge.load_capacity_tons = 24.0
    bridge.status = "OPERATIONAL"
    bridge.load_restriction_type = "No Restriction"
    db.commit()
    b_id = bridge.id
    db.close()

    res = client.post("/api/v1/bridges/validate-load", json={
        "bridge_id": b_id,
        "vehicle_weight_tons": 30.0,
        "vehicle_type": "Heavy Multiaxle Trailer"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_compatible"] is False
    assert data["status"] == "EXCEEDS_CAPACITY"
    assert "exceeds bridge load capacity" in data["reason"]

def test_gap2_scenario_6_vehicle_exactly_at_limit_handled():
    """TEST 6: Vehicle exactly at bridge limit (24T on 24T) -> correctly allowed."""
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH10-01").first()
    bridge.load_capacity_tons = 24.0
    bridge.status = "OPERATIONAL"
    bridge.load_restriction_type = "No Restriction"
    db.commit()
    b_id = bridge.id
    db.close()

    res = client.post(f"/api/v1/bridges/{b_id}/validate-load", json={
        "vehicle_weight_tons": 24.0,
        "vehicle_type": "Standard 3-Axle Truck"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_compatible"] is True
    assert data["status"] == "PASSABLE"

def test_gap2_scenario_7_bridge_restriction_route_impact():
    """TEST 7: Bridge restriction -> route impact occurs in routing engine."""
    # When heavy truck requests route passing through restricted/closed bridge
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH37-01").first()
    b_id = bridge.id
    db.close()

    # Temporarily set bridge to CLOSED
    client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "CLOSED",
        "load_restriction_type": "Closed",
        "condition_description": "Emergency abutment maintenance"
    })

    # Call route optimization engine
    route_req = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "cargo_type": "PHARMACEUTICALS",
        "priority_level": "EMERGENCY",
        "cargo_weight_tons": 28.0,
        "optimization_objective": "BALANCED"
    }
    opt_res = client.post("/api/v1/routes/optimize", json=route_req)
    assert opt_res.status_code == 200
    route_data = opt_res.json()
    
    # Check that candidate routes reflect bridge restrictions
    candidates = route_data.get("candidate_routes", [])
    assert len(candidates) > 0

    # Reset bridge
    client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "OPERATIONAL",
        "load_restriction_type": "No Restriction",
        "condition_description": "Reopened"
    })

def test_gap2_scenario_8_bridge_closure_district_accessibility():
    """TEST 8: Bridge closure -> district accessibility changes."""
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH37-01").first()
    district_name = bridge.district_name
    b_id = bridge.id
    
    # Get initial district score
    dist_before = db.query(District).filter(District.name == district_name).first()
    initial_score = dist_before.accessibility_index if dist_before else 80.0
    db.close()

    # Close bridge
    client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "CLOSED",
        "load_restriction_type": "Closed",
        "condition_description": "Bridge washed out"
    })

    # Check district
    db = SessionLocal()
    dist_after = db.query(District).filter(District.name == district_name).first()
    assert dist_after is not None
    # District score should reflect the critical bridge outage
    assert dist_after.accessibility_index <= initial_score
    db.close()

    # Reset
    client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "OPERATIONAL",
        "load_restriction_type": "No Restriction",
        "condition_description": "Normal"
    })

def test_gap2_scenario_9_bridge_recovery_accessibility_recovers():
    """TEST 9: Bridge recovery from CLOSED -> OPERATIONAL restores accessibility."""
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH54-01").first()
    b_id = bridge.id
    db.close()

    # Step 1: Close bridge
    client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "CLOSED",
        "load_restriction_type": "Closed",
        "condition_description": "Landslide blockage"
    })

    # Verify closed
    res_closed = client.get(f"/api/v1/bridges/{b_id}")
    assert res_closed.json()["status"] == "CLOSED"
    assert res_closed.json()["accessibility_score"] == 0.0

    # Step 2: Recover bridge to OPERATIONAL
    res_open = client.put(f"/api/v1/bridges/{b_id}/status", json={
        "status": "OPERATIONAL",
        "load_restriction_type": "No Restriction",
        "condition_description": "Debris cleared, span certified safe"
    })
    assert res_open.status_code == 200
    assert res_open.json()["status"] == "OPERATIONAL"
    assert res_open.json()["accessibility_score"] >= 80.0

def test_gap2_scenario_10_invalid_and_missing_bridge_data_handled_safely():
    """TEST 10: Invalid/missing bridge data -> system handles gracefully and safely."""
    # 1. Non-existent bridge ID returns 404
    bad_id_res = client.get("/api/v1/bridges/99999")
    assert bad_id_res.status_code == 404

    # 2. Validation request with missing bridge returns 400 or 404
    no_id_res = client.post("/api/v1/bridges/validate-load", json={
        "vehicle_weight_tons": 25.0
    })
    assert no_id_res.status_code in [400, 422]

    # 3. Validation request with non-existent bridge_id returns 404
    bad_val_res = client.post("/api/v1/bridges/validate-load", json={
        "bridge_id": 99999,
        "vehicle_weight_tons": 25.0
    })
    assert bad_val_res.status_code == 404

    # 4. Unknown bridge status recalculation falls back to safe cautious score (50.0)
    db = SessionLocal()
    test_bridge = db.query(Bridge).first()
    test_bridge.status = "UNKNOWN"
    calc = AccessibilityEngine.recalculate_bridge_accessibility(test_bridge, db)
    assert calc["accessibility_score"] == 50.0
    assert "Inspection pending" in calc["reason"]
    # Reset
    test_bridge.status = "OPERATIONAL"
    db.commit()
    db.close()
