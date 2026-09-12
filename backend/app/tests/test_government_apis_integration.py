"""
Test Suite for Government APIs Integration:
- data.gov.in (OGD Platform India)
- NHAI (RAMS & FASTag Toll Plazas)
- BRO (Mountain Passes & Strategic Bridges)
- VAHAN (Vehicle Registry & Bridge Weight Compliance)
- Master Multi-Agency Synchronization
"""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import SessionLocal
from app.models.models import Alert, Incident
from app.services.accessibility_service import AccessibilityEngine

client = TestClient(app)

@pytest.fixture(autouse=True)
def cleanup_test_state():
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

# =========================================================================
# 1. GOVERNMENT STATUS & READINESS
# =========================================================================

def test_gov_status_includes_all_agencies():
    response = client.get("/api/v1/government/status")
    assert response.status_code == 200
    data = response.json()
    assert data["integration_mode"] == "INTEGRATION-READY"
    agency_codes = [a["agency_code"] for a in data["connected_agencies"]]
    assert "DATA_GOV_IN_OGD" in agency_codes
    assert "NHAI_HIGHWAY_MONITOR" in agency_codes
    assert "BRO_BRIDGE_COMMAND" in agency_codes
    assert "VAHAN_FLEET_REGISTRY" in agency_codes

# =========================================================================
# 2. DATA.GOV.IN (OPEN GOVERNMENT DATA) TESTS
# =========================================================================

def test_data_gov_catalog():
    response = client.get("/api/v1/government/data-gov/catalog")
    assert response.status_code == 200
    catalogs = response.json()
    assert len(catalogs) >= 3
    assert any("MoRTH" in c["title"] for c in catalogs)
    assert any("IMD" in c["title"] for c in catalogs)

def test_data_gov_query():
    response = client.get("/api/v1/government/data-gov/query?resource_id=9ef84268-d588-465a-a308-a864a43d0070&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert len(data["records"]) > 0
    assert "highway_number" in data["records"][0]

def test_data_gov_sync():
    response = client.post("/api/v1/government/data-gov/sync?resource_id=9ef84268-d588-465a-a308-a864a43d0070")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["total_records_processed"] > 0
    assert data["accessibility_recalculated"] is True

# =========================================================================
# 3. NHAI RAMS & FASTAG TESTS
# =========================================================================

def test_nhai_corridors():
    response = client.get("/api/v1/government/nhai/corridors")
    assert response.status_code == 200
    corridors = response.json()
    assert len(corridors) >= 4
    codes = [c["corridor_code"] for c in corridors]
    assert "COR-NH27" in codes
    assert "COR-NH37" in codes

def test_nhai_toll_plazas():
    response = client.get("/api/v1/government/nhai/toll-plazas")
    assert response.status_code == 200
    tolls = response.json()
    assert len(tolls) >= 3
    assert tolls[0]["fastag_penetration_rate_pct"] > 90.0

def test_nhai_sync():
    response = client.post("/api/v1/government/nhai/sync")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["corridors_synced"] > 0

# =========================================================================
# 4. BRO MOUNTAIN PASSES & BRIDGES TESTS
# =========================================================================

def test_bro_mountain_passes():
    response = client.get("/api/v1/government/bro/mountain-passes")
    assert response.status_code == 200
    passes = response.json()
    assert len(passes) >= 4
    pass_names = [p["pass_name"] for p in passes]
    assert any("Sela" in name for name in pass_names)
    assert any("Bum La" in name for name in pass_names)

def test_bro_strategic_bridges():
    response = client.get("/api/v1/government/bro/strategic-bridges")
    assert response.status_code == 200
    bridges = response.json()
    assert len(bridges) >= 4
    bridge_codes = [b["bridge_code"] for b in bridges]
    assert "BRG-001" in bridge_codes
    assert "BRG-003" in bridge_codes

def test_bro_sync():
    response = client.post("/api/v1/government/bro/sync")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["mountain_passes_tracked"] > 0

# =========================================================================
# 5. VAHAN VEHICLE & BRIDGE COMPLIANCE TESTS
# =========================================================================

def test_vahan_vehicle_lookup_success():
    mock_data = {
        "registration_number": "AS01EC9921",
        "gvw_tons": 28.0,
        "maker_model": "Tata Prima 2830.K",
        "vehicle_class": "Heavy Goods Vehicle",
        "vehicle_status": "ACTIVE",
        "source": "VAHAN via ULIP"
    }
    with patch("app.services.vahan_service.VAHANService.lookup_vehicle", return_value=mock_data):
        response = client.get("/api/v1/government/vahan/vehicle/AS01EC9921")
        assert response.status_code == 200
        veh = response.json()
        assert veh["registration_number"] == "AS01EC9921"
        assert veh["gvw_tons"] == 28.0

def test_vahan_vehicle_lookup_with_hyphens():
    mock_data = {
        "registration_number": "AS01EC9921",
        "gvw_tons": 28.0,
        "maker_model": "Tata Prima 2830.K",
        "vehicle_class": "Heavy Goods Vehicle",
        "vehicle_status": "ACTIVE",
        "source": "VAHAN via ULIP"
    }
    with patch("app.services.vahan_service.VAHANService.lookup_vehicle", return_value=mock_data):
        response = client.get("/api/v1/government/vahan/vehicle/AS-01-EC-9921")
        assert response.status_code == 200
        veh = response.json()
        assert veh["registration_number"] == "AS01EC9921"
        assert veh["gvw_tons"] == 28.0

def test_vahan_bridge_compliance_authorized():
    # Light 3.49T vehicle on 40T bridge (BRG-NH27-01 Saraighat)
    payload = {
        "registration_number": "AR01C1234",
        "bridge_code_or_name": "BRG-NH27-01",
        "actual_payload_tons": 1.5
    }
    response = client.post("/api/v1/government/vahan/verify-compliance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_compliant"] is True
    assert data["verdict"] == "AUTHORIZED_SAFE_PASSAGE"
    assert data["overload_tons"] == 0.0

def test_vahan_bridge_compliance_overweight_violation():
    # 28T heavy hauler on a 24T high-altitude bridge (BRG-NH10-01 Teesta River High-Altitude Bridge)
    payload = {
        "registration_number": "AS01EC9921",
        "bridge_code_or_name": "BRG-NH10-01"
    }
    response = client.post("/api/v1/government/vahan/verify-compliance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_compliant"] is False
    assert data["verdict"] == "VIOLATION_OVERWEIGHT_PROHIBITED"
    assert data["overload_tons"] > 0.0
    assert "OVERWEIGHT ALERT" in data["recommendation"]

def test_vahan_sync_fleet():
    response = client.post("/api/v1/government/vahan/sync-fleet")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["total_vahan_records"] > 0

# =========================================================================
# 6. MASTER MULTI-AGENCY SYNC TEST
# =========================================================================

def test_master_sync_all_government_feeds():
    response = client.post("/api/v1/government/sync-all")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert "data.gov.in" in data["synced_agencies"]
    assert "NHAI" in data["synced_agencies"]
    assert "BRO" in data["synced_agencies"]
    assert "VAHAN" in data["synced_agencies"]
    assert data["details"]["data_gov_in"]["status"] == "SUCCESS"
    assert data["details"]["nhai"]["status"] == "SUCCESS"
    assert data["details"]["bro"]["status"] == "SUCCESS"
    assert data["details"]["vahan"]["status"] == "SUCCESS"
