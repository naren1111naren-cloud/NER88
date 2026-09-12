import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import SessionLocal
from app.models.models import Delivery, Vehicle, Alert, TrafficRecord, Incident
from app.services.eta_service import ETAService

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_eta_test_db():
    db = SessionLocal()
    db.query(Alert).filter(Alert.alert_type == "DELIVERY_DELAY_WARNING").delete(synchronize_session=False)
    db.query(Delivery).filter(Delivery.delivery_code.like("TEST-ETA-%")).delete(synchronize_session=False)
    
    # Seed a test vehicle and delivery
    v = db.query(Vehicle).first()
    v_id = v.id if v else 1

    d = Delivery(
        delivery_code="TEST-ETA-001",
        cargo_name="Emergency Vaccines",
        cargo_category="Medicines",
        priority="EMERGENCY",
        origin_city="Guwahati",
        destination_city="Imphal",
        assigned_vehicle_id=v_id,
        driver_name="Ramesh Sharma",
        status="IN_TRANSIT",
        original_eta=datetime.utcnow() + timedelta(hours=10.0),
        revised_eta=datetime.utcnow() + timedelta(hours=10.0),
        estimated_delay_mins=0,
        delay_reason="None"
    )
    db.add(d)
    db.commit()
    db.close()
    yield
    db = SessionLocal()
    db.query(Alert).filter(Alert.alert_type == "DELIVERY_DELAY_WARNING").delete(synchronize_session=False)
    db.query(Delivery).filter(Delivery.delivery_code.like("TEST-ETA-%")).delete(synchronize_session=False)
    db.commit()
    db.close()

def test_base_eta_calculation():
    """TEST 1: Verify base travel time and base ETA calculation."""
    db = SessionLocal()
    now = datetime.utcnow()
    eta = ETAService.calculate_eta_breakdown("Guwahati", "Imphal", departure_time=now, db=db)
    assert eta.base_travel_time_hours > 0.0
    assert eta.base_eta > now
    diff_hours = (eta.base_eta - now).total_seconds() / 3600.0
    assert abs(diff_hours - eta.base_travel_time_hours) < 0.1
    db.close()

def test_predicted_eta_with_traffic_delay():
    """TEST 2: Verify predicted ETA adds traffic and operational delays to base ETA."""
    db = SessionLocal()
    eta = ETAService.calculate_eta_breakdown("Guwahati", "Imphal", db=db)
    assert eta.predicted_travel_time_hours >= eta.base_travel_time_hours
    assert eta.predicted_eta >= eta.base_eta
    assert eta.total_estimated_delay_mins >= 0
    db.close()

def test_delay_decomposition_contributors():
    """TEST 3: Verify delay factors are decomposed into traffic, weather, incident, bridge."""
    db = SessionLocal()
    eta = ETAService.calculate_eta_breakdown("Guwahati", "Imphal", db=db)
    assert hasattr(eta, "traffic_delay_mins")
    assert hasattr(eta, "weather_delay_mins")
    assert hasattr(eta, "incident_delay_mins")
    assert hasattr(eta, "bridge_delay_mins")
    assert eta.total_estimated_delay_mins == (
        eta.traffic_delay_mins + eta.weather_delay_mins + eta.incident_delay_mins + eta.bridge_delay_mins
    )
    db.close()

def test_primary_delay_reason_identification():
    """TEST 4: Verify primary delay reason is identified accurately."""
    db = SessionLocal()
    eta = ETAService.calculate_eta_breakdown("Guwahati", "Imphal", db=db)
    assert eta.primary_delay_reason in ["TRAFFIC", "WEATHER", "INCIDENT", "BRIDGE", "NORMAL"]
    assert len(eta.delay_contributors) >= 1
    db.close()

def test_eta_calculation_endpoint_post():
    """TEST 5: Verify POST /api/v1/deliveries/eta/calculate returns complete breakdown."""
    payload = {
        "origin": "Guwahati",
        "destination": "Imphal",
        "corridor_code": "COR-NH27",
        "vehicle_weight_tons": 20.0
    }
    res = client.post("/api/v1/deliveries/eta/calculate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["origin"] == "Guwahati"
    assert data["destination"] == "Imphal"
    assert "predicted_travel_time_hours" in data
    assert "total_estimated_delay_mins" in data

def test_eta_breakdown_endpoint_get():
    """TEST 6: Verify GET /api/v1/deliveries/eta/breakdown."""
    res = client.get("/api/v1/deliveries/eta/breakdown?origin=Guwahati&destination=Silchar")
    assert res.status_code == 200
    data = res.json()
    assert data["origin"] == "Guwahati"
    assert data["destination"] == "Silchar"
    assert data["base_travel_time_hours"] > 0

def test_delivery_live_eta_update_from_vehicle_gps():
    """TEST 7: Verify advancing GPS position updates remaining distance and revised ETA."""
    db = SessionLocal()
    d = db.query(Delivery).filter(Delivery.delivery_code == "TEST-ETA-001").first()
    assert d is not None

    # Vehicle at Dimapur (halfway along route)
    update_res = client.post(
        f"/api/v1/deliveries/{d.id}/update-live-eta?current_lat=25.9060&current_lng=93.7273"
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["delivery_code"] == "TEST-ETA-001"
    assert data["remaining_distance_km"] > 0
    assert data["revised_eta"] is not None
    db.close()

def test_delay_alert_generation_when_threshold_exceeded():
    """TEST 8: Verify delay alert is dispatched when delay threshold (>= 45m) is exceeded."""
    db = SessionLocal()
    # Add a high-severity incident to generate substantial delay
    inc = Incident(
        incident_type="LANDSLIDE",
        description="Major roadblock in mountain sector",
        latitude=25.6751,
        longitude=94.1086,
        location_name="Kohima Pass",
        severity="CRITICAL",
        road_status="BLOCKED",
        reporter_name="Field Inspector"
    )
    db.add(inc)
    db.commit()

    d = db.query(Delivery).filter(Delivery.delivery_code == "TEST-ETA-001").first()
    ETAService.update_delivery_live_eta(d, 26.1445, 91.7362, db)

    # Verify Alert was logged
    alert = db.query(Alert).filter(
        (Alert.delivery_id == d.id) &
        (Alert.alert_type == "DELIVERY_DELAY_WARNING")
    ).first()
    assert alert is not None
    assert "DELAY ALERT" in alert.title

    db.delete(inc)
    db.commit()
    db.close()

def test_no_negative_delay_guarantee():
    """TEST 9: Ensure estimated delay is strictly non-negative."""
    db = SessionLocal()
    eta = ETAService.calculate_eta_breakdown("Guwahati", "Shillong", db=db)
    assert eta.total_estimated_delay_mins >= 0
    assert eta.traffic_delay_mins >= 0
    assert eta.weather_delay_mins >= 0
    db.close()

def test_missing_data_safety_fallback():
    """TEST 10: Missing DB session or uninitialized records safely fall back."""
    eta = ETAService.calculate_eta_breakdown("Guwahati", "Imphal", db=None)
    assert eta.base_travel_time_hours > 0
    assert eta.predicted_travel_time_hours >= eta.base_travel_time_hours
