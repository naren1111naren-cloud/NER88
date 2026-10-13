import json
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.models import Corridor, Bridge, Incident, WeatherRecord
from app.services.accessibility_service import (
    AccessibilityEngine,
    classify_accessibility_status,
    register_source_provider
)
from app.database.seed import seed_database

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

def test_classify_accessibility_status():
    """Unit test for 3-tier status threshold classification."""
    assert classify_accessibility_status(100.0) == "OPEN"
    assert classify_accessibility_status(70.0) == "OPEN"
    assert classify_accessibility_status(69.9) == "RESTRICTED"
    assert classify_accessibility_status(35.0) == "RESTRICTED"
    assert classify_accessibility_status(1.0) == "RESTRICTED"
    assert classify_accessibility_status(0.0) == "BLOCKED"
    assert classify_accessibility_status(-5.0) == "BLOCKED"

def test_corridor_open_state(db):
    """Test an unobstructed corridor computes score >= 70 and status OPEN."""
    corridor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH15").first()
    assert corridor is not None, "COR-NH15 should exist in seed data"

    res = AccessibilityEngine.recalculate_corridor_accessibility(corridor, db)
    db.commit()
    db.refresh(corridor)

    assert res["accessibility_score"] >= 70.0
    assert res["accessibility_status"] == "OPEN"
    assert corridor.accessibility_status == "OPEN"
    assert corridor.accessibility_score >= 70.0
    assert "OPEN" in res["explanation"]
    assert isinstance(res["data_sources"], list)
    assert len(res["data_sources"]) >= 2
    assert corridor.last_updated is not None

