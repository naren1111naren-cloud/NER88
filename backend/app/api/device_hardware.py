"""
GAP 16 — Physical GPS/OBD Device Integration
Hardware Device Readiness & Connection Guide API

STATUS: INTEGRATION-READY
Physical hardware NOT yet demonstrated in this environment.
Simulated telemetry operates through the identical ingestion path.

This module exposes:
  GET  /api/v1/hardware/device-contract      — Full physical device payload contract
  GET  /api/v1/hardware/readiness            — Architecture readiness assessment
  POST /api/v1/hardware/verify-packet        — Dry-run validate a real-device packet
  GET  /api/v1/hardware/test-procedure       — Step-by-step physical test procedure
"""

import os
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.schemas import TelemetryPacketIn
from app.services.telemetry_service import TelemetryService

router = APIRouter(
    prefix="/hardware",
    tags=["GAP 16 — Physical GPS/OBD Device Integration"]
)

# ─────────────────────────────────────────────────────────────
# DEVICE PAYLOAD CONTRACT
# ─────────────────────────────────────────────────────────────
PHYSICAL_DEVICE_CONTRACT = {
    "gap": "GAP 16 — Physical GPS/OBD Device Integration",
    "status": "INTEGRATION-READY — Physical hardware NOT yet demonstrated",
    "ingest_endpoint": "POST /api/v1/telemetry/ingest",
    "auth_header": "X-Device-API-Key: <device_api_key>",
    "content_type": "application/json",
    "payload_schema": {
        "vehicle_code": {
            "type": "string",
            "required": True,
            "example": "NER-V001",
            "description": "Unique vehicle code registered in LINK X8 fleet"
        },
        "device_id": {
            "type": "string",
            "required": False,
            "example": "TELTONIKA-FMB920-001",
            "description": "Physical device hardware identifier (IMEI, serial, or model code)"
        },
        "latitude": {
            "type": "float",
            "required": True,
            "range": [-90.0, 90.0],
            "example": 26.1445,
            "description": "WGS-84 decimal degrees latitude"
        },
        "longitude": {
            "type": "float",
            "required": True,
            "range": [-180.0, 180.0],
            "example": 91.7362,
            "description": "WGS-84 decimal degrees longitude"
        },
        "speed_kmh": {
            "type": "float",
            "required": True,
            "range": [0.0, 200.0],
            "example": 42.5,
            "description": "Vehicle speed in km/h (OBD or GPS-derived)"
        },
        "heading_deg": {
            "type": "float",
            "required": False,
            "range": [0.0, 360.0],
            "example": 90.0,
            "description": "Compass heading in degrees (0=North, 90=East)"
        },
        "altitude_m": {
            "type": "float",
            "required": False,
            "example": 350.0,
            "description": "Altitude above sea level in metres (GPS-derived)"
        },
        "odometer_km": {
            "type": "float",
            "required": False,
            "example": 14650.0,
            "description": "Vehicle odometer reading in km (OBD port if available)"
        },
        "ignition_status": {
            "type": "string",
            "required": False,
            "options": ["ON", "OFF"],
            "example": "ON",
            "description": "Ignition state from OBD/ACC-sense wire"
        },
        "battery_level_pct": {
            "type": "float",
            "required": False,
            "range": [0.0, 100.0],
            "example": 92.0,
            "description": "Device/vehicle battery level percent"
        },
        "satellites_connected": {
            "type": "integer",
            "required": False,
            "range": [0, 50],
            "example": 14,
            "description": "Number of GPS satellites in view"
        },
        "timestamp": {
            "type": "datetime",
            "required": False,
            "example": "2026-09-06T10:00:00Z",
            "description": "UTC ISO-8601 packet timestamp. Defaults to server time if omitted."
        },
        "telemetry_source": {
            "type": "string",
            "required": False,
            "example": "HARDWARE_GPS_DEVICE",
            "description": (
                "Source label. Must contain 'HARDWARE' or 'OBD' for hardware-auth mode. "
                "Use 'SIMULATED GPS TELEMETRY' for simulator packets."
            )
        }
    },
    "authentication": {
        "mechanism": "X-Device-API-Key HTTP header",
        "key_generation": "POST /api/v1/telemetry/devices/register → returns device_api_key",
        "key_format": "dev_sec_<48-hex-chars>",
        "notes": [
            "The API key is bound to a specific vehicle_code in the database.",
            "Hardware auth is enforced when telemetry_source contains 'HARDWARE' or 'OBD'.",
            "Never embed the API key in frontend JavaScript code.",
            "Never share device API keys across vehicles.",
            "Keys are generated with secrets.token_hex(24) — cryptographically secure."
        ]
    },
    "supported_device_classes": [
        {
            "class": "4G LTE GPS Tracker",
            "examples": ["Teltonika FMB920", "Teltonika FMB140", "Queclink GV300"],
            "connection": "Cellular (HTTP POST to ingest endpoint)",
            "notes": "Configure device server URL to LINK X8 telemetry endpoint"
        },
        {
            "class": "OBD-II Telematics Module",
            "examples": ["Thinkrace VT900", "BM Solutions OBD Tracker"],
            "connection": "OBD-II port (J1939/OBD-II) + Cellular uplink",
            "notes": "Speed from OBD is more accurate than GPS-derived speed"
        },
        {
            "class": "Satellite GPS Tracker",
            "examples": ["Garmin inReach Mini", "SPOT Gen4"],
            "connection": "Satellite (Iridium/Globalstar) + HTTP bridge",
            "notes": "For remote high-altitude corridors without cellular coverage"
        },
        {
            "class": "Raspberry Pi / Arduino Dev Kit",
            "examples": ["RPi + SIM808 GSM/GPS", "Arduino MKR GSM 1400"],
            "connection": "Cellular (HTTP POST)",
            "notes": "Suitable for prototype/lab hardware demonstration"
        }
    ],
    "sample_curl": (
        "curl -X POST 'http://localhost:8000/api/v1/telemetry/ingest' \\\n"
        "  -H 'Content-Type: application/json' \\\n"
        "  -H 'X-Device-API-Key: <YOUR_DEVICE_API_KEY>' \\\n"
        "  -d '{\n"
        '    "vehicle_code": "NER-V001",\n'
        '    "device_id": "TELTONIKA-FMB920-001",\n'
        '    "latitude": 26.1445,\n'
        '    "longitude": 91.7362,\n'
        '    "speed_kmh": 42.5,\n'
        '    "heading_deg": 90.0,\n'
        '    "altitude_m": 350.0,\n'
        '    "odometer_km": 14650.0,\n'
        '    "ignition_status": "ON",\n'
        '    "battery_level_pct": 92.0,\n'
        '    "satellites_connected": 14,\n'
        '    "telemetry_source": "HARDWARE_GPS_DEVICE"\n'
        "  }'"
    )
}

