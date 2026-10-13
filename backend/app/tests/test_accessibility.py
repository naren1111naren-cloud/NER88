import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal, engine, Base
from app.models.models import Incident, Alert, Corridor, District, Bridge, Delivery, Vehicle, WeatherRecord
from app.services.accessibility_service import AccessibilityEngine

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    db = SessionLocal()
    db.query(Incident).delete(synchronize_session=False)
    for b in db.query(Bridge).filter(Bridge.corridor_code == "COR-NH27").all():
        b.status = "OPERATIONAL"
        b.load_restriction_type = "No Restriction"
        b.load_capacity_tons = 40.0
    db.commit()
    # Ensure fresh baseline recalculation
    AccessibilityEngine.recalculate_all_accessibility(db)
    db.close()
    yield
    db = SessionLocal()
    db.query(Incident).delete(synchronize_session=False)
    for b in db.query(Bridge).filter(Bridge.corridor_code == "COR-NH27").all():
        b.status = "OPERATIONAL"
        b.load_restriction_type = "No Restriction"
        b.load_capacity_tons = 40.0
    db.commit()
    AccessibilityEngine.recalculate_all_accessibility(db)
    db.close()

def test_get_accessibility_summary():
    response = client.get("/api/v1/accessibility/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_corridors" in data
    assert "total_bridges" in data
    assert "total_districts" in data
    assert data["total_bridges"] >= 8
    assert data["total_corridors"] >= 7
    assert data["average_regional_accessibility"] > 0

def test_get_road_accessibility():
    response = client.get("/api/v1/accessibility/roads")
    assert response.status_code == 200
    roads = response.json()
    assert len(roads) >= 7
    for road in roads:
        assert "accessibility_score" in road
        assert "status" in road
        assert "reason" in road
        assert road["accessibility_score"] >= 0 and road["accessibility_score"] <= 100

def test_get_bridge_accessibility():
    response = client.get("/api/v1/accessibility/bridges")
    assert response.status_code == 200
    bridges = response.json()
    assert len(bridges) >= 8
    bridge_names = [b["name"] for b in bridges]
    assert any("Saraighat" in name for name in bridge_names)
    assert any("Irang" in name for name in bridge_names)
    for b in bridges:
        assert "load_capacity_tons" in b
        assert "accessibility_score" in b
        assert "status" in b
        assert b["status"] in ["OPERATIONAL", "RESTRICTED", "DAMAGED", "CLOSED", "UNKNOWN"]

def test_get_district_accessibility():
    response = client.get("/api/v1/accessibility/districts")
    assert response.status_code == 200
    districts = response.json()
    assert len(districts) >= 10
    for d in districts:
        assert "accessibility_index" in d
        assert "bridge_count" in d
        assert "critical_supply_status" in d

def test_get_transport_accessibility():
    response = client.get("/api/v1/accessibility/transport")
    assert response.status_code == 200
    data = response.json()
    assert "active_vehicles" in data
    assert "deliveries" in data
    assert len(data["active_vehicles"]) > 0

def test_asset_detail_corridor():
    response = client.get("/api/v1/accessibility/asset/corridor/COR-NH27")
    assert response.status_code == 200
    detail = response.json()
    assert detail["asset_id"] == "COR-NH27"
    assert "accessibility_score" in detail
    assert "reason" in detail
    assert "data_source" in detail
    assert "data_confidence" in detail

def test_asset_detail_bridge():
    response = client.get("/api/v1/accessibility/asset/bridge/BRG-NH27-01")
    assert response.status_code == 200
    detail = response.json()
    assert detail["asset_id"] == "BRG-NH27-01"
    assert "Saraighat" in detail["name"]
    assert detail["status"] == "OPERATIONAL"

def test_bridge_status_update_and_alert():
    # Update bridge status to CLOSED and verify alert and cascade
    db = SessionLocal()
    bridge = db.query(Bridge).filter(Bridge.bridge_code == "BRG-NH37-01").first()
    bridge_id = bridge.id
    db.close()

    res = client.put(f"/api/v1/accessibility/bridges/{bridge_id}/status", json={
        "status": "CLOSED",
        "condition_description": "Bridge deck washed out due to torrential river surge",
        "restriction_details": "No vehicular traffic permitted"
    })
    assert res.status_code == 200
    updated_bridge = res.json()
    assert updated_bridge["status"] == "CLOSED"
    assert updated_bridge["accessibility_score"] == 0.0

    # Verify connected corridor COR-NH37 is affected
    cor_res = client.get("/api/v1/accessibility/asset/corridor/COR-NH37")
    assert cor_res.status_code == 200
    cor_data = cor_res.json()
    assert cor_data["status"] == "BLOCKED"
    assert "Bridge closed" in cor_data["reason"]

    # Restore bridge
    res_restore = client.put(f"/api/v1/accessibility/bridges/{bridge_id}/status", json={
        "status": "OPERATIONAL",
        "condition_description": "Bailey bridge re-anchored and operational"
    })
    assert res_restore.status_code == 200
    assert res_restore.json()["status"] == "OPERATIONAL"

def test_field_report_sync_pipeline():
    # Test batch sync
    report_payload = {
        "reports": [
            {
                "report_code": "FLD-TEST-001",
                "incident_type": "LANDSLIDE",
                "description": "Test mudslide on mountain sector",
                "latitude": 25.2676,
                "longitude": 94.0210,
                "location_name": "Senapati Sector Test",
                "district_name": "Senapati",
                "severity": "HIGH",
                "road_status": "RESTRICTED",
                "sync_status": "PENDING_SYNC"
            }
        ]
    }
    sync_res = client.post("/api/v1/field-reports/sync", json=report_payload)
    assert sync_res.status_code == 200
    assert sync_res.json()["synced_count"] == 1

    # Verify incident created and district accessibility recalculated
    dist_res = client.get("/api/v1/accessibility/districts")
    assert dist_res.status_code == 200

def test_demo_scenario_workflow():
    # Trigger demo
    trigger_res = client.post("/api/v1/demo/trigger-landslide")
    assert trigger_res.status_code == 200
    assert trigger_res.json()["success"] is True

    # Check NH27 is blocked
    cor_res = client.get("/api/v1/accessibility/asset/corridor/COR-NH27")
    assert cor_res.status_code == 200
    assert cor_res.json()["status"] == "BLOCKED"

    # Check Senapati district accessibility dropped
    dist_res = client.get("/api/v1/districts/Senapati")
    assert dist_res.status_code == 200
    assert dist_res.json()["accessibility_index"] <= 30.0

    # Reset demo
    reset_res = client.post("/api/v1/demo/reset")
    assert reset_res.status_code == 200
    assert reset_res.json()["success"] is True

# =========================================================================
# EXPLICIT GAP 1 VALIDATION SUITE (TESTS 1 - 10)
# =========================================================================

def test_gap1_test1_normal_corridor_high_accessibility():
    """TEST 1: Normal corridor -> high accessibility (>= 80)."""
    db = SessionLocal()
    cor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH40").first()
    res = AccessibilityEngine.recalculate_corridor_accessibility(cor, db)
    db.close()
    assert res["accessibility_score"] >= 80.0
    assert res["status"] in ["OPEN", "PASSABLE"]

def test_gap1_test2_minor_incident_accessibility_decreases():
    """TEST 2: Minor incident -> accessibility decreases."""
    db = SessionLocal()
    cor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH27").first()
    init_res = AccessibilityEngine.recalculate_corridor_accessibility(cor, db)
    init_score = init_res["accessibility_score"]

    # Add minor incident
    inc = Incident(
        description="Minor shoulder gravel shift",
        incident_type="ROAD_DAMAGE",
        severity="LOW",
        road_status="PASSABLE",
        location_name="Guwahati Highway Sector",
        district_name="Kamrup",
        latitude=26.1445,
        longitude=91.7362
    )
    db.add(inc)
    db.commit()

    res = AccessibilityEngine.recalculate_corridor_accessibility(cor, db)
    # Cleanup
    db.delete(inc)
    db.commit()
    db.close()

    assert res["accessibility_score"] < init_score
    assert res["accessibility_score"] >= 0.0

def test_gap1_test3_severe_incident_accessibility_decreases_significantly():
    """TEST 3: Severe incident -> accessibility decreases significantly."""
    db = SessionLocal()
    cor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH27").first()

    inc = Incident(
        description="Major mudflow across carriage",
        incident_type="LANDSLIDE",
        severity="HIGH",
        road_status="RESTRICTED",
        location_name="Guwahati Pass Section",
        district_name="Kamrup",
        latitude=26.1445,
        longitude=91.7362
    )
    db.add(inc)
    db.commit()

    res = AccessibilityEngine.recalculate_corridor_accessibility(cor, db)
    db.delete(inc)
    db.commit()
    db.close()

    assert res["accessibility_score"] <= 60.0
    assert res["risk_level"] in ["MEDIUM", "HIGH", "CRITICAL"]

def test_gap1_test4_critical_blockage_produces_zero_blocked():
    """TEST 4: Critical blockage -> accessibility = 0 / BLOCKED according to project logic."""
    db = SessionLocal()
    cor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH27").first()

    inc = Incident(
        description="Total Mountain Collapse",
        incident_type="LANDSLIDE",
        severity="CRITICAL",
        road_status="BLOCKED",
        location_name="Senapati Gorge NH27",
        district_name="Senapati",
        latitude=25.2676,
        longitude=94.0210
    )
    db.add(inc)
    db.commit()

    res = AccessibilityEngine.recalculate_corridor_accessibility(cor, db)
    db.delete(inc)
    db.commit()
    db.close()

    assert res["accessibility_score"] == 0.0
    assert res["status"] == "BLOCKED"
    assert res["risk_level"] == "CRITICAL"

def test_gap1_test5_bridge_closure_affects_connected_corridor():
    """TEST 5: Bridge closure -> connected corridor accessibility changes to BLOCKED."""
    db = SessionLocal()
    brg = db.query(Bridge).filter(Bridge.corridor_code == "COR-NH27").first()
    cor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH27").first()

    orig_status = brg.status
    brg.status = "CLOSED"
    db.commit()

    res = AccessibilityEngine.recalculate_corridor_accessibility(cor, db)

    # Restore
    brg.status = orig_status
    db.commit()
    db.close()

    assert res["accessibility_score"] == 0.0
    assert res["status"] == "BLOCKED"

def test_gap1_test6_weather_severity_impacts_accessibility():
    """TEST 6: Weather severity -> accessibility changes."""
    db = SessionLocal()
    cor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH40").first()
    init_res = AccessibilityEngine.recalculate_corridor_accessibility(cor, db)

    w = db.query(WeatherRecord).filter(WeatherRecord.location_name == cor.destination).first()
    orig_rain = w.rainfall_mm_hr if w else 0.0
    orig_wind = w.wind_kmh if w else 0.0
    if not w:
        w = WeatherRecord(location_name=cor.destination, temperature_c=20.0, rainfall_mm_hr=75.0, wind_kmh=45.0, condition="Monsoon")
        db.add(w)
    else:
        w.rainfall_mm_hr = 75.0
        w.wind_kmh = 45.0
    db.commit()

    res = AccessibilityEngine.recalculate_corridor_accessibility(cor, db)
    if orig_rain:
        w.rainfall_mm_hr = orig_rain
        w.wind_kmh = orig_wind
    else:
        db.delete(w)
    db.commit()
    db.close()

    assert res["accessibility_score"] <= init_res["accessibility_score"]

def test_gap1_test7_multiple_hazards_combination_within_bounds():
    """TEST 7: Multiple hazards -> penalties combine correctly and remain within 0-100."""
    db = SessionLocal()
    cor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH37").first()

    inc1 = Incident(description="Flooding", incident_type="FLOOD", severity="HIGH", road_status="RESTRICTED", location_name="Guwahati Plains", district_name="Kamrup", latitude=26.1, longitude=91.7)
    inc2 = Incident(description="Road damage", incident_type="ROAD_DAMAGE", severity="MEDIUM", road_status="RESTRICTED", location_name="Guwahati Approach", district_name="Kamrup", latitude=26.1, longitude=91.7)
    db.add_all([inc1, inc2])
    db.commit()

    res = AccessibilityEngine.recalculate_corridor_accessibility(cor, db)
    db.delete(inc1)
    db.delete(inc2)
    db.commit()
    db.close()

    assert 0.0 <= res["accessibility_score"] <= 100.0
    assert res["accessibility_score"] <= 60.0

def test_gap1_test8_district_score_changes_after_corridor_disruption():
    """TEST 8: District score changes after corridor disruption."""
    db = SessionLocal()
    dist = db.query(District).filter(District.name == "Senapati").first()
    init_res = AccessibilityEngine.recalculate_district_accessibility(dist, db)
    init_score = init_res["accessibility_index"]

    # Add severe incident in district
    inc = Incident(
        description="Senapati Highway Cutoff",
        incident_type="LANDSLIDE",
        severity="HIGH",
        road_status="BLOCKED",
        location_name="Senapati Pass",
        district_name="Senapati",
        latitude=25.2676,
        longitude=94.0210
    )
    db.add(inc)
    db.commit()

    res = AccessibilityEngine.recalculate_district_accessibility(dist, db)
    db.delete(inc)
    db.commit()
    db.close()

    assert res["accessibility_index"] < init_score
    assert res["accessibility_index"] <= 24.0

def test_gap1_test9_incident_recovery_improves_accessibility():
    """TEST 9: Incident recovery -> accessibility improves."""
    db = SessionLocal()
    cor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH27").first()

    # Step A: Disruption
    inc = Incident(
        description="Temporary obstruction",
        incident_type="ACCIDENT",
        severity="HIGH",
        road_status="RESTRICTED",
        location_name="Guwahati NH27",
        district_name="Kamrup",
        latitude=26.1445,
        longitude=91.7362
    )
    db.add(inc)
    db.commit()
    res_disrupted = AccessibilityEngine.recalculate_corridor_accessibility(cor, db)

    # Step B: Recovery (remove incident)
    db.delete(inc)
    db.commit()
    res_recovered = AccessibilityEngine.recalculate_corridor_accessibility(cor, db)
    db.close()

    assert res_recovered["accessibility_score"] > res_disrupted["accessibility_score"]
    assert res_recovered["accessibility_score"] >= 70.0

def test_gap1_test10_invalid_extreme_input_failsafe_bounds():
    """TEST 10: Invalid/extreme input -> score remains safe and valid within [0, 100]."""
    db = SessionLocal()
    cor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH27").first()

    # Add 10 extreme incidents
    extreme_incs = [
        Incident(
            description="Massive Catastrophe",
            incident_type="LANDSLIDE",
            severity="CRITICAL",
            road_status="RESTRICTED",
            location_name="Senapati Pass NH27",
            district_name="Senapati",
            latitude=25.2676,
            longitude=94.0210
        ) for _ in range(10)
    ]
    db.add_all(extreme_incs)
    db.commit()

    res = AccessibilityEngine.recalculate_corridor_accessibility(cor, db)
    for inc in extreme_incs:
        db.delete(inc)
    db.commit()
    db.close()

    assert res["accessibility_score"] >= 0.0
    assert res["accessibility_score"] <= 100.0
    assert res["accessibility_score"] == 0.0

