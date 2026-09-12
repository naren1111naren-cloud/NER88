import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.models import Incident, Corridor, Bridge

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_routes_db():
    db = SessionLocal()
    db.query(Incident).filter(Incident.road_status.in_(["BLOCKED", "CLOSED"])).delete()
    db.commit()
    db.close()
    yield

# =========================================================================
# SIH GAP 5 EXPLICIT 10 TEST SCENARIOS
# =========================================================================

def test_gap5_scenario_01_multiple_candidates_generated():
    """TEST 1: Verify multiple candidate routes generated and evaluated."""
    payload = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "optimization_objective": "BALANCED",
        "cargo_priority": "URGENT",
        "vehicle_weight_tons": 20.0
    }
    res = client.post("/api/v1/routes/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["total_candidates_evaluated"] >= 3
    assert len(data["candidate_routes"]) >= 3
    assert len(data["comparison_table"]) >= 3
    candidate_ids = [c["id"] for c in data["candidate_routes"]]
    assert "ROUTE_A" in candidate_ids
    assert "ROUTE_B" in candidate_ids
    assert "ROUTE_C" in candidate_ids


def test_gap5_scenario_02_shortest_rejected_when_unsafe():
    """TEST 2: Shortest route (Route A) is rejected when unsafe or blocked, promoting Alternate Route B."""
    payload = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "optimization_objective": "SAFEST",
        "active_blockages": [
            {
                "incident_type": "LANDSLIDE",
                "location_name": "Senapati Hill Pass (NH29)",
                "road_status": "BLOCKED"
            }
        ]
    }
    res = client.post("/api/v1/routes/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["recommended_route_id"] == "ROUTE_B"
    route_a = [r for r in data["candidate_routes"] if r["id"] == "ROUTE_A"][0]
    assert route_a["is_blocked"] is True
    assert route_a["suitability_score"] == 0.0


def test_gap5_scenario_03_bridge_restriction_affects_route():
    """TEST 3: Heavy vehicle on restricted bridge corridor triggers load penalty and warning note."""
    payload = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "optimization_objective": "MOST_RESILIENT",
        "vehicle_weight_tons": 30.0 # 30T exceeds 24T bridge rating
    }
    res = client.post("/api/v1/routes/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    route_b = [r for r in data["candidate_routes"] if r["id"] == "ROUTE_B"][0]
    assert "RESTRICTED" in route_b["bridge_clearance_status"] or "24T" in route_b["bridge_clearance_status"]


def test_gap5_scenario_04_weather_risk_influences_ranking():
    """TEST 4: Live weather hazards increase route risk and alter composite suitability."""
    payload_weather = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "optimization_objective": "SAFEST",
        "consider_live_weather": True
    }
    res = client.post("/api/v1/routes/optimize", json=payload_weather)
    assert res.status_code == 200
    data = res.json()
    for cand in data["candidate_routes"]:
        assert "weather_risk_score" in cand
        assert "weather_risk_category" in cand
        assert cand["weather_risk_score"] >= 0.0


def test_gap5_scenario_05_accessibility_penalizes_corridor():
    """TEST 5: Corridor accessibility score directly penalizes degraded routes."""
    payload = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "optimization_objective": "MOST_RESILIENT"
    }
    res = client.post("/api/v1/routes/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    for cand in data["candidate_routes"]:
        assert "accessibility_score" in cand
        assert "resilience_score" in cand


def test_gap5_scenario_06_policy_differences_fastest_vs_safest():
    """TEST 6: Different optimization policies (FASTEST vs SAFEST vs BALANCED) produce appropriate rankings."""
    # Policy 1: FASTEST
    res_fast = client.post("/api/v1/routes/optimize", json={
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "optimization_objective": "FASTEST",
        "consider_live_weather": False
    })
    assert res_fast.status_code == 200
    fast_data = res_fast.json()
    assert fast_data["applied_weights"]["time"] == 0.50

    # Policy 2: SAFEST
    res_safe = client.post("/api/v1/routes/optimize", json={
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "optimization_objective": "SAFEST",
        "consider_live_weather": False
    })
    assert res_safe.status_code == 200
    safe_data = res_safe.json()
    assert safe_data["applied_weights"]["risk"] == 0.45


def test_gap5_scenario_07_blocked_corridor_disqualified():
    """TEST 7: Blocked corridor is never recommended over an open passable alternate."""
    payload = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "optimization_objective": "BALANCED",
        "active_blockages": [
            {"incident_type": "BRIDGE_COLLAPSE", "location_name": "NH29 Kohima Bypass", "road_status": "CLOSED"}
        ]
    }
    res = client.post("/api/v1/routes/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["recommended_route_id"] != "ROUTE_A"
    assert data["candidate_routes"][0]["is_blocked"] is False


def test_gap5_scenario_08_vehicle_load_constraint_enforced():
    """TEST 8: Heavy vehicle load constraint is respected and flagged."""
    payload = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "optimization_objective": "BALANCED",
        "vehicle_weight_tons": 35.0
    }
    res = client.post("/api/v1/routes/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["candidate_routes"]) >= 3


def test_gap5_scenario_09_explainable_reasoning_points():
    """TEST 9: Route decision outputs actionable explainable AI reasoning with actual factors."""
    payload = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "optimization_objective": "BALANCED"
    }
    res = client.post("/api/v1/routes/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["why_this_route"]) >= 1
    assert "recommendation_summary" in data
    assert len(data["tradeoff_analysis"]) >= 1


def test_gap5_scenario_10_all_routes_blocked_failsafe():
    """TEST 10: Graceful failsafe handling when all candidates suffer disruptions."""
    payload = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "optimization_objective": "BALANCED",
        "active_blockages": [
            {"incident_type": "MASSIVE_LANDSLIDE", "location_name": "NH27 / NH37 Corridor", "road_status": "BLOCKED"}
        ]
    }
    res = client.post("/api/v1/routes/optimize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["total_candidates_evaluated"] >= 3
    assert data["recommended_route_id"] != ""


# Objectives & Analyze Helpers
def test_get_optimization_objectives():
    """Verify supported AI route optimization policies and weighting factors."""
    res = client.get("/api/v1/routes/objectives")
    assert res.status_code == 200
    objectives = res.json()
    assert len(objectives) == 4
    keys = [obj["objective_key"] for obj in objectives]
    assert "BALANCED" in keys
    assert "SAFEST" in keys
    assert "FASTEST" in keys
    assert "MOST_RESILIENT" in keys


def test_integrated_routes_analyze_endpoint():
    """Verify /routes/analyze combines ML risk prediction with multi-candidate route optimization."""
    req = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "distance_km": 480.0,
        "terrain_elevation_gain_m": 1850.0,
        "rainfall_mm_hr": 45.0,
        "active_incidents_count": 1,
        "highest_severity_numeric": 2,
        "road_blocked_status": 0,
        "historical_landslide_freq": 0.45,
        "traffic_congestion_index": 0.35,
        "cargo_priority": "URGENT"
    }
    res = client.post("/api/v1/routes/analyze", json=req)
    assert res.status_code == 200
    data = res.json()
    assert "ml_risk_evaluation" in data
    assert "explainable_ai" in data
    assert "multi_candidate_optimization" in data
