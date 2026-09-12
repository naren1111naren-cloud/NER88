import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import SessionLocal
from app.models.models import Incident, Bridge, Corridor, District, Alert, Vehicle
from app.schemas.schemas import (
    GovernmentMonitoringRecord,
    GovMonitoringRecordIn,
    GovMonitoringBatchIn,
    GovRoadStatusIn,
    GovBridgeStatusIn,
    GovDisasterIncidentIn,
    GovDistrictInfoIn,
    GovTransportInfoIn,
    GovInfrastructureStatusIn
)
from app.services.government_integration_service import GovernmentIntegrationService
from app.services.accessibility_service import AccessibilityEngine
from app.core.config import settings

client = TestClient(app)

@pytest.fixture(autouse=True)
def cleanup_gov_incidents():
    db = SessionLocal()
    db.query(Alert).filter(Alert.alert_type == "GOVERNMENT_OPERATIONAL_BULLETIN").delete(synchronize_session=False)
    db.query(Incident).filter(Incident.reporter_name.like("Official Feed%")).delete(synchronize_session=False)
    db.commit()
    AccessibilityEngine.recalculate_all_accessibility(db)
    db.close()
    yield
    db = SessionLocal()
    db.query(Alert).filter(Alert.alert_type == "GOVERNMENT_OPERATIONAL_BULLETIN").delete(synchronize_session=False)
    db.query(Incident).filter(Incident.reporter_name.like("Official Feed%")).delete(synchronize_session=False)
    db.commit()
    AccessibilityEngine.recalculate_all_accessibility(db)
    db.close()

