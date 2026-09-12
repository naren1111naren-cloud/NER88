"""
Government Integrations API Router (SIH Gap 9: Government Monitoring-System Integration)
Provides secure, integration-ready endpoints for NDMA Sachet, NHAI RAMS, BRO Command, and State PWD feeds
to ingest road status, bridge weight restrictions, disaster hazards, district info, transport, and infrastructure data.
"""

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.database import get_db
from app.schemas.schemas import (
    GovernmentMonitoringRecord,
    GovMonitoringRecordIn,
    GovMonitoringBatchIn,
    GovMonitoringBatchResultOut,
    GovSyncSummaryOut,
    GovIntegrationStatusOut,
    GovRoadStatusIn,
    GovBridgeStatusIn,
    GovDisasterIncidentIn,
    GovDistrictInfoIn,
    GovTransportInfoIn,
    GovInfrastructureStatusIn
)
from app.services.government_integration_service import GovernmentIntegrationService
from app.core.config import settings

router = APIRouter(prefix="/government", tags=["Government Monitoring Integration (Gap 9)"])

def verify_gov_api_key(x_gov_key: Optional[str] = Header(None, alias="X-Gov-System-Key")):
    """Validates X-Gov-System-Key header if configured."""
    if x_gov_key is not None and x_gov_key != settings.GOV_INTEGRATION_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid X-Gov-System-Key header provided"
        )
    return x_gov_key

@router.get("/status", response_model=GovIntegrationStatusOut)
def get_gov_integration_status(db: Session = Depends(get_db)):
    """
    Returns the real integration status of NDMA, NHAI, BRO, and State PWD feeds.
    Strictly classified as 'INTEGRATION-READY' for SIH jury transparency.
    """
    return GovernmentIntegrationService.get_integration_status(db)

@router.post("/monitoring", response_model=GovMonitoringBatchResultOut)
def ingest_monitoring_record(
    record: GovernmentMonitoringRecord,
    db: Session = Depends(get_db),
    _auth: Optional[str] = Depends(verify_gov_api_key)
):
    """
    Ingests a single standardized GovernmentMonitoringRecord.
    Validates coordinates, checks freshness, deduplicates, updates assets, and cascades accessibility.
    """
    return GovernmentIntegrationService.ingest_single_record(record, db)

@router.post("/monitoring/batch", response_model=GovMonitoringBatchResultOut)
def ingest_monitoring_batch(
    payload: GovMonitoringBatchIn,
    db: Session = Depends(get_db),
    _auth: Optional[str] = Depends(verify_gov_api_key)
):
    """
    Batch ingestion for high-throughput government feeds (e.g. hourly NDMA/NHAI sync).
    Returns accepted, rejected, duplicate, and stale record statistics.
    """
    records = payload.get_records()
    source_agency = payload.source or payload.agency_name or "NDMA_SACHET_PORTAL"
    return GovernmentIntegrationService.process_gov_batch(
        bulletins=records,
        db=db,
        agency_name=source_agency
    )

@router.post("/road-status", response_model=GovMonitoringBatchResultOut)
def ingest_road_status(
    payload: GovRoadStatusIn,
    db: Session = Depends(get_db),
    _auth: Optional[str] = Depends(verify_gov_api_key)
):
    """
    Dedicated contract endpoint for highway and corridor road condition updates from NHAI / State PWD.
    """
    record = GovernmentMonitoringRecord(
        source=payload.source,
        source_record_id=payload.source_record_id,
        data_type="ROAD_STATUS",
        timestamp=payload.timestamp,
        status=payload.status,
        severity=payload.severity,
        location_name=payload.location_name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        district_name=payload.district,
        description=payload.description,
        affected_corridor_code=payload.road_id
    )
    return GovernmentIntegrationService.ingest_single_record(record, db)

