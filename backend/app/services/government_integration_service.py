"""
Government Monitoring Integration Service (SIH Gap 9)
Provides a robust integration layer to receive, validate, normalize, and cascade
authoritative data from NDMA (Sachet), NHAI, Border Roads Organisation (BRO), and State PWDs
directly into LINK X8's Accessibility Engine, Bridge Intelligence, Risk Analysis, and Alert Dispatchers.
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta
import logging
from sqlalchemy.orm import Session

from app.models.models import (
    Incident, Bridge, Corridor, District, Alert, AuditLog, Vehicle
)
from app.schemas.schemas import (
    GovernmentMonitoringRecord,
    GovMonitoringRecordIn,
    GovMonitoringBatchResultOut,
    GovIntegrationStatusOut,
    GovRoadStatusIn,
    GovBridgeStatusIn,
    GovDisasterIncidentIn,
    GovDistrictInfoIn,
    GovTransportInfoIn,
    GovInfrastructureStatusIn
)
from app.services.accessibility_service import AccessibilityEngine

logger = logging.getLogger("link_x8.gov_integration")

class GovernmentIntegrationService:
    """
    Coordinates ingestion from authorized government monitoring systems.
    Prevents duplicates, normalizes multi-agency schema formats, updates core assets,
    recalculates regional accessibility indices, and dispatches high-priority alerts.
    """

    SUPPORTED_AGENCIES = [
        {
            "agency_code": "DATA_GOV_IN_OGD",
            "agency_name": "Open Government Data Platform India (data.gov.in)",
            "monitored_domains": ["MoRTH Highway Logistics", "IMD Flood Bulletins", "Essential Commodity Buffers"],
            "status": "INTEGRATION-READY",
            "auth_type": "API Key / OGD Resource API"
        },
        {
            "agency_code": "NHAI_HIGHWAY_MONITOR",
            "agency_name": "National Highways Authority of India (RAMS / FASTag ATMS)",
            "monitored_domains": ["National Highway Blockages", "Pavement Condition", "Toll Plaza Queue Times"],
            "status": "INTEGRATION-READY",
            "auth_type": "OAuth2 / Webhook / REST"
        },
        {
            "agency_code": "BRO_BRIDGE_COMMAND",
            "agency_name": "Border Roads Organisation (Projects Vartak, Brahmank, Setuk)",
            "monitored_domains": ["Mountain Passes", "Bailey Bridge Load Limits", "Snow & Avalanche Clearance"],
            "status": "INTEGRATION-READY",
            "auth_type": "Mutual TLS / X-Gov-Token"
        },
        {
            "agency_code": "VAHAN_FLEET_REGISTRY",
            "agency_name": "Ministry of Road Transport & Highways (VAHAN 4.0 / National Permits)",
            "monitored_domains": ["Vehicle Registration", "Gross Vehicle Weight (GVW)", "Bridge Load Clearance"],
            "status": "INTEGRATION-READY",
            "auth_type": "API Key / MoRTH Gateway"
        },
        {
            "agency_code": "NDMA_SACHET_PORTAL",
            "agency_name": "National Disaster Management Authority (CAP-Sachet)",
            "monitored_domains": ["Flash Floods", "Landslides", "Cloudbursts", "Seismic Events"],
            "status": "INTEGRATION-READY",
            "auth_type": "HMAC-SHA256 / CAP Webhook"
        },
        {
            "agency_code": "STATE_PWD_NER",
            "agency_name": "State Public Works Departments (NER Regional Infrastructure)",
            "monitored_domains": ["State Highways", "District Arteries", "Culvert Washouts"],
            "status": "INTEGRATION-READY",
            "auth_type": "API Key / Webhook"
        }
    ]

    SUPPORTED_DATA_TYPES = {
        "ROAD_STATUS", "ROAD_CLOSURE",
        "BRIDGE_STATUS", "BRIDGE_RESTRICTION",
        "DISASTER_INCIDENT", "DISASTER_HAZARD",
        "DISTRICT_INFO",
        "TRANSPORT_INFO",
        "INFRASTRUCTURE_STATUS", "INFRASTRUCTURE_ALERT"
    }

    @classmethod
    def validate_record(cls, record: GovernmentMonitoringRecord) -> Tuple[bool, Optional[str], bool]:
        """
        Validates record structure, coordinate bounds, required identifiers, and timestamp freshness.
        Returns: (is_valid, error_message, is_stale)
        """
        source = record.source or record.agency_name
        source_id = record.source_record_id or record.bulletin_code

        if not source or len(source.strip()) == 0:
            return False, "Source agency identifier is required", False

        if not source_id or len(source_id.strip()) == 0:
            return False, "Source record ID / bulletin code is required", False

        if not (-90.0 <= record.latitude <= 90.0) or not (-180.0 <= record.longitude <= 180.0):
            return False, f"Invalid geo coordinates: ({record.latitude}, {record.longitude})", False

        d_type = record.data_type.upper() if record.data_type else "DISASTER_INCIDENT"
        if d_type not in cls.SUPPORTED_DATA_TYPES:
            return False, f"Unsupported data_type: {record.data_type}", False

        is_stale = False
        if record.timestamp is not None:
            now = datetime.utcnow()
            ts = record.timestamp.replace(tzinfo=None) if record.timestamp.tzinfo else record.timestamp
            
            # Future check: > 24 hours in the future
            if ts > now + timedelta(hours=24):
                return False, f"Timestamp is invalid (more than 24 hours in the future: {ts})", False
            
            # Stale check: > 72 hours in the past
            if ts < now - timedelta(hours=72):
                is_stale = True

        return True, None, is_stale

    @classmethod
    def validate_bulletin(cls, record: GovernmentMonitoringRecord):
        """Backward-compatible validation raising ValueError on invalid input."""
        valid, err, _ = cls.validate_record(record)
        if not valid:
            raise ValueError(err)

    @classmethod
    def process_gov_batch(
        cls,
        bulletins: List[GovernmentMonitoringRecord],
        db: Session,
        agency_name: str = "NDMA_SACHET_PORTAL"
    ) -> GovMonitoringBatchResultOut:
        """
        Processes a batch of government monitoring bulletins.
        Applies idempotency, updates bridges/corridors, creates incidents,
        triggers accessibility cascading recalculation, and dispatches alerts.
        """
        total_received = len(bulletins)
        accepted_count = 0
        rejected_count = 0
        duplicate_count = 0
        stale_count = 0

        incidents_created = 0
        bridges_updated = 0
        corridors_affected = 0
        districts_affected = 0
        vehicles_tracked = 0
        alerts_dispatched = 0
        rejected_items = []

        for b in bulletins:
            source = b.source or b.agency_name or agency_name
            source_id = b.source_record_id or b.bulletin_code or ""

            is_valid, error_msg, is_stale = cls.validate_record(b)
            if not is_valid:
                rejected_count += 1
                rejected_items.append({
                    "source": source,
                    "source_record_id": source_id,
                    "error": error_msg
                })
                continue

            if is_stale:
                stale_count += 1

            # Idempotency check via source + source_record_id
            search_token = f"[{source} - {source_id}]"
            existing_inc = db.query(Incident).filter(
                (Incident.description.like(f"%{search_token}%")) |
                (Incident.description.like(f"%{source_id}%") if len(source_id) > 4 else False)
            ).first()

            if existing_inc:
                logger.info(f"Duplicate government bulletin skipped: {source_id}")
                duplicate_count += 1
                accepted_count += 1
                continue

            try:
                d_type = b.data_type.upper() if b.data_type else "DISASTER_INCIDENT"
                status_str = (b.status or b.road_status or "BLOCKED").upper()
                severity_str = (b.severity or "HIGH").upper()

                affected_bridge_id = None
                affected_bridge_code = b.affected_bridge_code

                # 1. BRIDGE_STATUS / BRIDGE_RESTRICTION
                if d_type in ["BRIDGE_STATUS", "BRIDGE_RESTRICTION"] or affected_bridge_code:
                    bridge_target = affected_bridge_code
                    if bridge_target:
                        bridge = db.query(Bridge).filter(
                            (Bridge.bridge_code == bridge_target) |
                            (Bridge.name.ilike(f"%{bridge_target}%"))
                        ).first()
                        if bridge:
                            affected_bridge_id = bridge.id
                            if b.bridge_load_limit_tons is not None:
                                bridge.load_capacity_tons = b.bridge_load_limit_tons
                                bridge.load_restriction_type = f"Gov Limit: {b.bridge_load_limit_tons}T"
                            if status_str in ["BLOCKED", "CLOSED"]:
                                bridge.status = "CLOSED_FLOOD" if "flood" in b.description.lower() else "RESTRICTED"
                                bridge.accessibility_score = max(5.0, bridge.accessibility_score - 50.0)
                            elif status_str == "RESTRICTED":
                                bridge.status = "RESTRICTED"
                                bridge.accessibility_score = max(20.0, bridge.accessibility_score - 30.0)
                            bridges_updated += 1

                # 2. ROAD_STATUS / ROAD_CLOSURE
                if d_type in ["ROAD_STATUS", "ROAD_CLOSURE"] or b.affected_corridor_code:
                    corridor_target = b.affected_corridor_code
                    if corridor_target:
                        corridor = db.query(Corridor).filter(
                            Corridor.corridor_code == corridor_target
                        ).first()
                        if corridor:
                            if status_str in ["BLOCKED", "CLOSED"]:
                                corridor.status = "BLOCKED" if status_str == "BLOCKED" else "RESTRICTED"
                                corridor.current_condition = b.description[:120]
                                corridor.accessibility_score = max(10.0, corridor.accessibility_score - 40.0)
                            elif status_str == "RESTRICTED":
                                corridor.status = "RESTRICTED"
                                corridor.accessibility_score = max(30.0, corridor.accessibility_score - 25.0)
                            corridors_affected += 1

                # 3. DISTRICT_INFO
                if d_type == "DISTRICT_INFO" and b.district_name:
                    district = db.query(District).filter(
                        District.name.ilike(f"%{b.district_name}%")
                    ).first()
                    if district:
                        if status_str in ["BLOCKED", "SEVERELY_ISOLATED"]:
                            district.accessibility_index = max(15.0, district.accessibility_index - 35.0)
                        districts_affected += 1

                # 4. TRANSPORT_INFO
                if d_type == "TRANSPORT_INFO":
                    vehicles_tracked += 1
                    if b.transport_vehicle_code:
                        veh = db.query(Vehicle).filter(Vehicle.vehicle_code == b.transport_vehicle_code).first()
                        if veh:
                            veh.current_lat = b.latitude
                            veh.current_lng = b.longitude
                            veh.last_ping = datetime.utcnow()

                # 5. Create Official Incident Record
                if d_type in ["DISASTER_INCIDENT", "DISASTER_HAZARD", "ROAD_STATUS", "ROAD_CLOSURE", "BRIDGE_STATUS", "BRIDGE_RESTRICTION", "INFRASTRUCTURE_STATUS", "INFRASTRUCTURE_ALERT"]:
                    inc_type = "LANDSLIDE" if "landslide" in b.description.lower() else (
                        "FLOOD" if "flood" in b.description.lower() else (
                            "BRIDGE_DAMAGE" if affected_bridge_code else (
                                "INFRASTRUCTURE_HAZARD" if "infra" in d_type.lower() else "ROAD_BLOCK"
                            )
                        )
                    )

                    stale_tag = " [STALE FEED]" if is_stale else ""
                    incident = Incident(
                        incident_type=inc_type,
                        description=f"[{source} - {source_id}]{stale_tag} {b.description}",
                        latitude=b.latitude,
                        longitude=b.longitude,
                        location_name=b.location_name,
                        district_name=b.district_name or "Northeast Region",
                        affected_bridge_id=affected_bridge_id,
                        affected_bridge_code=affected_bridge_code,
                        severity=severity_str,
                        road_status=status_str if status_str in ["OPEN", "RESTRICTED", "BLOCKED", "CLOSED"] else "RESTRICTED",
                        reporter_name=f"Official Feed ({source})",
                        is_synced=True,
                        created_at=datetime.utcnow()
                    )
                    db.add(incident)
                    db.flush()
                    incidents_created += 1

                # 6. Dispatch Official High-Priority Alert if severe
                if severity_str in ["CRITICAL", "HIGH"] or status_str in ["BLOCKED", "CLOSED"]:
                    alert = Alert(
                        alert_type="GOVERNMENT_OPERATIONAL_BULLETIN",
                        title=f"GOV ALERT ({source}): {b.location_name}",
                        message=f"Official Bulletin {source_id}: {b.description}. Operational Status: {status_str}.",
                        severity="CRITICAL" if severity_str == "CRITICAL" else "HIGH",
                        location=b.location_name,
                        recommended_action=f"Refer to {source} advisory. Dynamic routing active across NER corridors.",
                        is_read=False,
                        created_at=datetime.utcnow()
                    )
                    db.add(alert)
                    alerts_dispatched += 1

                accepted_count += 1

            except Exception as e:
                logger.error(f"Error processing gov bulletin {source_id}: {str(e)}")
                rejected_count += 1
                rejected_items.append({
                    "source": source,
                    "source_record_id": source_id,
                    "error": str(e)
                })

        # Cascading accessibility recalculation
        AccessibilityEngine.recalculate_all_accessibility(db)

        # Audit Log
        audit = AuditLog(
            user_email="gov-bridge@linkx8.gov.in",
            action="GOVERNMENT_DATA_SYNC",
            resource="GovernmentIntegrationService",
            details=f"Agency: {agency_name}, Received: {total_received}, Accepted: {accepted_count}, Rejected: {rejected_count}, Duplicates: {duplicate_count}, Incidents: {incidents_created}, Bridges: {bridges_updated}, Corridors: {corridors_affected}"
        )
        db.add(audit)
        db.commit()

        overall_status = "SUCCESS" if rejected_count == 0 else ("PARTIAL_SUCCESS" if accepted_count > 0 else "FAILED")
        message = (
            f"Processed {accepted_count}/{total_received} bulletins from {agency_name}. "
            f"Accepted: {accepted_count}, Rejected: {rejected_count}, Duplicates: {duplicate_count}, Stale: {stale_count}."
        )

        return GovMonitoringBatchResultOut(
            received=total_received,
            accepted=accepted_count,
            rejected=rejected_count,
            duplicates=duplicate_count,
            stale_records=stale_count,
            incidents_created=incidents_created,
            bridges_updated=bridges_updated,
            corridors_affected=corridors_affected,
            districts_affected=districts_affected,
            vehicles_tracked=vehicles_tracked,
            accessibility_recalculated=True,
            alerts_dispatched=alerts_dispatched,
            status=overall_status,
            message=message,
            rejected_items=rejected_items
        )

    @classmethod
    def ingest_single_record(
        cls,
        record: GovernmentMonitoringRecord,
        db: Session
    ) -> GovMonitoringBatchResultOut:
        """Ingests a single normalized government record."""
        return cls.process_gov_batch(
            bulletins=[record],
            db=db,
            agency_name=record.source or record.agency_name or "NDMA_SACHET_PORTAL"
        )

    @classmethod
    def get_integration_status(cls, db: Session) -> GovIntegrationStatusOut:
        """Returns the readiness status of government monitoring feeds."""
        gov_incidents_count = db.query(Incident).filter(Incident.reporter_name.like("Official Feed%")).count()
        last_incident = db.query(Incident).filter(Incident.reporter_name.like("Official Feed%")).order_by(Incident.created_at.desc()).first()

        return GovIntegrationStatusOut(
            integration_mode="INTEGRATION-READY",
            connected_agencies=cls.SUPPORTED_AGENCIES,
            total_bulletins_processed=gov_incidents_count,
            last_event_timestamp=last_incident.created_at if last_incident else None,
            api_health="MONITORING_STANDBY",
            security_auth_mode="HEADER_TOKEN_OR_HMAC",
            supported_data_contracts=[
                "ROAD_STATUS",
                "BRIDGE_STATUS",
                "DISASTER_INCIDENT",
                "DISTRICT_INFO",
                "TRANSPORT_INFO",
                "INFRASTRUCTURE_STATUS"
            ]
        )

    @classmethod
    def sync_all_government_feeds(cls, db: Session) -> Dict[str, Any]:
        """
        Executes a consolidated, master synchronization of all integrated government feeds:
        - Data.gov.in (MoRTH Highway Logistics & IMD hydro-meteorology)
        - NHAI (Corridor RAMS & FASTag Toll Plazas)
        - BRO (Mountain Passes & Strategic Bridges)
        - VAHAN (National Fleet Registry)
        """
        from app.services.data_gov_service import DataGovInService, DATA_GOV_CATALOGS
        from app.services.nhai_service import NHAIService
        from app.services.bro_service import BROService
        from app.services.vahan_service import VAHANService

        results = {}

        # 1. Data.gov.in sync
        try:
            res_id = DATA_GOV_CATALOGS[0]["resource_id"]
            results["data_gov_in"] = DataGovInService.sync_to_platform(res_id, db)
        except Exception as e:
            results["data_gov_in"] = {"status": "ERROR", "error": str(e)}

        # 2. NHAI RAMS sync
        try:
            results["nhai"] = NHAIService.sync_nhai_telemetry(db)
        except Exception as e:
            results["nhai"] = {"status": "ERROR", "error": str(e)}

        # 3. BRO Command sync
        try:
            results["bro"] = BROService.sync_bro_intelligence(db)
        except Exception as e:
            results["bro"] = {"status": "ERROR", "error": str(e)}

        # 4. VAHAN Fleet Registry sync
        try:
            results["vahan"] = VAHANService.sync_registered_fleet(db)
        except Exception as e:
            results["vahan"] = {"status": "ERROR", "error": str(e)}

        return {
            "status": "SUCCESS",
            "message": "Master synchronization completed across Data.gov.in, NHAI, BRO, and VAHAN feeds.",
            "synced_agencies": ["data.gov.in", "NHAI", "BRO", "VAHAN"],
            "details": results,
            "timestamp": datetime.utcnow().isoformat()
        }
