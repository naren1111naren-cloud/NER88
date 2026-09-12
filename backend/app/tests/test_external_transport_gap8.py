import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import SessionLocal
from app.models.models import Vehicle, TelemetryLog, AuditLog
from app.schemas.schemas import ExternalTransportRecordIn, ExternalTransportBatchIn
from app.services.transport_integration_service import (
    TransportIntegrationService,
    ULIPTransportAdapter,
    VAHANTransportAdapter,
    FASTagTransportAdapter
)

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_test_transport_records():
    db = SessionLocal()
    db.query(TelemetryLog).filter(TelemetryLog.telemetry_source.like("EXTERNAL_%")).delete(synchronize_session=False)
    db.query(Vehicle).filter(Vehicle.telemetry_source.like("EXTERNAL_%")).delete(synchronize_session=False)
    db.commit()
    db.close()
    yield
    db = SessionLocal()
    db.query(TelemetryLog).filter(TelemetryLog.telemetry_source.like("EXTERNAL_%")).delete(synchronize_session=False)
    db.query(Vehicle).filter(Vehicle.telemetry_source.like("EXTERNAL_%")).delete(synchronize_session=False)
    db.commit()
    db.close()

def test_transport_adapter_initialization():
    """Verify ULIP, VAHAN, and FASTag adapters initialize with proper contracts."""
    ulip = ULIPTransportAdapter()
    vahan = VAHANTransportAdapter()
    fastag = FASTagTransportAdapter()

    assert ulip.provider_name == "ULIP_LOGISTICS_GATEWAY"
    assert vahan.provider_name == "VAHAN_FLEET_REGISTRY"
    assert fastag.provider_name == "FASTAG_TOLL_TRANSIT"
    assert ulip.mode == "INTEGRATION-READY"

def test_external_record_normalization():
    """Verify raw external record normalization and field mapping."""
    raw = ExternalTransportRecordIn(
        external_provider="ULIP_LOGISTICS_GATEWAY",
        external_vehicle_id="ULIP-101",
        license_plate="as-01-ef-4455",
        vehicle_type="Heavy Multi-Axle Truck",
        capacity_tons=24.0,
        current_lat=26.1500,
        current_lng=91.7500,
        speed_kmh=45.0,
        heading_deg=85.0,
        status="IN_TRANSIT",
        current_corridor="COR-NH27"
    )
    norm = TransportIntegrationService.normalize_record(raw)
    assert norm["license_plate"] == "AS-01-EF-4455"
    assert norm["external_vehicle_id"] == "ULIP-101"
    assert norm["telemetry_source"] == "EXTERNAL_ULIP_LOGISTICS_GATEWAY"
    assert norm["current_lat"] == 26.1500

def test_invalid_coordinates_rejection():
    """Verify that coordinates out of bounds raise validation error."""
    raw_invalid = ExternalTransportRecordIn(
        external_provider="ULIP_LOGISTICS_GATEWAY",
        external_vehicle_id="ULIP-999",
        license_plate="AS-01-XX-0000",
        current_lat=95.0, # Invalid lat > 90
        current_lng=91.7500
    )
    with pytest.raises(ValueError) as exc:
        TransportIntegrationService.normalize_record(raw_invalid)
    assert "Invalid geographical coordinates" in str(exc.value)