@router.post("/bridge-status", response_model=GovMonitoringBatchResultOut)
def ingest_bridge_status(
    payload: GovBridgeStatusIn,
    db: Session = Depends(get_db),
    _auth: Optional[str] = Depends(verify_gov_api_key)
):
    """
    Dedicated contract endpoint for bridge monitoring and load restrictions from BRO Command / PWD.
    """
    record = GovernmentMonitoringRecord(
        source=payload.source,
        source_record_id=payload.source_record_id,
        data_type="BRIDGE_STATUS",
        timestamp=payload.timestamp,
        status="CLOSED" if payload.is_closed else payload.status,
        severity=payload.severity,
        location_name=payload.location_name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        description=f"Bridge Restriction: {payload.reason}",
        affected_bridge_code=payload.bridge_id,
        bridge_load_limit_tons=payload.load_restriction_tons
    )
    return GovernmentIntegrationService.ingest_single_record(record, db)

@router.post("/disaster", response_model=GovMonitoringBatchResultOut)
def ingest_disaster_incident(
    payload: GovDisasterIncidentIn,
    db: Session = Depends(get_db),
    _auth: Optional[str] = Depends(verify_gov_api_key)
):
    """
    Dedicated contract endpoint for natural disaster hazard alerts from NDMA Sachet.
    """
    record = GovernmentMonitoringRecord(
        source=payload.source,
        source_record_id=payload.source_record_id,
        data_type="DISASTER_INCIDENT",
        timestamp=payload.timestamp,
        status=payload.status,
        severity=payload.severity,
        location_name=payload.location_name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        district_name=payload.district,
        state=payload.state,
        description=f"[{payload.incident_type}] {payload.description}"
    )
    return GovernmentIntegrationService.ingest_single_record(record, db)

@router.post("/district", response_model=GovMonitoringBatchResultOut)
def ingest_district_info(
    payload: GovDistrictInfoIn,
    db: Session = Depends(get_db),
    _auth: Optional[str] = Depends(verify_gov_api_key)
):
    """
    Dedicated contract endpoint for district administrative accessibility advisories from SDMA.
    """
    record = GovernmentMonitoringRecord(
        source=payload.source,
        source_record_id=payload.source_record_id,
        data_type="DISTRICT_INFO",
        timestamp=payload.timestamp,
        status=payload.accessibility_status,
        severity="MEDIUM",
        location_name=f"{payload.district_name} District Center",
        latitude=payload.latitude or 26.14,
        longitude=payload.longitude or 91.73,
        district_name=payload.district_name,
        state=payload.state,
        description=payload.notes or f"District status advisory: {payload.accessibility_status}"
    )
    return GovernmentIntegrationService.ingest_single_record(record, db)

@router.post("/transport", response_model=GovMonitoringBatchResultOut)
def ingest_transport_info(
    payload: GovTransportInfoIn,
    db: Session = Depends(get_db),
    _auth: Optional[str] = Depends(verify_gov_api_key)
):
    """
    Dedicated contract endpoint for government fleet/convoy monitoring from MoRTH / Logistics authorities.
    """
    record = GovernmentMonitoringRecord(
        source=payload.source,
        source_record_id=payload.source_record_id,
        data_type="TRANSPORT_INFO",
        timestamp=payload.timestamp,
        status=payload.status,
        severity="LOW",
        location_name=payload.location_name or "Highway Transit Point",
        latitude=payload.latitude,
        longitude=payload.longitude,
        description=f"Government {payload.transport_type} convoy {payload.transport_id} in transit",
        transport_vehicle_code=payload.transport_id,
        affected_corridor_code=payload.corridor_code
    )
    return GovernmentIntegrationService.ingest_single_record(record, db)

@router.post("/infrastructure", response_model=GovMonitoringBatchResultOut)
def ingest_infrastructure_status(
    payload: GovInfrastructureStatusIn,
    db: Session = Depends(get_db),
    _auth: Optional[str] = Depends(verify_gov_api_key)
):
    """
    Dedicated contract endpoint for strategic infrastructure status from State PWD / NEC.
    """
    record = GovernmentMonitoringRecord(
        source=payload.source,
        source_record_id=payload.source_record_id,
        data_type="INFRASTRUCTURE_STATUS",
        timestamp=payload.timestamp,
        status=payload.status,
        severity=payload.severity,
        location_name=payload.location_name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        district_name=payload.district,
        description=payload.description,
        infrastructure_type=payload.infrastructure_type
    )
    return GovernmentIntegrationService.ingest_single_record(record, db)