# ─────────────────────────────────────────────────────────────
# HARDWARE READINESS ASSESSMENT
# ─────────────────────────────────────────────────────────────
READINESS_REPORT = {
    "gap": "GAP 16 — Physical GPS/OBD Device Integration",
    "assessed_at": "2026-09-06T10:00:00Z",
    "overall_status": "INTEGRATION-READY",
    "checklist": {
        "ingest_endpoint": {"status": "READY", "detail": "POST /api/v1/telemetry/ingest — operational"},
        "batch_endpoint": {"status": "READY", "detail": "POST /api/v1/telemetry/batch — operational"},
        "device_registration": {"status": "READY", "detail": "POST /api/v1/telemetry/devices/register — operational"},
        "device_auth": {"status": "READY", "detail": "X-Device-API-Key header authentication — operational"},
        "payload_validation": {
            "status": "READY",
            "detail": "Latitude ±90, longitude ±180, speed 0-200, heading 0-360 — all validated"
        },
        "freshness_classification": {
            "status": "READY",
            "detail": "LIVE<120s, RECENT<10m, STALE<60m, OFFLINE>60m — operational"
        },
        "vehicle_state_update": {"status": "READY", "detail": "Vehicle current_lat/lng updates on each packet — operational"},
        "gis_position_update": {"status": "READY", "detail": "Fleet health endpoint feeds GIS Leaflet markers — operational"},
        "breadcrumb_persistence": {"status": "READY", "detail": "TelemetryLog table stores all packets as breadcrumbs — operational"},
        "overspeed_detection": {
            "status": "READY",
            "detail": "Mountain corridor overspeed alert (>80 km/h) — operational"
        },
        "signal_loss_alert": {"status": "READY", "detail": "LIVE→STALE/OFFLINE transition alert — operational"},
        "batch_ingestion": {"status": "READY", "detail": "Multiple buffered packets accepted per request — operational"},
        "delivery_location_linkage": {
            "status": "READY",
            "detail": "Vehicle position links to active delivery via vehicle_id — operational"
        },
        "physical_hardware_tested": {
            "status": "NOT_DEMONSTRATED",
            "detail": "No physical GPS/OBD device available in this environment"
        },
        "simulated_telemetry": {"status": "READY", "detail": "Simulator uses identical ingestion path — operational"}
    },
    "architecture_diagram": (
        "PHYSICAL GPS / OBD DEVICE\n"
        "  ↓ [Cellular/Satellite]\n"
        "POST /api/v1/telemetry/ingest (X-Device-API-Key)\n"
        "  ↓ [Device Authentication]\n"
        "  ↓ [Payload Validation: lat/lng/speed/heading]\n"
        "  ↓ [Freshness Classification]\n"
        "TelemetryService.ingest_telemetry_packet()\n"
        "  ↓ [Vehicle State Update]\n"
        "  ↓ [Breadcrumb Append to TelemetryLog]\n"
        "  ↓ [Safety Triggers: Overspeed, Signal Loss]\n"
        "Database → GIS / Delivery / Alert Systems"
    ),
    "limitation": (
        "Physical hardware demonstration not completed. "
        "When a real device is available: register it via /api/v1/telemetry/devices/register, "
        "configure the device to POST to /api/v1/telemetry/ingest with the returned API key, "
        "and run the physical test procedure at GET /api/v1/hardware/test-procedure."
    )
}