def test_corridor_restricted_state(db):
    """Test corridor with severe rainfall / lane restriction transitions to RESTRICTED."""
    test_code = "COR-TEST-RESTRICTED"
    corridor = db.query(Corridor).filter(Corridor.corridor_code == test_code).first()
    if not corridor:
        corridor = Corridor(
            corridor_code=test_code,
            name="Test Restricted Corridor",
            origin="Shillong",
            destination="Cherrapunji",
            states_covered="Meghalaya",
            status="OPEN",
            accessibility_status="OPEN",
            accessibility_score=95.0,
            risk_level="LOW",
            current_condition="Normal passage",
            weather_condition="Clear",
            estimated_delay_mins=0,
            incident_count=0,
            reason="Clear",
            data_source="BRO",
            data_confidence="HIGH",
            last_updated=datetime.now(timezone.utc)
        )
        db.add(corridor)
        db.commit()
        db.refresh(corridor)

    # Add an active incident with RESTRICTED road status
    inc = Incident(
        incident_type="FLOOD",
        description="Single Lane Submergence along Cherrapunji mountain approach",
        latitude=25.2700,
        longitude=91.7300,
        location_name=f"{test_code} Mile 14",
        district_name="East Khasi Hills",
        severity="HIGH",
        road_status="RESTRICTED",
        reporter_name="Field Inspector",
        is_synced=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(inc)
    db.commit()

    res = AccessibilityEngine.recalculate_corridor_accessibility(corridor, db)
    db.commit()
    db.refresh(corridor)

    assert 1.0 <= res["accessibility_score"] < 70.0
    assert res["accessibility_status"] == "RESTRICTED"
    assert corridor.accessibility_status == "RESTRICTED"
    assert "RESTRICTED" in res["explanation"]
    assert "incident" in res["factor_summary"].lower() or "flood" in res["factor_summary"].lower() or "traffic" in res["factor_summary"].lower()

    # Cleanup
    db.delete(inc)
    db.delete(corridor)
    db.commit()

def test_corridor_blocked_state(db):
    """Test corridor with massive landslide blockage computes score = 0 and status BLOCKED."""
    test_code = "COR-TEST-BLOCKED"
    corridor = db.query(Corridor).filter(Corridor.corridor_code == test_code).first()
    if not corridor:
        corridor = Corridor(
            corridor_code=test_code,
            name="Test Blocked Corridor",
            origin="Kohima",
            destination="Imphal",
            states_covered="Manipur",
            status="OPEN",
            accessibility_status="OPEN",
            accessibility_score=90.0,
            risk_level="LOW",
            current_condition="Normal passage",
            weather_condition="Clear",
            estimated_delay_mins=0,
            incident_count=0,
            reason="Clear",
            data_source="BRO",
            data_confidence="HIGH",
            last_updated=datetime.now(timezone.utc)
        )
        db.add(corridor)
        db.commit()
        db.refresh(corridor)

    # Add active BLOCKED incident
    inc = Incident(
        incident_type="LANDSLIDE",
        description="Major Mountain Debris Road Collapse",
        latitude=25.6700,
        longitude=94.1000,
        location_name=f"{test_code} Pass",
        district_name="Kohima",
        severity="CRITICAL",
        road_status="BLOCKED",
        reporter_name="BRO Field Patrol",
        is_synced=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(inc)
    db.commit()

    res = AccessibilityEngine.recalculate_corridor_accessibility(corridor, db)
    db.commit()
    db.refresh(corridor)

    assert res["accessibility_score"] == 0.0
    assert res["accessibility_status"] == "BLOCKED"
    assert corridor.accessibility_status == "BLOCKED"
    assert "Accessibility 0/100 — BLOCKED" in res["explanation"]
    assert "road blockage" in res["factor_summary"].lower() or "landslide" in res["factor_summary"].lower()

    # Cleanup
    db.delete(inc)
    db.delete(corridor)
    db.commit()

def test_dynamic_recalculation_cascade(db):
    """Test dynamic transition from OPEN -> BLOCKED -> OPEN upon incident creation & resolution."""
    corridor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH29").first()
    assert corridor is not None, "COR-NH29 should exist"

    # Step 1: Ensure initial clean state
    db.query(Incident).filter(
        Incident.location_name.ilike("%NH-29%") | Incident.location_name.ilike("%COR-NH29%")
    ).delete(synchronize_session=False)
    db.commit()

    res_init = AccessibilityEngine.recalculate_corridor_accessibility(corridor, db)
    assert res_init["accessibility_status"] == "OPEN"

    # Step 2: Inject road blockage incident
    block_incident = Incident(
        incident_type="LANDSLIDE",
        description="Rockfall Blockage on COR-NH29",
        latitude=25.8000,
        longitude=93.8000,
        location_name="COR-NH29 Km 45",
        district_name="Dimapur",
        severity="CRITICAL",
        road_status="BLOCKED",
        reporter_name="Police Patrol",
        is_synced=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(block_incident)
    db.commit()

    # Recalculate
    res_blocked = AccessibilityEngine.recalculate_corridor_accessibility(corridor, db)
    assert res_blocked["accessibility_score"] == 0.0
    assert res_blocked["accessibility_status"] == "BLOCKED"
    assert corridor.accessibility_status == "BLOCKED"

    # Step 3: Clear the blockage incident
    db.delete(block_incident)
    db.commit()

    # Recalculate again
    res_cleared = AccessibilityEngine.recalculate_corridor_accessibility(corridor, db)
    assert res_cleared["accessibility_score"] >= 70.0
    assert res_cleared["accessibility_status"] == "OPEN"
    assert corridor.accessibility_status == "OPEN"

def test_api_accessibility_roads(client):
    """Test /api/v1/accessibility/roads returns all Phase 1 contract fields."""
    response = client.get("/api/v1/accessibility/roads")
    assert response.status_code == 200
    roads = response.json()
    assert isinstance(roads, list)
    assert len(roads) >= 1

    for road in roads:
        assert "accessibility_score" in road
        assert "accessibility_status" in road
        assert road["accessibility_status"] in ["OPEN", "RESTRICTED", "BLOCKED"]
        assert "risk_level" in road
        assert "factor_summary" in road
        assert "data_sources" in road
        assert isinstance(road["data_sources"], list)
        assert "explanation" in road
        assert "last_updated" in road

def test_api_corridor_by_id(client, db):
    """Test /api/v1/corridors/{id} endpoint returns accessibility fields."""
    corridor = db.query(Corridor).first()
    assert corridor is not None

    response = client.get(f"/api/v1/corridors/{corridor.id}")
    assert response.status_code == 200
    data = response.json()

    assert data["corridor_code"] == corridor.corridor_code
    assert "accessibility_status" in data
    assert "accessibility_score" in data
    assert "data_sources" in data
    assert "factor_summary" in data
    assert "explanation" in data

def test_api_asset_accessibility_detail(client, db):
    """Test /api/v1/accessibility/asset/corridor/{code} returns detailed model."""
    corridor = db.query(Corridor).first()
    assert corridor is not None

    response = client.get(f"/api/v1/accessibility/asset/corridor/{corridor.corridor_code}")
    assert response.status_code == 200
    data = response.json()

    assert data["asset_id"] == corridor.corridor_code
    assert data["asset_type"] == "corridor"
    assert "accessibility_score" in data
    assert "accessibility_status" in data
    assert "factor_summary" in data
    assert "explanation" in data
    assert "data_sources" in data
    assert isinstance(data["data_sources"], list)
    assert data["last_updated"] is not None

def test_pluggable_source_provider(db):
    """Test registering an external government transport API provider."""
    test_code = "COR-TEST-PROVIDER"
    existing = db.query(Corridor).filter(Corridor.corridor_code == test_code).first()
    if existing:
        db.delete(existing)
        db.commit()

    def mock_nhai_ram_provider(corridor, session):
        return {
            "source_name": "MoRTH Road Asset Management System (RAMS)",
            "penalty": 15.0,
            "delay_mins": 25,
            "reason": "RAMS scheduled pavement surface maintenance",
            "is_blocked": False
        }

    register_source_provider(mock_nhai_ram_provider)

    corridor = Corridor(
        corridor_code=test_code,
        name="Provider Integration Test Highway",
        origin="Guwahati",
        destination="Nagaon",
        states_covered="Assam",
        status="OPEN",
        accessibility_status="OPEN",
        accessibility_score=100.0,
        risk_level="LOW",
        current_condition="Good",
        weather_condition="Clear",
        estimated_delay_mins=0,
        incident_count=0,
        reason="Clear",
        data_source="Test",
        data_confidence="HIGH",
        last_updated=datetime.now(timezone.utc)
    )
    db.add(corridor)
    db.commit()
    db.refresh(corridor)

    res = AccessibilityEngine.recalculate_corridor_accessibility(corridor, db)

    assert "MoRTH Road Asset Management System (RAMS)" in res["data_sources"]
    assert "RAMS scheduled pavement surface maintenance" in res["reason"]

    # Cleanup
    db.delete(corridor)
    db.commit()
    if mock_nhai_ram_provider in AccessibilityEngine._SOURCE_PROVIDERS:
        AccessibilityEngine._SOURCE_PROVIDERS.remove(mock_nhai_ram_provider)
