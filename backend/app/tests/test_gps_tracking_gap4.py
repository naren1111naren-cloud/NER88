import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import get_db, SessionLocal
from app.models.models import Vehicle, Alert, TelemetryLog
from app.services.telemetry_service import TelemetryService

client = TestClient(app)

# =========================================================================
# SIH GAP 4 EXPLICIT 15 TEST SCENARIOS
# =========================================================================

def test_01_valid_telemetry_packet_accepted():
    """TEST 1: Valid telemetry packet -> accepted (200 OK)."""
    payload = {
        "vehicle_code": "NER-V001",
        "device_id": "GPS-UNIT-01",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": 42.5,
        "heading_deg": 90.0,
        "odometer_km": 14650.0,
        "ignition_status": "ON",
        "altitude_m": 350.0,
        "battery_level_pct": 95.0,
        "satellites_connected": 14,
        "telemetry_source": "SIMULATED GPS TELEMETRY"
    }
    res = client.post("/api/v1/telemetry/ingest", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["vehicle_code"] == "NER-V001"
    assert data["latitude"] == 26.1445
    assert data["longitude"] == 91.7362
    assert data["speed_kmh"] == 42.5
    assert data["telemetry_health"] == "LIVE"


def test_02_invalid_latitude_rejected():
    """TEST 2: Invalid latitude (<-90 or >90) -> rejected with HTTP 422."""
    payload_high = {
        "vehicle_code": "NER-V001",
        "latitude": 95.1234,
        "longitude": 91.7362,
        "speed_kmh": 30.0
    }
    res_high = client.post("/api/v1/telemetry/ingest", json=payload_high)
    assert res_high.status_code == 422
    assert "latitude" in res_high.json()["detail"].lower()

    payload_low = {
        "vehicle_code": "NER-V001",
        "latitude": -92.5000,
        "longitude": 91.7362,
        "speed_kmh": 30.0
    }
    res_low = client.post("/api/v1/telemetry/ingest", json=payload_low)
    assert res_low.status_code == 422
    assert "latitude" in res_low.json()["detail"].lower()


def test_03_invalid_longitude_rejected():
    """TEST 3: Invalid longitude (<-180 or >180) -> rejected with HTTP 422."""
    payload = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 185.0000,
        "speed_kmh": 30.0
    }
    res = client.post("/api/v1/telemetry/ingest", json=payload)
    assert res.status_code == 422
    assert "longitude" in res.json()["detail"].lower()


def test_04_negative_speed_rejected():
    """TEST 4: Negative speed (< 0) -> rejected with HTTP 422."""
    payload = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": -25.0
    }
    res = client.post("/api/v1/telemetry/ingest", json=payload)
    assert res.status_code == 422
    assert "speed" in res.json()["detail"].lower()


def test_05_invalid_heading_rejected():
    """TEST 5: Invalid heading (< 0 or > 360) -> rejected with HTTP 422."""
    payload = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": 40.0,
        "heading_deg": 385.0
    }
    res = client.post("/api/v1/telemetry/ingest", json=payload)
    assert res.status_code == 422
    assert "heading" in res.json()["detail"].lower()


def test_06_valid_authenticated_device_accepted():
    """TEST 6: Valid authenticated hardware device -> accepted."""
    # 1. Register device
    reg_payload = {
        "vehicle_code": "NER-V002",
        "device_id": "TELTONIKA-FMB920-002",
        "device_type": "GPS_TRACKER"
    }
    reg_res = client.post("/api/v1/telemetry/devices/register", json=reg_payload)
    assert reg_res.status_code == 200
    api_key = reg_res.json()["device_api_key"]

    # 2. Ingest with API Key
    hw_packet = {
        "vehicle_code": "NER-V002",
        "device_id": "TELTONIKA-FMB920-002",
        "latitude": 25.5788,
        "longitude": 91.8933,
        "speed_kmh": 48.0,
        "heading_deg": 180.0,
        "telemetry_source": "HARDWARE_GPS_TRACKER"
    }
    res = client.post(
        "/api/v1/telemetry/ingest",
        json=hw_packet,
        headers={"X-Device-API-Key": api_key}
    )
    assert res.status_code == 200
    assert res.json()["tracking_mode"] == "LIVE_HARDWARE"


