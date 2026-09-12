"""
SIH GAP 16 — Physical GPS/OBD Device Integration
Comprehensive Test Suite

Tests verify:
- Device contract endpoint
- Hardware readiness assessment
- Dry-run packet verification (valid and invalid)
- NER geographic scope warnings
- Hardware source detection
- Stale/offline freshness prediction
- Overspeed warning prediction
- Physical test procedure endpoint
- All existing telemetry tests still pass (regression)
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


# ─────────────────────────────────────────────────────────────
# GAP 16.1: DEVICE CONTRACT ENDPOINT
# ─────────────────────────────────────────────────────────────

def test_g16_01_device_contract_accessible():
    """GAP16-01: Device contract endpoint returns full physical device payload spec."""
    res = client.get("/api/v1/hardware/device-contract")
    assert res.status_code == 200
    data = res.json()
    assert "payload_schema" in data
    assert "latitude" in data["payload_schema"]
    assert "longitude" in data["payload_schema"]
    assert "speed_kmh" in data["payload_schema"]
    assert "heading_deg" in data["payload_schema"]
    assert "telemetry_source" in data["payload_schema"]


def test_g16_02_device_contract_contains_auth():
    """GAP16-02: Device contract documents authentication mechanism."""
    res = client.get("/api/v1/hardware/device-contract")
    assert res.status_code == 200
    data = res.json()
    assert "authentication" in data
    assert "mechanism" in data["authentication"]
    assert "X-Device-API-Key" in data["authentication"]["mechanism"]
    assert "key_generation" in data["authentication"]


def test_g16_03_device_contract_contains_sample_curl():
    """GAP16-03: Device contract contains a sample cURL command for hardware config."""
    res = client.get("/api/v1/hardware/device-contract")
    assert res.status_code == 200
    data = res.json()
    assert "sample_curl" in data
    assert "telemetry/ingest" in data["sample_curl"]
    assert "X-Device-API-Key" in data["sample_curl"]


def test_g16_04_device_contract_lists_supported_device_classes():
    """GAP16-04: Contract lists supported hardware device classes."""
    res = client.get("/api/v1/hardware/device-contract")
    assert res.status_code == 200
    data = res.json()
    assert "supported_device_classes" in data
    assert len(data["supported_device_classes"]) > 0
    classes = [d["class"] for d in data["supported_device_classes"]]
    assert any("GPS" in c or "OBD" in c for c in classes)


# ─────────────────────────────────────────────────────────────
# GAP 16.2: HARDWARE READINESS ASSESSMENT
# ─────────────────────────────────────────────────────────────

def test_g16_05_hardware_readiness_endpoint():
    """GAP16-05: Hardware readiness returns full checklist."""
    res = client.get("/api/v1/hardware/readiness")
    assert res.status_code == 200
    data = res.json()
    assert "checklist" in data
    assert "overall_status" in data


def test_g16_06_readiness_ingest_endpoint_ready():
    """GAP16-06: Readiness confirms /telemetry/ingest is READY."""
    res = client.get("/api/v1/hardware/readiness")
    assert res.status_code == 200
    data = res.json()
    assert data["checklist"]["ingest_endpoint"]["status"] == "READY"


def test_g16_07_readiness_device_auth_ready():
    """GAP16-07: Readiness confirms device authentication is READY."""
    res = client.get("/api/v1/hardware/readiness")
    assert res.status_code == 200
    data = res.json()
    assert data["checklist"]["device_auth"]["status"] == "READY"


def test_g16_08_readiness_physical_hardware_not_demonstrated():
    """GAP16-08: Readiness honestly reports physical hardware as NOT_DEMONSTRATED."""
    res = client.get("/api/v1/hardware/readiness")
    assert res.status_code == 200
    data = res.json()
    hw_status = data["checklist"]["physical_hardware_tested"]["status"]
    assert hw_status == "NOT_DEMONSTRATED"


def test_g16_09_readiness_architecture_diagram_present():
    """GAP16-09: Readiness includes architecture flow diagram."""
    res = client.get("/api/v1/hardware/readiness")
    assert res.status_code == 200
    data = res.json()
    assert "architecture_diagram" in data
    assert "telemetry/ingest" in data["architecture_diagram"]


# ─────────────────────────────────────────────────────────────
# GAP 16.3: DRY-RUN PACKET VERIFICATION
# ─────────────────────────────────────────────────────────────

def test_g16_10_verify_valid_hardware_packet():
    """GAP16-10: Valid hardware packet passes dry-run validation."""
    packet = {
        "vehicle_code": "NER-V001",
        "device_id": "TELTONIKA-FMB920-001",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": 42.5,
        "heading_deg": 90.0,
        "altitude_m": 350.0,
        "odometer_km": 14650.0,
        "ignition_status": "ON",
        "battery_level_pct": 92.0,
        "satellites_connected": 14,
        "telemetry_source": "HARDWARE_GPS_DEVICE"
    }
    res = client.post("/api/v1/hardware/verify-packet", json=packet,
                      headers={"X-Device-API-Key": "dev_sec_test_key_12345678"})
    assert res.status_code == 200
    data = res.json()
    assert data["dry_run"] is True
    assert data["valid"] is True
    assert len(data["errors"]) == 0
    assert data["predicted_tracking_mode"] == "LIVE_HARDWARE"


def test_g16_11_verify_invalid_latitude():
    """GAP16-11: Invalid latitude caught in dry-run verification."""
    packet = {
        "vehicle_code": "NER-V001",
        "latitude": 95.0,  # Invalid
        "longitude": 91.7362,
        "speed_kmh": 42.5
    }
    res = client.post("/api/v1/hardware/verify-packet", json=packet)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert any("latitude" in e.lower() for e in data["errors"])


def test_g16_12_verify_invalid_longitude():
    """GAP16-12: Invalid longitude caught in dry-run verification."""
    packet = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 200.0,  # Invalid
        "speed_kmh": 42.5
    }
    res = client.post("/api/v1/hardware/verify-packet", json=packet)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert any("longitude" in e.lower() for e in data["errors"])


def test_g16_13_verify_negative_speed():
    """GAP16-13: Negative speed caught in dry-run verification."""
    packet = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": -10.0  # Invalid
    }
    res = client.post("/api/v1/hardware/verify-packet", json=packet)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert any("speed" in e.lower() for e in data["errors"])


def test_g16_14_verify_overspeed_warning_predicted():
    """GAP16-14: Overspeed (>80 km/h) triggers overspeed prediction in dry-run."""
    packet = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": 95.0  # Overspeed
    }
    res = client.post("/api/v1/hardware/verify-packet", json=packet)
    assert res.status_code == 200
    data = res.json()
    assert data["overspeed_would_trigger"] is True
    assert data["overspeed_threshold_kmh"] == 80.0


def test_g16_15_verify_outside_ner_warning():
    """GAP16-15: Coordinates outside NER bounding box produce a warning."""
    packet = {
        "vehicle_code": "NER-V001",
        "latitude": 19.0,   # Mumbai — outside NER
        "longitude": 72.8,
        "speed_kmh": 40.0
    }
    res = client.post("/api/v1/hardware/verify-packet", json=packet)
    assert res.status_code == 200
    data = res.json()
    # Should still be geometrically valid (lat/lng in range)
    # but should have a NER geographic warning
    warnings = data.get("warnings", [])
    assert any("north eastern region" in w.lower() or "ner" in w.lower() for w in warnings)


def test_g16_16_verify_missing_auth_header_warning():
    """GAP16-16: Hardware source without API key generates a warning."""
    packet = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": 42.5,
        "telemetry_source": "HARDWARE_GPS_DEVICE"
    }
    # No X-Device-API-Key header
    res = client.post("/api/v1/hardware/verify-packet", json=packet)
    assert res.status_code == 200
    data = res.json()
    warnings = data.get("warnings", [])
    assert any("x-device-api-key" in w.lower() or "api key" in w.lower() for w in warnings)


def test_g16_17_verify_stale_packet_warning():
    """GAP16-17: Old packet timestamp generates freshness warning."""
    old_time = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    packet = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": 42.5,
        "timestamp": old_time
    }
    res = client.post("/api/v1/hardware/verify-packet", json=packet)
    assert res.status_code == 200
    data = res.json()
    assert data["predicted_freshness"] == "OFFLINE"
    warnings = data.get("warnings", [])
    assert any("offline" in w.lower() or "minutes old" in w.lower() for w in warnings)


# ─────────────────────────────────────────────────────────────
# GAP 16.4: TEST PROCEDURE ENDPOINT
# ─────────────────────────────────────────────────────────────

def test_g16_18_test_procedure_endpoint():
    """GAP16-18: Test procedure endpoint returns step-by-step physical device procedure."""
    res = client.get("/api/v1/hardware/test-procedure")
    assert res.status_code == 200
    data = res.json()
    assert "steps" in data
    assert len(data["steps"]) >= 5


def test_g16_19_test_procedure_covers_registration():
    """GAP16-19: Test procedure includes device registration step."""
    res = client.get("/api/v1/hardware/test-procedure")
    assert res.status_code == 200
    data = res.json()
    actions = [s["action"].lower() for s in data["steps"]]
    assert any("register" in a for a in actions)


def test_g16_20_test_procedure_honest_hardware_status():
    """GAP16-20: Test procedure honestly labels physical hardware as NOT_DEMONSTRATED."""
    res = client.get("/api/v1/hardware/test-procedure")
    assert res.status_code == 200
    data = res.json()
    hw_status = data.get("hardware_status", "")
    assert "NOT_DEMONSTRATED" in hw_status or "not" in hw_status.lower()


# ─────────────────────────────────────────────────────────────
# GAP 16.5: SIMULATED TELEMETRY REGRESSION (must still work)
# ─────────────────────────────────────────────────────────────

def test_g16_21_simulated_telemetry_regression():
    """GAP16-21: Simulated telemetry still works through existing ingest endpoint."""
    payload = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": 42.5,
        "heading_deg": 90.0,
        "telemetry_source": "SIMULATED GPS TELEMETRY"
    }
    res = client.post("/api/v1/telemetry/ingest", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["tracking_mode"] == "SIMULATION"


def test_g16_22_hardware_telemetry_uses_same_ingest_path():
    """GAP16-22: Hardware packets go through same ingest path as simulated — tracking_mode differs."""
    # Register device first
    reg = client.post("/api/v1/telemetry/devices/register", json={
        "vehicle_code": "NER-V001",
        "device_id": "TEST-HW-DEVICE-16",
        "device_type": "GPS_TRACKER"
    })
    assert reg.status_code == 200
    api_key = reg.json()["device_api_key"]

    hw_payload = {
        "vehicle_code": "NER-V001",
        "device_id": "TEST-HW-DEVICE-16",
        "latitude": 26.2400,
        "longitude": 92.1500,
        "speed_kmh": 50.0,
        "telemetry_source": "HARDWARE_GPS_TRACKER"
    }
    res = client.post("/api/v1/telemetry/ingest", json=hw_payload,
                      headers={"X-Device-API-Key": api_key})
    assert res.status_code == 200
    data = res.json()
    assert data["tracking_mode"] == "LIVE_HARDWARE"


def test_g16_23_device_registration_returns_api_key():
    """GAP16-23: Device registration returns cryptographically secure API key."""
    res = client.post("/api/v1/telemetry/devices/register", json={
        "vehicle_code": "NER-V002",
        "device_id": "QUECLINK-GV300-001",
        "device_type": "OBD_TRACKER"
    })
    assert res.status_code == 200
    data = res.json()
    assert "device_api_key" in data
    key = data["device_api_key"]
    assert key.startswith("dev_sec_")
    assert len(key) >= 20
    assert "ingest_endpoint" in data


def test_g16_24_fleet_health_shows_tracking_mode():
    """GAP16-24: Fleet health endpoint exposes tracking_mode for GIS display."""
    res = client.get("/api/v1/telemetry/health")
    assert res.status_code == 200
    data = res.json()
    assert "devices" in data
    for device in data["devices"]:
        assert "tracking_mode" in device
        assert device["tracking_mode"] in ["SIMULATION", "LIVE_HARDWARE"]