# ─────────────────────────────────────────────────────────────
# PHYSICAL TEST PROCEDURE
# ─────────────────────────────────────────────────────────────
TEST_PROCEDURE = {
    "gap": "GAP 16 — Physical GPS/OBD Device Integration",
    "test_procedure_version": "1.0",
    "hardware_status": "NOT_DEMONSTRATED — procedure documented for when hardware is available",
    "steps": [
        {
            "step": 1,
            "action": "Register the physical device",
            "command": (
                "curl -X POST 'http://<HOST>/api/v1/telemetry/devices/register' "
                "-H 'Content-Type: application/json' "
                "-H 'Authorization: Bearer <ADMIN_JWT>' "
                "-d '{\"vehicle_code\": \"NER-V001\", \"device_id\": \"<DEVICE_IMEI>\", \"device_type\": \"GPS_TRACKER\"}'"
            ),
            "expected": "Returns device_api_key — copy and configure in device firmware/server URL"
        },
        {
            "step": 2,
            "action": "Power on device and configure server URL",
            "detail": (
                "In device configuration portal/SMS command, set:\n"
                "  Server URL: http://<HOST>/api/v1/telemetry/ingest\n"
                "  Protocol: HTTP POST JSON\n"
                "  Header: X-Device-API-Key: <device_api_key>\n"
                "  Content-Type: application/json\n"
                "  Report interval: 30 seconds (recommended)"
            ),
            "expected": "Device begins transmitting packets at configured interval"
        },
        {
            "step": 3,
            "action": "Verify first physical packet reception",
            "command": "curl 'http://<HOST>/api/v1/telemetry/health'",
            "expected": (
                "Vehicle NER-V001 shows: "
                "tracking_mode: LIVE_HARDWARE, telemetry_health: LIVE, "
                "latitude/longitude at physical device location"
            )
        },
        {
            "step": 4,
            "action": "Verify GIS position update",
            "detail": "Open LINK X8 frontend → GIS map → vehicle marker should show at physical GPS coordinates",
            "expected": "Leaflet marker at real-world location, not simulated waypoint"
        },
        {
            "step": 5,
            "action": "Verify historical breadcrumb storage",
            "command": "curl 'http://<HOST>/api/v1/telemetry/vehicles/NER-V001/history?limit=10'",
            "expected": "Array of TelemetryLog entries with telemetry_source: HARDWARE_GPS_DEVICE"
        },
        {
            "step": 6,
            "action": "Test overspeed detection (if safe to do so on test track)",
            "detail": "Drive vehicle above 80 km/h — system should generate OVERSPEEDING_WARNING alert",
            "command": "curl 'http://<HOST>/api/v1/alerts'",
            "expected": "OVERSPEEDING_WARNING alert with actual speed from device"
        },
        {
            "step": 7,
            "action": "Test signal loss detection",
            "detail": "Power off device or enter Faraday cage for >2 minutes",
            "expected": "Vehicle telemetry_health transitions to STALE, then OFFLINE with signal-loss alert"
        },
        {
            "step": 8,
            "action": "Test invalid packet rejection",
            "command": (
                "curl -X POST 'http://<HOST>/api/v1/telemetry/ingest' "
                "-H 'X-Device-API-Key: <KEY>' "
                "-d '{\"vehicle_code\": \"NER-V001\", \"latitude\": 999, \"longitude\": 91.7, \"speed_kmh\": 40}'"
            ),
            "expected": "HTTP 422 — invalid latitude rejected, backend does not crash"
        },
        {
            "step": 9,
            "action": "Test invalid API key rejection",
            "command": (
                "curl -X POST 'http://<HOST>/api/v1/telemetry/ingest' "
                "-H 'X-Device-API-Key: invalid_key' "
                "-H 'Content-Type: application/json' "
                "-d '{\"vehicle_code\": \"NER-V001\", \"latitude\": 26.1, \"longitude\": 91.7, "
                "\"speed_kmh\": 40, \"telemetry_source\": \"HARDWARE_GPS_DEVICE\"}'"
            ),
            "expected": "HTTP 401 — unauthorized, backend does not crash"
        },
        {
            "step": 10,
            "action": "Record test results and mark GAP 16 demonstrated",
            "detail": (
                "Document: device model, IMEI, first packet timestamp, "
                "coordinates received, telemetry_health value, tracking_mode. "
                "These constitute the physical hardware demonstration evidence."
            )
        }
    ]
}