def test_batch_sync_and_persistence():
    """Verify batch synchronization creates Vehicle and Telemetry records in DB."""
    db = SessionLocal()
    batch = [
        ExternalTransportRecordIn(
            external_provider="ULIP_LOGISTICS_GATEWAY",
            external_vehicle_id="ULIP-V01",
            license_plate="AS-01-AA-1111",
            vehicle_type="Heavy Cargo Truck",
            capacity_tons=25.0,
            current_lat=26.1445,
            current_lng=91.7362,
            speed_kmh=40.0
        ),
        ExternalTransportRecordIn(
            external_provider="VAHAN_FLEET_REGISTRY",
            external_vehicle_id="VAHAN-V02",
            license_plate="ML-05-BB-2222",
            vehicle_type="Refrigerated Pharma Truck",
            capacity_tons=15.0,
            current_lat=25.5788,
            current_lng=91.8933,
            speed_kmh=35.0
        )
    ]
    summary = TransportIntegrationService.sync_external_batch(batch, db, "TEST_BATCH")
    assert summary.status == "SUCCESS"
    assert summary.total_received == 2
    assert summary.synced_count == 2
    assert summary.errors_count == 0

    # Verify vehicle exists in DB
    v1 = db.query(Vehicle).filter(Vehicle.vehicle_code == "EXT-ULIP-V01").first()
    assert v1 is not None
    assert v1.vehicle_code == "EXT-ULIP-V01"
    assert v1.telemetry_source == "EXTERNAL_ULIP_LOGISTICS_GATEWAY"

    # Verify telemetry log
    tel = db.query(TelemetryLog).filter(TelemetryLog.vehicle_id == v1.id).first()
    assert tel is not None
    assert tel.latitude == 26.1445
    db.close()

def test_duplicate_prevention_on_resync():
    """Verify that syncing the same external vehicle updates state without creating duplicate rows."""
    db = SessionLocal()
    rec1 = ExternalTransportRecordIn(
        external_provider="ULIP_LOGISTICS_GATEWAY",
        external_vehicle_id="ULIP-DEDUP",
        license_plate="AS-01-DD-9999",
        current_lat=26.1000,
        current_lng=91.7000,
        speed_kmh=30.0
    )
    TransportIntegrationService.sync_external_batch([rec1], db)

    # Initial count
    count_before = db.query(Vehicle).filter(Vehicle.vehicle_code == "EXT-ULIP-DEDUP").count()
    assert count_before == 1

    # Resync with updated position
    rec2 = ExternalTransportRecordIn(
        external_provider="ULIP_LOGISTICS_GATEWAY",
        external_vehicle_id="ULIP-DEDUP",
        license_plate="AS-01-DD-9999",
        current_lat=26.2000,
        current_lng=91.8000,
        speed_kmh=50.0
    )
    summary2 = TransportIntegrationService.sync_external_batch([rec2], db)
    assert summary2.updated_count == 1
    assert summary2.synced_count == 0

    # Count must remain 1
    count_after = db.query(Vehicle).filter(Vehicle.vehicle_code == "EXT-ULIP-DEDUP").count()
    assert count_after == 1

    v = db.query(Vehicle).filter(Vehicle.vehicle_code == "EXT-ULIP-DEDUP").first()
    assert v.current_lat == 26.2000
    assert v.speed_kmh == 50.0
    db.close()

def test_transport_status_api_endpoint():
    """Verify GET /api/v1/transport/status reports providers as INTEGRATION-READY."""
    response = client.get("/api/v1/transport/status")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3
    provider_names = [p["provider_name"] for p in data]
    assert "ULIP_LOGISTICS_GATEWAY" in provider_names
    assert "VAHAN_FLEET_REGISTRY" in provider_names
    assert "FASTAG_TOLL_TRANSIT" in provider_names
    for p in data:
        assert p["integration_mode"] == "INTEGRATION-READY"

def test_transport_sync_api_endpoint():
    """Verify POST /api/v1/transport/sync processes incoming batch."""
    payload = {
        "provider": "ULIP_LOGISTICS_GATEWAY",
        "records": [
            {
                "external_provider": "ULIP_LOGISTICS_GATEWAY",
                "external_vehicle_id": "ULIP-REST-1",
                "license_plate": "AS-02-ZZ-3344",
                "vehicle_type": "Multi-Axle Truck",
                "capacity_tons": 22.0,
                "current_lat": 26.5000,
                "current_lng": 92.2000,
                "speed_kmh": 48.0,
                "heading_deg": 120.0,
                "status": "IN_TRANSIT"
            }
        ]
    }
    response = client.post("/api/v1/transport/sync", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["total_received"] == 1
    assert data["synced_count"] == 1

def test_transport_demo_sync_endpoint():
    """Verify POST /api/v1/transport/demo-sync successfully seeds verified regional mock records."""
    response = client.post("/api/v1/transport/demo-sync")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["total_received"] == 3