# -------------------------------------------------------------------------
# 1. Valid Road Record Test
# -------------------------------------------------------------------------
def test_01_valid_road_record():
    """TEST 1: Ingest valid road status contract."""
    payload = {
        "source": "NHAI_RAMS",
        "source_record_id": "NHAI-ROAD-001",
        "road_id": "COR-NH27",
        "status": "BLOCKED",
        "severity": "HIGH",
        "district": "Kamrup Metropolitan",
        "location_name": "Sonapur Stretch, NH-27",
        "latitude": 26.1150,
        "longitude": 91.9820,
        "description": "Culvert subsidence after flash flood"
    }
    res = client.post("/api/v1/government/road-status", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["accepted"] == 1
    assert data["corridors_affected"] >= 1

# -------------------------------------------------------------------------
# 2. Invalid Road Record Test
# -------------------------------------------------------------------------
def test_02_invalid_road_record_coordinates():
    """TEST 2: Reject invalid road status with out-of-bounds coordinates."""
    record = GovernmentMonitoringRecord(
        source="NHAI_RAMS",
        source_record_id="NHAI-BAD-01",
        data_type="ROAD_STATUS",
        location_name="Invalid Point",
        latitude=145.0, # invalid lat > 90
        longitude=91.73,
        description="Bad road data"
    )
    is_valid, err, _ = GovernmentIntegrationService.validate_record(record)
    assert is_valid is False
    assert "Invalid geo coordinates" in err

# -------------------------------------------------------------------------
# 3. Valid Bridge Record Test
# -------------------------------------------------------------------------
def test_03_valid_bridge_record():
    """TEST 3: Ingest valid bridge status contract with load restriction."""
    db = SessionLocal()
    bridge = db.query(Bridge).first()
    b_code = bridge.bridge_code if bridge else "BRG-001"
    db.close()

    payload = {
        "source": "BRO_BRIDGE_COMMAND",
        "source_record_id": "BRO-BRG-2026-9",
        "bridge_id": b_code,
        "status": "RESTRICTED",
        "load_restriction_tons": 14.5,
        "is_closed": False,
        "location_name": "Tezpur Brahmaputra River Crossing",
        "latitude": 26.6110,
        "longitude": 92.7950,
        "severity": "HIGH",
        "reason": "Pier foundation scouring inspection"
    }
    res = client.post("/api/v1/government/bridge-status", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["bridges_updated"] == 1

# -------------------------------------------------------------------------
# 4. Invalid Bridge Record Test
# -------------------------------------------------------------------------
def test_04_invalid_bridge_record_missing_fields():
    """TEST 4: Ingest invalid bridge record with missing identifiers."""
    payload = {
        "source": "BRO_BRIDGE_COMMAND",
        "source_record_id": "", # empty ID
        "bridge_id": "BRG-001",
        "location_name": "Nowhere",
        "latitude": 26.14,
        "longitude": 91.73,
        "reason": "Missing ID"
    }
    res = client.post("/api/v1/government/bridge-status", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["rejected"] == 1

# -------------------------------------------------------------------------
# 5. Valid Disaster Record Test
# -------------------------------------------------------------------------
def test_05_valid_disaster_record():
    """TEST 5: Ingest valid disaster incident from NDMA Sachet."""
    payload = {
        "source": "NDMA_SACHET_PORTAL",
        "source_record_id": "NDMA-LANDSLIDE-701",
        "incident_type": "LANDSLIDE",
        "severity": "CRITICAL",
        "location_name": "Jatinga Slopes, Dima Hasao",
        "latitude": 25.1200,
        "longitude": 93.0300,
        "district": "Dima Hasao",
        "state": "Assam",
        "status": "ACTIVE",
        "description": "Massive mudflow across NH-27 corridor blocking heavy transport."
    }
    res = client.post("/api/v1/government/disaster", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["incidents_created"] == 1
    assert data["alerts_dispatched"] == 1

# -------------------------------------------------------------------------
# 6. Invalid Disaster Record Test
# -------------------------------------------------------------------------
def test_06_invalid_disaster_record():
    """TEST 6: Reject disaster record with missing source agency."""
    record = GovernmentMonitoringRecord(
        source="",
        source_record_id="NDMA-002",
        data_type="DISASTER_INCIDENT",
        location_name="Site",
        latitude=26.1,
        longitude=91.7,
        description="Missing source"
    )
    is_valid, err, _ = GovernmentIntegrationService.validate_record(record)
    assert is_valid is False
    assert "Source agency identifier is required" in err

# -------------------------------------------------------------------------
# 7. District Record Test
# -------------------------------------------------------------------------
def test_07_district_record_ingestion():
    """TEST 7: Ingest district administrative accessibility advisory."""
    payload = {
        "source": "STATE_DISASTER_MANAGEMENT_AUTHORITY",
        "source_record_id": "SDMA-DIST-01",
        "district_name": "Kamrup Metropolitan",
        "state": "Assam",
        "accessibility_status": "SEVERELY_ISOLATED",
        "latitude": 26.14,
        "longitude": 91.73,
        "notes": "All arterial roads blocked due to flash flood."
    }
    res = client.post("/api/v1/government/district", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["accepted"] == 1
    assert data["districts_affected"] >= 1

# -------------------------------------------------------------------------
# 8. Transport Record Test
# -------------------------------------------------------------------------
def test_08_transport_record_ingestion():
    """TEST 8: Ingest government military / relief convoy telemetry ping."""
    payload = {
        "source": "MORTH_TRANSPORT_MONITOR",
        "source_record_id": "CONVOY-PING-881",
        "transport_id": "NER-CONVOY-04",
        "transport_type": "RELIEF_CONVOY",
        "location_name": "Dimapur Transit Checkpoint",
        "latitude": 25.9060,
        "longitude": 93.7273,
        "status": "IN_TRANSIT",
        "corridor_code": "COR-NH29"
    }
    res = client.post("/api/v1/government/transport", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["vehicles_tracked"] == 1

# -------------------------------------------------------------------------
# 9. Infrastructure Record Test
# -------------------------------------------------------------------------
def test_09_infrastructure_record_ingestion():
    """TEST 9: Ingest strategic infrastructure condition advisory."""
    payload = {
        "source": "STATE_PWD_NER",
        "source_record_id": "INFRA-DEPOT-09",
        "infrastructure_id": "DEPOT-SILCHAR-01",
        "infrastructure_type": "WAREHOUSE",
        "status": "DEGRADED",
        "severity": "HIGH",
        "location_name": "Silchar Central Essential Depot",
        "latitude": 24.8333,
        "longitude": 92.7789,
        "district": "Cachar",
        "description": "Warehouse yard partially waterlogged; heavy truck docking restricted."
    }
    res = client.post("/api/v1/government/infrastructure", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["accepted"] == 1
    assert data["alerts_dispatched"] >= 1

# -------------------------------------------------------------------------
# 10. Duplicate Record Prevention Test
# -------------------------------------------------------------------------
def test_10_duplicate_record_prevention():
    """TEST 10: Verify repeated submissions are idempotent and do not create duplicate incidents."""
    db = SessionLocal()
    rec = GovernmentMonitoringRecord(
        source="NHAI_RAMS",
        source_record_id="NHAI-DEDUP-TEST-99",
        data_type="ROAD_STATUS",
        location_name="NH-27 Km 102",
        latitude=26.14,
        longitude=91.73,
        description="Routine road closure"
    )
    res1 = GovernmentIntegrationService.ingest_single_record(rec, db)
    assert res1.accepted == 1
    assert res1.duplicates == 0

    # Ingest duplicate
    res2 = GovernmentIntegrationService.ingest_single_record(rec, db)
    assert res2.accepted == 1
    assert res2.duplicates == 1
    assert res2.incidents_created == 0

    inc_count = db.query(Incident).filter(Incident.description.like("%NHAI-DEDUP-TEST-99%")).count()
    assert inc_count == 1
    db.close()

# -------------------------------------------------------------------------
# 11. Stale Record Handling Test
# -------------------------------------------------------------------------
def test_11_stale_record_handling():
    """TEST 11: Identify and tag stale government records (>72 hours old)."""
    old_time = datetime.utcnow() - timedelta(hours=96)
    rec = GovernmentMonitoringRecord(
        source="NDMA_SACHET_PORTAL",
        source_record_id="NDMA-OLD-01",
        data_type="DISASTER_INCIDENT",
        location_name="Old Flood Site",
        latitude=26.14,
        longitude=91.73,
        timestamp=old_time,
        description="Historical inundation alert"
    )
    is_valid, err, is_stale = GovernmentIntegrationService.validate_record(rec)
    assert is_valid is True
    assert is_stale is True

    db = SessionLocal()
    summary = GovernmentIntegrationService.ingest_single_record(rec, db)
    assert summary.stale_records == 1
    inc = db.query(Incident).filter(Incident.description.like("%NDMA-OLD-01%")).first()
    assert inc is not None
    assert "[STALE FEED]" in inc.description
    db.close()

# -------------------------------------------------------------------------
# 12. Invalid Timestamp (Far Future) Test
# -------------------------------------------------------------------------
def test_12_invalid_future_timestamp_rejected():
    """TEST 12: Reject timestamp in the future (>24 hours)."""
    future_time = datetime.utcnow() + timedelta(hours=48)
    rec = GovernmentMonitoringRecord(
        source="NDMA_SACHET_PORTAL",
        source_record_id="NDMA-FUT-01",
        data_type="DISASTER_INCIDENT",
        location_name="Future Site",
        latitude=26.14,
        longitude=91.73,
        timestamp=future_time,
        description="Invalid future bulletin"
    )
    is_valid, err, _ = GovernmentIntegrationService.validate_record(rec)
    assert is_valid is False
    assert "more than 24 hours in the future" in err

# -------------------------------------------------------------------------
# 13. Missing Source Rejection Test
# -------------------------------------------------------------------------
def test_13_missing_source_rejection():
    """TEST 13: Reject payload with empty source."""
    rec = GovernmentMonitoringRecord(
        source="",
        source_record_id="REC-001",
        location_name="Site",
        latitude=26.1,
        longitude=91.7,
        description="No source"
    )
    is_valid, err, _ = GovernmentIntegrationService.validate_record(rec)
    assert is_valid is False
    assert "Source agency identifier is required" in err

# -------------------------------------------------------------------------
# 14. Invalid Location Coordinates Test
# -------------------------------------------------------------------------
def test_14_invalid_location_rejected():
    """TEST 14: Reject latitude < -90 or longitude > 180."""
    rec = GovernmentMonitoringRecord(
        source="NDMA_SACHET_PORTAL",
        source_record_id="REC-002",
        location_name="Bad Coords",
        latitude=-95.0,
        longitude=190.0,
        description="Bad coordinates"
    )
    is_valid, err, _ = GovernmentIntegrationService.validate_record(rec)
    assert is_valid is False
    assert "Invalid geo coordinates" in err

# -------------------------------------------------------------------------
# 15. Unsupported Data Type Test
# -------------------------------------------------------------------------
def test_15_unsupported_data_type():
    """TEST 15: Reject unsupported government data type."""
    rec = GovernmentMonitoringRecord(
        source="NDMA_SACHET_PORTAL",
        source_record_id="REC-003",
        data_type="UNSUPPORTED_TYPE_XYZ",
        location_name="Site",
        latitude=26.1,
        longitude=91.7,
        description="Unsupported type"
    )
    is_valid, err, _ = GovernmentIntegrationService.validate_record(rec)
    assert is_valid is False
    assert "Unsupported data_type" in err

# -------------------------------------------------------------------------
# 16. Unauthorized Request Test
# -------------------------------------------------------------------------
def test_16_unauthorized_request():
    """TEST 16: Verify 401 Unauthorized on invalid X-Gov-System-Key header."""
    headers = {"X-Gov-System-Key": "invalid-secret-key-123"}
    payload = {
        "source": "NHAI_RAMS",
        "records": [
            {
                "source": "NHAI_RAMS",
                "source_record_id": "NHAI-001",
                "location_name": "Guwahati",
                "latitude": 26.14,
                "longitude": 91.73,
                "description": "Road fix"
            }
        ]
    }
    res = client.post("/api/v1/government/monitoring/batch", json=payload, headers=headers)
    assert res.status_code == 401

# -------------------------------------------------------------------------
# 17. Batch Ingestion Metrics Test
# -------------------------------------------------------------------------
def test_17_batch_ingestion_metrics():
    """TEST 17: Process multi-item batch with accepted, rejected, and duplicate tallies."""
    db = SessionLocal()
    # Pre-seed one record to trigger duplicate
    pre_rec = GovernmentMonitoringRecord(
        source="NDMA_SACHET_PORTAL",
        source_record_id="BATCH-DUP-01",
        data_type="DISASTER_INCIDENT",
        location_name="Preseeded Site",
        latitude=26.14,
        longitude=91.73,
        description="Pre-existing record"
    )
    GovernmentIntegrationService.ingest_single_record(pre_rec, db)
    db.close()

    batch_payload = {
        "agency_name": "NDMA_SACHET_PORTAL",
        "records": [
            # 1. Valid Record
            {
                "source": "NDMA_SACHET_PORTAL",
                "source_record_id": "BATCH-VAL-01",
                "data_type": "DISASTER_INCIDENT",
                "location_name": "Valid Site 1",
                "latitude": 26.14,
                "longitude": 91.73,
                "description": "Flash landslide"
            },
            # 2. Duplicate Record
            {
                "source": "NDMA_SACHET_PORTAL",
                "source_record_id": "BATCH-DUP-01",
                "data_type": "DISASTER_INCIDENT",
                "location_name": "Preseeded Site",
                "latitude": 26.14,
                "longitude": 91.73,
                "description": "Pre-existing record"
            },
            # 3. Invalid Record (bad lat)
            {
                "source": "NDMA_SACHET_PORTAL",
                "source_record_id": "BATCH-INV-01",
                "data_type": "DISASTER_INCIDENT",
                "location_name": "Bad Latitude Site",
                "latitude": 110.0,
                "longitude": 91.73,
                "description": "Invalid record"
            }
        ]
    }
    res = client.post("/api/v1/government/monitoring/batch", json=batch_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["received"] == 3
    assert data["accepted"] == 2 # 1 new + 1 duplicate accepted
    assert data["duplicates"] == 1
    assert data["rejected"] == 1
    assert len(data["rejected_items"]) == 1

# -------------------------------------------------------------------------
# 18. Downstream Integration (Cascade & Alerts) Test
# -------------------------------------------------------------------------
def test_18_downstream_integration_cascade():
    """TEST 18: Ingest critical corridor blockage and verify alert dispatch and corridor status."""
    db = SessionLocal()
    rec = GovernmentMonitoringRecord(
        source="NHAI_RAMS",
        source_record_id="NHAI-CASCADE-01",
        data_type="ROAD_STATUS",
        location_name="Guwahati Sonapur Stretch, NH-27",
        district_name="Kamrup Metropolitan",
        latitude=26.1150,
        longitude=91.9820,
        affected_corridor_code="COR-NH27",
        severity="CRITICAL",
        status="BLOCKED",
        description="Major landslide and highway breach completely blocking NH-27."
    )
    summary = GovernmentIntegrationService.ingest_single_record(rec, db)
    assert summary.alerts_dispatched >= 1
    assert summary.accessibility_recalculated is True

    corridor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH27").first()
    assert corridor is not None
    assert corridor.status == "BLOCKED"
    db.close()

# -------------------------------------------------------------------------
# 19. API Response Schema Structure Test
# -------------------------------------------------------------------------
def test_19_api_response_schema_structure():
    """TEST 19: Verify GET /api/v1/government/status contains all required metadata."""
    res = client.get("/api/v1/government/status")
    assert res.status_code == 200
    data = res.json()
    assert data["integration_mode"] == "INTEGRATION-READY"
    assert data["api_health"] == "MONITORING_STANDBY"
    assert "supported_data_contracts" in data
    assert len(data["supported_data_contracts"]) == 6
    assert "ROAD_STATUS" in data["supported_data_contracts"]
    assert "BRIDGE_STATUS" in data["supported_data_contracts"]

# -------------------------------------------------------------------------
# 20. OpenAPI Schema Registration Test
# -------------------------------------------------------------------------
def test_20_openapi_schema_generation():
    """TEST 20: Verify OpenAPI /docs schema contains government integration paths and models."""
    res = client.get(f"{settings.API_V1_STR}/openapi.json")
    assert res.status_code == 200
    schema = res.json()
    paths = schema.get("paths", {})
    assert "/api/v1/government/status" in paths
    assert "/api/v1/government/monitoring" in paths
    assert "/api/v1/government/road-status" in paths
    assert "/api/v1/government/bridge-status" in paths
    assert "/api/v1/government/disaster" in paths
    assert "/api/v1/government/district" in paths
    assert "/api/v1/government/transport" in paths
    assert "/api/v1/government/infrastructure" in paths