# ─────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────

@router.get("/device-contract")
def get_device_contract():
    """
    Returns the complete physical GPS/OBD device payload contract.
    Defines exactly what a physical device must send to LINK X8 telemetry API.
    STATUS: INTEGRATION-READY (Physical hardware not yet demonstrated)
    """
    return PHYSICAL_DEVICE_CONTRACT


@router.get("/readiness")
def get_hardware_readiness():
    """
    Returns the hardware readiness assessment for Gap 16.
    Documents which components are operational vs. requiring physical hardware.
    """
    return READINESS_REPORT


@router.get("/test-procedure")
def get_test_procedure():
    """
    Returns the step-by-step physical device test procedure.
    To be executed when a real GPS/OBD device is available.
    """
    return TEST_PROCEDURE


@router.post("/verify-packet")
def verify_hardware_packet(
    packet: TelemetryPacketIn,
    x_device_api_key: Optional[str] = Header(None, alias="X-Device-API-Key"),
    db: Session = Depends(get_db)
):
    """
    DRY-RUN: Validates a physical device packet without committing to database.
    Returns what would happen if this packet were ingested.
    Use this to test your device's payload format before going live.
    """
    errors = []
    warnings = []

    # Validate latitude
    if not (-90.0 <= packet.latitude <= 90.0):
        errors.append(f"Invalid latitude {packet.latitude}: must be in [-90, +90]")

    # Validate longitude
    if not (-180.0 <= packet.longitude <= 180.0):
        errors.append(f"Invalid longitude {packet.longitude}: must be in [-180, +180]")

    # Validate speed
    if packet.speed_kmh < 0.0:
        errors.append(f"Invalid speed {packet.speed_kmh}: must be >= 0")
    elif packet.speed_kmh > 200.0:
        errors.append(f"Implausible speed {packet.speed_kmh}: exceeds 200 km/h")

    # Validate heading
    if packet.heading_deg is not None and not (0.0 <= packet.heading_deg <= 360.0):
        errors.append(f"Invalid heading {packet.heading_deg}: must be in [0, 360]")

    # NER geographic scope check
    NER_LAT_MIN, NER_LAT_MAX = 21.5, 29.5
    NER_LNG_MIN, NER_LNG_MAX = 88.0, 97.5
    if not errors:
        if not (NER_LAT_MIN <= packet.latitude <= NER_LAT_MAX and
                NER_LNG_MIN <= packet.longitude <= NER_LNG_MAX):
            warnings.append(
                f"Coordinates [{packet.latitude}, {packet.longitude}] are outside "
                "the North Eastern Region bounding box. Device may be mis-positioned."
            )

    # Hardware source check
    is_hardware = "HARDWARE" in (packet.telemetry_source or "").upper() or \
                  "OBD" in (packet.telemetry_source or "").upper()
    if is_hardware and not x_device_api_key:
        warnings.append("Hardware source declared but X-Device-API-Key header is missing — auth will fail on live ingest")

    # Freshness check
    freshness = "LIVE"
    if packet.timestamp:
        now = datetime.now(timezone.utc)
        pkt_ts = packet.timestamp if packet.timestamp.tzinfo else packet.timestamp.replace(tzinfo=timezone.utc)
        age_s = abs((now - pkt_ts).total_seconds())
        if age_s >= 3600:
            freshness = "OFFLINE"
            warnings.append(f"Packet timestamp is {int(age_s/60)} minutes old — will classify as OFFLINE")
        elif age_s >= 600:
            freshness = "STALE"
            warnings.append(f"Packet timestamp is {int(age_s/60)} minutes old — will classify as STALE")
        elif age_s >= 120:
            freshness = "RECENT"

    overspeed = packet.speed_kmh > 80.0

    return {
        "dry_run": True,
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "predicted_freshness": freshness,
        "predicted_tracking_mode": "LIVE_HARDWARE" if is_hardware else "SIMULATION",
        "overspeed_would_trigger": overspeed,
        "overspeed_threshold_kmh": 80.0,
        "packet_summary": {
            "vehicle_code": packet.vehicle_code,
            "device_id": packet.device_id,
            "coordinates": [packet.latitude, packet.longitude],
            "speed_kmh": packet.speed_kmh,
            "heading_deg": packet.heading_deg,
            "telemetry_source": packet.telemetry_source,
            "has_auth_key": x_device_api_key is not None
        },
        "note": (
            "This is a dry-run validation only. No data was written to the database. "
            "To ingest for real, POST to /api/v1/telemetry/ingest with X-Device-API-Key header."
        )
    }