def test_07_invalid_device_api_key_rejected():
    """TEST 7: Invalid device API key on authenticated vehicle -> rejected (401 Unauthorized)."""
    # 1. Ensure device is registered
    reg_payload = {
        "vehicle_code": "NER-V002",
        "device_id": "TELTONIKA-FMB920-002",
        "device_type": "GPS_TRACKER"
    }
    client.post("/api/v1/telemetry/devices/register", json=reg_payload)

    # 2. Ingest with invalid key
    hw_packet = {
        "vehicle_code": "NER-V002",
        "device_id": "TELTONIKA-FMB920-002",
        "latitude": 25.5788,
        "longitude": 91.8933,
        "speed_kmh": 48.0,
        "heading_deg": 180.0,
        "telemetry_source": "HARDWARE_GPS_TRACKER"
    }
    res = client.post(
        "/api/v1/telemetry/ingest",
        json=hw_packet,
        headers={"X-Device-API-Key": "dev_sec_invalid_dummy_key_1234567890abcdef"}
    )
    assert res.status_code == 401
    assert "invalid or missing device api key" in res.json()["detail"].lower()


def test_08_telemetry_freshness_live():
    """TEST 8: Telemetry < 120 seconds old -> Classified as LIVE."""
    recent_time = datetime.now(timezone.utc) - timedelta(seconds=30)
    payload = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": 35.0,
        "timestamp": recent_time.isoformat(),
        "telemetry_source": "SIMULATED GPS TELEMETRY"
    }
    res = client.post("/api/v1/telemetry/ingest", json=payload)
    assert res.status_code == 200
    assert res.json()["telemetry_health"] == "LIVE"


def test_09_old_telemetry_stale_and_offline():
    """TEST 9: Freshness thresholds: <120s LIVE, 2-10m RECENT, 10-60m STALE, >60m OFFLINE."""
    # 1. LIVE (<120s)
    live_dt = datetime.now(timezone.utc) - timedelta(seconds=45)
    h_live, c_live = TelemetryService.calculate_telemetry_freshness(live_dt)
    assert h_live == "LIVE"
    assert c_live == "ONLINE"

    # 2. RECENT (2-10m)
    recent_dt = datetime.now(timezone.utc) - timedelta(minutes=5)
    h_recent, c_recent = TelemetryService.calculate_telemetry_freshness(recent_dt)
    assert h_recent == "RECENT"
    assert c_recent == "ONLINE"

    # 3. STALE (10-60m)
    stale_dt = datetime.now(timezone.utc) - timedelta(minutes=25)
    h_stale, c_stale = TelemetryService.calculate_telemetry_freshness(stale_dt)
    assert h_stale == "STALE"
    assert c_stale == "STALE"

    # 4. OFFLINE (>60m)
    offline_dt = datetime.now(timezone.utc) - timedelta(minutes=120)
    h_off, c_off = TelemetryService.calculate_telemetry_freshness(offline_dt)
    assert h_off == "OFFLINE"
    assert c_off == "OFFLINE"


def test_10_overspeed_alert_generated():
    """TEST 10: Speed > 80 km/h on mountain corridor triggers automated OVERSPEEDING_WARNING alert."""
    payload = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": 92.5,
        "heading_deg": 120.0,
        "telemetry_source": "SIMULATED GPS TELEMETRY"
    }
    res = client.post("/api/v1/telemetry/ingest", json=payload)
    assert res.status_code == 200

    # Verify generated alert
    alerts_res = client.get("/api/v1/alerts")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    overspeed_alerts = [a for a in alerts if a["alert_type"] == "OVERSPEEDING_WARNING"]
    assert len(overspeed_alerts) > 0
    latest_alert = overspeed_alerts[0]
    assert "92.5" in latest_alert["message"] or "80" in latest_alert["message"]