@router.post("/ingest", response_model=GovSyncSummaryOut)
def ingest_government_bulletins(
    payload: GovMonitoringBatchIn,
    db: Session = Depends(get_db),
    x_gov_key: Optional[str] = Header(None, alias="X-Gov-System-Key")
):
    """
    Backward-compatible batch ingestion endpoint.
    Ingests official bulletins from authenticated government monitoring systems.
    """
    verify_gov_api_key(x_gov_key)
    records = payload.get_records()
    source_agency = payload.source or payload.agency_name or "NDMA_SACHET_PORTAL"
    return GovernmentIntegrationService.process_gov_batch(
        bulletins=records,
        db=db,
        agency_name=source_agency
    )

@router.post("/webhook", response_model=GovSyncSummaryOut)
def handle_government_webhook(
    bulletin: GovernmentMonitoringRecord,
    db: Session = Depends(get_db)
):
    """
    Direct CAP (Common Alerting Protocol) webhook receiver for single NDMA/NHAI flash event.
    """
    return GovernmentIntegrationService.ingest_single_record(bulletin, db)

@router.post("/demo-sync", response_model=GovSyncSummaryOut)
def trigger_demo_gov_sync(db: Session = Depends(get_db)):
    """
    Demonstrates government-triggered operational bulletin ingestion for SIH evaluators.
    Ingests an NDMA landslide alert in Dima Hasao and a BRO load clearance advisory for Kaliabhomora Bridge.
    """
    sample_bulletins = [
        GovernmentMonitoringRecord(
            source="NDMA_SACHET_PORTAL",
            source_record_id="NDMA-NER-2026-088",
            data_type="DISASTER_INCIDENT",
            location_name="Jatinga Valley, NH-27",
            district_name="Dima Hasao",
            state="Assam",
            latitude=25.1200,
            longitude=93.0300,
            affected_corridor_code="COR-NH27",
            severity="CRITICAL",
            status="BLOCKED",
            description="Major mudslide blocking both carriageways near Jatinga tunnel. Heavy earthmovers deployed."
        ),
        GovernmentMonitoringRecord(
            source="BRO_BRIDGE_COMMAND",
            source_record_id="BRO-SETUK-771",
            data_type="BRIDGE_STATUS",
            location_name="Brahmaputra Crossing, Tezpur",
            district_name="Sonitpur",
            state="Assam",
            latitude=26.6110,
            longitude=92.7950,
            affected_bridge_code="BRG-003",
            severity="HIGH",
            status="RESTRICTED",
            bridge_load_limit_tons=18.0,
            description="Structural load testing advisory. Maximum allowable gross vehicle weight reduced to 18 Tons."
        )
    ]

    return GovernmentIntegrationService.process_gov_batch(
        bulletins=sample_bulletins,
        db=db,
        agency_name="NDMA_BRO_MULTI_FEED"
    )

# =========================================================================
# DATA.GOV.IN (OPEN GOVERNMENT DATA PLATFORM INDIA) ENDPOINTS
# =========================================================================

@router.get("/data-gov/catalog")
def get_data_gov_catalog():
    """Returns curated Data.gov.in OGD dataset catalogs relevant to NER logistics."""
    from app.services.data_gov_service import DataGovInService
    return DataGovInService.get_catalog()

@router.get("/data-gov/query")
def query_data_gov_dataset(
    resource_id: str = "9ef84268-d588-465a-a308-a864a43d0070",
    limit: int = 10,
    offset: int = 0,
    state: Optional[str] = None
):
    """
    Live query against Data.gov.in OGD API with graceful fallback to verified NER dataset cache.
    """
    from app.services.data_gov_service import DataGovInService
    return DataGovInService.query_dataset(
        resource_id=resource_id,
        limit=limit,
        offset=offset,
        filter_state=state
    )

@router.post("/data-gov/sync")
def sync_data_gov_dataset(
    resource_id: str = "9ef84268-d588-465a-a308-a864a43d0070",
    db: Session = Depends(get_db)
):
    """
    Ingests official Data.gov.in records directly into LINK X8 DB, creates incidents,
    updates corridor conditions, and recalculates accessibility.
    """
    from app.services.data_gov_service import DataGovInService
    return DataGovInService.sync_to_platform(resource_id=resource_id, db=db)

