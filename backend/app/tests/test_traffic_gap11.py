import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import SessionLocal
from app.models.models import TrafficRecord, Corridor
from app.schemas.schemas import TrafficUpdateIn
from app.services.traffic_service import TrafficService
from app.services.routing_service import RoutingService

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_traffic_test_db():
    db = SessionLocal()
    # Reset traffic records to default test baseline
    db.query(TrafficRecord).filter(TrafficRecord.corridor_code.in_(["COR-NH27", "COR-NH37", "COR-NH40"])).delete(synchronize_session=False)
    
    t1 = TrafficRecord(
        corridor_code="COR-NH27",
        segment_name="Guwahati - Nagaon Expressway",
        congestion_level="LOW",
        congestion_index=0.20,
        average_speed_kmh=55.0,
        free_flow_speed_kmh=65.0,
        traffic_delay_mins=10,
        travel_time_multiplier=1.15,
        data_source="SIMULATED_HIGHWAY_SENSORS",
        is_live=False
    )
    t2 = TrafficRecord(
        corridor_code="COR-NH27",
        segment_name="Dimapur - Kohima - Senapati Pass",
        congestion_level="MODERATE",
        congestion_index=0.45,
        average_speed_kmh=32.0,
        free_flow_speed_kmh=50.0,
        traffic_delay_mins=25,
        travel_time_multiplier=1.35,
        data_source="SIMULATED_HIGHWAY_SENSORS",
        is_live=False
    )
    t3 = TrafficRecord(
        corridor_code="COR-NH37",
        segment_name="Silchar - Jiribam Highway",
        congestion_level="LOW",
        congestion_index=0.15,
        average_speed_kmh=45.0,
        free_flow_speed_kmh=50.0,
        traffic_delay_mins=10,
        travel_time_multiplier=1.10,
        data_source="SIMULATED_HIGHWAY_SENSORS",
        is_live=False
    )
    db.add_all([t1, t2, t3])
    db.commit()
    db.close()
    yield
    db = SessionLocal()
    db.query(TrafficRecord).filter(TrafficRecord.corridor_code.in_(["COR-NH27", "COR-NH37", "COR-NH40"])).delete(synchronize_session=False)
    db.commit()
    db.close()

def test_traffic_provider_status_api():
    """TEST 1: Verify GET /api/v1/traffic/status reports SIMULATED_HIGHWAY_SENSORS."""
    res = client.get("/api/v1/traffic/status")
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "SIMULATED_HIGHWAY_SENSORS"
    assert "Regional ATMS" in data["provider_name"]

def test_get_all_corridors_traffic():
    """TEST 2: Verify GET /api/v1/traffic/corridors returns summaries for all corridors."""
    res = client.get("/api/v1/traffic/corridors")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    codes = [c["corridor_code"] for c in data]
    assert "COR-NH27" in codes

def test_get_specific_corridor_traffic():
    """TEST 3: Verify GET /api/v1/traffic/corridors/COR-NH27 returns detailed segment breakdown."""
    res = client.get("/api/v1/traffic/corridors/COR-NH27")
    assert res.status_code == 200
    data = res.json()
    assert data["corridor_code"] == "COR-NH27"
    assert data["overall_congestion_level"] in ["LOW", "MODERATE", "HIGH", "SEVERE"]
    assert data["total_traffic_delay_mins"] >= 30
    assert len(data["segments"]) >= 2

def test_update_traffic_segment():
    """TEST 4: Verify POST /api/v1/traffic/update correctly calculates travel time multiplier."""
    payload = {
        "corridor_code": "COR-NH27",
        "segment_name": "Guwahati - Nagaon Expressway",
        "congestion_level": "HIGH",
        "congestion_index": 0.60,
        "average_speed_kmh": 30.0,
        "free_flow_speed_kmh": 60.0,
        "traffic_delay_mins": 40
    }
    res = client.post("/api/v1/traffic/update", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["congestion_level"] == "HIGH"
    assert data["average_speed_kmh"] == 30.0
    assert data["travel_time_multiplier"] == 2.0 # 60 / 30

def test_traffic_affects_route_estimated_delay():
    """TEST 5: Verify traffic congestion directly increases route delay in route optimization."""
    db = SessionLocal()
    # Baseline traffic evaluation
    eval_res = TrafficService.evaluate_route_traffic("COR-NH27", db)
    assert eval_res["traffic_delay_mins"] >= 30
    assert eval_res["congestion_index"] > 0.0
    db.close()

def test_severe_traffic_congestion_influences_ranking():
    """TEST 6: Severe bottleneck on Route A increases estimated travel time and delays."""
    db = SessionLocal()
    # Apply severe traffic on NH27
    TrafficService.update_traffic(
        TrafficUpdateIn(
            corridor_code="COR-NH27",
            segment_name="Dimapur - Kohima - Senapati Pass",
            congestion_level="SEVERE",
            congestion_index=0.90,
            average_speed_kmh=15.0,
            free_flow_speed_kmh=50.0,
            traffic_delay_mins=75
        ),
        db
    )
    db.close()

    opt = RoutingService.optimize_routes("Guwahati", "Imphal", optimization_objective="FASTEST")
    cand_a = next(c for c in opt["candidate_routes"] if c["id"] == "ROUTE_A")
    assert cand_a["traffic_congestion_index"] >= 0.50
    assert cand_a["estimated_delay_mins"] >= 75
    assert any("Traffic" in t for t in cand_a["key_tradeoffs"])

def test_traffic_data_fallback_when_empty():
    """TEST 7: Missing or unknown corridor safely returns fallback traffic profile."""
    db = SessionLocal()
    res = TrafficService.get_corridor_traffic("COR-UNKNOWN-ROUTE", db)
    assert res.corridor_code == "COR-UNKNOWN-ROUTE"
    assert res.overall_congestion_level == "LOW"
    assert res.total_traffic_delay_mins >= 0
    assert res.is_live is False
    db.close()

def test_demo_congestion_endpoint():
    """TEST 8: Verify POST /api/v1/traffic/demo-congestion endpoint updates corridor bottleneck."""
    res = client.post("/api/v1/traffic/demo-congestion?corridor_code=COR-NH27")
    assert res.status_code == 200
    data = res.json()
    assert data["overall_congestion_level"] in ["HIGH", "SEVERE"]
    assert data["total_traffic_delay_mins"] >= 50

def test_traffic_speed_index_bounds():
    """TEST 9: Verify congestion index is constrained to [0.0, 1.0]."""
    db = SessionLocal()
    corridors = ["COR-NH27", "COR-NH37"]
    for c in corridors:
        traf = TrafficService.get_corridor_traffic(c, db)
        assert 0.0 <= traf.overall_congestion_index <= 1.0
        assert traf.average_speed_kmh > 0
    db.close()

def test_gis_traffic_summary_structure():
    """TEST 10: Verify traffic summary structure is compatible with GIS layer rendering."""
    res = client.get("/api/v1/traffic/corridors/COR-NH27")
    assert res.status_code == 200
    data = res.json()
    assert "corridor_name" in data
    assert "overall_congestion_level" in data
    assert "average_speed_kmh" in data
    assert "data_source" in data