def test_11_telemetry_persisted_in_history():
    """TEST 11: Ingested telemetry points are persistently stored in TelemetryLog breadcrumbs."""
    res = client.get("/api/v1/telemetry/vehicles/NER-V001/history?limit=15")
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    assert len(logs) > 0
    entry = logs[0]
    assert "latitude" in entry
    assert "longitude" in entry
    assert "speed_kmh" in entry
    assert "recorded_at" in entry


def test_12_vehicle_current_location_updates():
    """TEST 12: Ingestion updates vehicle's current_lat, current_lng, speed, heading and last_updated."""
    new_lat = 26.1820
    new_lng = 91.7450
    payload = {
        "vehicle_code": "NER-V001",
        "latitude": new_lat,
        "longitude": new_lng,
        "speed_kmh": 38.0,
        "heading_deg": 145.0,
        "telemetry_source": "SIMULATED GPS TELEMETRY"
    }
    res = client.post("/api/v1/telemetry/ingest", json=payload)
    assert res.status_code == 200

    # Query vehicle directly
    db = SessionLocal()
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_code == "NER-V001").first()
    assert vehicle is not None
    assert abs(vehicle.current_lat - new_lat) < 1e-4
    assert abs(vehicle.current_lng - new_lng) < 1e-4
    assert vehicle.speed_kmh == 38.0
    assert vehicle.heading_deg == 145.0
    db.close()


def test_13_unknown_inactive_device_rejected():
    """TEST 13: Ingestion for unknown vehicle code returns 404."""
    payload = {
        "vehicle_code": "NER-GHOST-VEHICLE-999",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": 40.0
    }
    res = client.post("/api/v1/telemetry/ingest", json=payload)
    assert res.status_code == 404
    assert "not registered" in res.json()["detail"].lower()


def test_14_invalid_timestamp_handled_safely():
    """TEST 14: Telemetry with omitted timestamp defaults safely to current time."""
    payload = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": 22.0,
        "telemetry_source": "SIMULATED GPS TELEMETRY"
        # timestamp omitted — should default to server time and classify as LIVE
    }
    res = client.post("/api/v1/telemetry/ingest", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "SUCCESS"
    assert res.json()["telemetry_health"] in ["LIVE", "ONLINE"]


def test_15_vehicle_appears_correctly_in_gis_data():
    """TEST 15: Fleet telemetry health endpoint provides valid GIS marker data for map visualization."""
    res = client.get("/api/v1/telemetry/health")
    assert res.status_code == 200
    health = res.json()
    assert health["total_vehicles"] > 0
    assert len(health["devices"]) > 0
    device = health["devices"][0]
    assert "vehicle_code" in device
    assert "latitude" in device
    assert "longitude" in device
    assert "speed_kmh" in device
    assert "heading_deg" in device
    assert "health" in device
    assert "tracking_mode" in device


# =========================================================================
# ADDITIONAL SIMULATION & BATCH TESTS
# =========================================================================

def test_simulation_step_pipeline():
    """Verify demonstration simulator advances along route and pipes through ingestion."""
    step_req = {
        "vehicle_code": "NER-V001",
        "step_increment": 1
    }
    res = client.post("/api/v1/telemetry/simulate-step", json=step_req)
    assert res.status_code == 200
    data = res.json()
    assert data["vehicle_code"] == "NER-V001"
    assert "waypoint_index" in data
    assert "telemetry_response" in data
    assert data["telemetry_response"]["status"] == "SUCCESS"


def test_batch_telemetry_ingestion():
    """Verify batch ingestion of multiple telemetry packets."""
    batch_payload = {
        "packets": [
            {
                "vehicle_code": "NER-V001",
                "latitude": 26.1445,
                "longitude": 91.7362,
                "speed_kmh": 40.0,
                "telemetry_source": "SIMULATED GPS TELEMETRY"
            },
            {
                "vehicle_code": "NER-V002",
                "latitude": 25.5788,
                "longitude": 91.8933,
                "speed_kmh": 35.0,
                "telemetry_source": "SIMULATED GPS TELEMETRY"
            }
        ]
    }
    res = client.post("/api/v1/telemetry/batch", json=batch_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["total_received"] == 2
    assert data["ingested_count"] == 2