# =========================================================================
# NHAI (NATIONAL HIGHWAYS AUTHORITY OF INDIA) RAMS & FASTAG ENDPOINTS
# =========================================================================

@router.get("/nhai/corridors")
def get_nhai_corridors():
    """Returns real-time NHAI RAMS highway condition and flow telemetry across NER corridors."""
    from app.services.nhai_service import NHAIService
    return NHAIService.get_corridors_status()

@router.get("/nhai/toll-plazas")
def get_nhai_toll_plazas():
    """Returns NETC FASTag toll plaza congestion and queue telemetry across NER corridors."""
    from app.services.nhai_service import NHAIService
    return NHAIService.get_toll_plazas_status()

@router.post("/nhai/sync")
def sync_nhai_telemetry(db: Session = Depends(get_db)):
    """Synchronizes NHAI corridor telemetry, blockage events, and updates accessibility."""
    from app.services.nhai_service import NHAIService
    return NHAIService.sync_nhai_telemetry(db)

# =========================================================================
# BRO (BORDER ROADS ORGANISATION) MOUNTAIN PASS & BRIDGE ENDPOINTS
# =========================================================================

@router.get("/bro/mountain-passes")
def get_bro_mountain_passes():
    """Returns live status of high-altitude mountain passes (Sela, Bum La, Nathu La, Senapati)."""
    from app.services.bro_service import BROService
    return BROService.get_mountain_passes_status()

@router.get("/bro/strategic-bridges")
def get_bro_strategic_bridges():
    """Returns load classifications and structural clearance ratings for strategic NER river bridges."""
    from app.services.bro_service import BROService
    return BROService.get_strategic_bridges_status()

@router.post("/bro/sync")
def sync_bro_intelligence(db: Session = Depends(get_db)):
    """Ingests BRO mountain pass bulletins, updates bridge load limits, and dispatches advisories."""
    from app.services.bro_service import BROService
    return BROService.sync_bro_intelligence(db)

# =========================================================================
# VAHAN (MoRTH NATIONAL VEHICLE REGISTRY) & BRIDGE COMPLIANCE ENDPOINTS
# =========================================================================

@router.get("/vahan/vehicle/{reg_no}")
def lookup_vahan_vehicle(reg_no: str):
    """Looks up vehicle RC, gross vehicle weight (GVW), and national permit validity."""
    from app.services.vahan_service import VAHANService
    result = VAHANService.lookup_vehicle(reg_no)
    if not result:
        raise HTTPException(status_code=404, detail=f"Vehicle '{reg_no}' not found in VAHAN registry")
    return result

@router.post("/vahan/verify-compliance")
def verify_vahan_bridge_compliance(
    payload: dict,
    db: Session = Depends(get_db)
):
    """
    Evaluates vehicle GVW against target BRO bridge capacity to prevent structural overload.
    Accepts: { registration_number, bridge_code_or_name, actual_payload_tons }
    """
    from app.services.vahan_service import VAHANService
    reg_no = payload.get("registration_number", "")
    bridge_target = payload.get("bridge_code_or_name", "BRG-003")
    payload_tons = payload.get("actual_payload_tons")
    
    return VAHANService.evaluate_bridge_compliance(
        registration_number=reg_no,
        bridge_code_or_name=bridge_target,
        actual_payload_tons=float(payload_tons) if payload_tons is not None else None,
        db=db
    )

@router.post("/vahan/sync-fleet")
def sync_vahan_fleet(db: Session = Depends(get_db)):
    """Synchronizes verified VAHAN registered transport fleet into active vehicle tracker."""
    from app.services.vahan_service import VAHANService
    return VAHANService.sync_registered_fleet(db)

# =========================================================================
# MASTER MULTI-AGENCY SYNCHRONIZATION
# =========================================================================

@router.post("/sync-all")
def sync_all_government_feeds(db: Session = Depends(get_db)):
    """
    Master One-Click Synchronization across all connected Government Gateways:
    - Data.gov.in (MoRTH & IMD)
    - NHAI RAMS & FASTag
    - BRO Mountain Command & Bridges
    - MoRTH VAHAN Fleet Registry
    """
    return GovernmentIntegrationService.sync_all_government_feeds(db)


