from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import FieldReport, Incident, Alert, Delivery, AuditLog, Bridge
from app.schemas.schemas import SyncBatchRequest
from app.services.accessibility_service import AccessibilityEngine

router = APIRouter(prefix="/field-reports", tags=["Offline Field Reporting & Sync"])

@router.get("")
def get_field_reports(db: Session = Depends(get_db)):
    return db.query(FieldReport).order_by(FieldReport.reported_at.desc()).all()

@router.post("/sync")
def sync_field_reports(payload: SyncBatchRequest, db: Session = Depends(get_db)):
    """
    Offline Synchronization Endpoint:
    Receives batched field incident reports collected offline by field officers.
    Performs coordinate validation, idempotent upsert to prevent duplicates upon network retry,
    associates bridge damage, triggers operational alerts, and cascades accessibility recalculation.
    """
    synced_count = 0
    for r in payload.reports:
        # Validate coordinate boundaries
        if not (-90.0 <= r.latitude <= 90.0):
            raise HTTPException(status_code=422, detail=f"Invalid field report latitude {r.latitude}: must be in [-90, 90]")
        if not (-180.0 <= r.longitude <= 180.0):
            raise HTTPException(status_code=422, detail=f"Invalid field report longitude {r.longitude}: must be in [-180, 180]")

        # Upsert field report (Idempotent deduplication via report_code)
        fr = db.query(FieldReport).filter(FieldReport.report_code == r.report_code).first()
        is_new = fr is None

        if is_new:
            fr = FieldReport(
                report_code=r.report_code,
                incident_type=r.incident_type,
                description=r.description,
                latitude=r.latitude,
                longitude=r.longitude,
                location_name=r.location_name,
                district_name=r.district_name,
                affected_bridge_id=r.affected_bridge_id,
                affected_bridge_code=r.affected_bridge_code,
                severity=r.severity,
                road_status=r.road_status,
                photo_url=r.photo_url,
                sync_status="SYNCED"
            )
            db.add(fr)

            # Convert field report to active map incident
            inc = Incident(
                incident_type=r.incident_type,
                description=f"[{r.report_code}] {r.description}",
                latitude=r.latitude,
                longitude=r.longitude,
                location_name=r.location_name,
                district_name=r.district_name,
                affected_bridge_id=r.affected_bridge_id,
                affected_bridge_code=r.affected_bridge_code,
                severity=r.severity,
                road_status=r.road_status,
                reporter_name="Field Officer (Offline Sync)",
                is_synced=True,
                photo_url=r.photo_url
            )
            db.add(inc)
            db.flush()

            if r.road_status == "BLOCKED" or r.severity in ["HIGH", "CRITICAL"]:
                alert = Alert(
                    alert_type="OFFLINE_SYNC_INCIDENT",
                    title=f"🚨 OFFLINE REPORT SYNCED: {r.incident_type.upper()} AT {r.location_name.upper()}",
                    message=f"Synced field report: {r.description}. Severity: {r.severity}. Road Status: {r.road_status}.",
                    severity=r.severity,
                    location=r.location_name,
                    recommended_action="Assess corridor passability and notify dispatchers.",
                    is_read=False,
                    status="NEW"
                )
                db.add(alert)
                db.flush()
                # Broadcast real-time SSE alert event to dispatchers
                from app.services.alert_delivery_service import AlertDeliveryService
                AlertDeliveryService.publish_alert_event("NEW_ALERT", {
                    "id": alert.id,
                    "alert_type": alert.alert_type,
                    "title": alert.title,
                    "message": alert.message,
                    "severity": alert.severity,
                    "location": alert.location,
                    "recommended_action": alert.recommended_action,
                    "delivery_id": None,
                    "vehicle_id": None,
                    "is_read": False,
                    "status": "NEW",
                    "acknowledged_at": None,
                    "acknowledged_by": None,
                    "created_at": alert.created_at.isoformat() if alert.created_at else ""
                })
        else:
            # Idempotent retry: update existing report record
            fr.incident_type = r.incident_type
            fr.description = r.description
            fr.latitude = r.latitude
            fr.longitude = r.longitude
            fr.location_name = r.location_name
            fr.district_name = r.district_name
            fr.affected_bridge_id = r.affected_bridge_id
            fr.affected_bridge_code = r.affected_bridge_code
            fr.severity = r.severity
            fr.road_status = r.road_status
            fr.sync_status = "SYNCED"

        # Update Bridge if affected (runs on both initial sync and re-sync)
        target_bridge = None
        if r.affected_bridge_id:
            target_bridge = db.query(Bridge).filter(Bridge.id == r.affected_bridge_id).first()
        elif r.affected_bridge_code:
            target_bridge = db.query(Bridge).filter(Bridge.bridge_code == r.affected_bridge_code).first()
        elif r.incident_type == "BRIDGE_DAMAGE":
            target_bridge = db.query(Bridge).filter(Bridge.district_name == r.district_name).first()

        if target_bridge:
            if r.road_status in ["BLOCKED", "CLOSED"]:
                target_bridge.status = "CLOSED"
                target_bridge.load_restriction_type = "Closed"
            elif r.severity in ["HIGH", "CRITICAL"]:
                target_bridge.status = "DAMAGED"
                target_bridge.load_restriction_type = "Heavy Vehicles Restricted"
            elif r.road_status in ["RESTRICTED", "PARTIAL"]:
                target_bridge.status = "RESTRICTED"
                target_bridge.load_restriction_type = "Reduced Load (Max 20T)"
            target_bridge.condition_description = f"{r.incident_type}: {r.description}"
            target_bridge.data_source = "FIELD_REPORT"

        synced_count += 1

    # Cascade recalculation of roads, bridges, districts, transport
    # Passes the most recent incident as source for GAP 18 & 19 alert hooks
    last_incident = None
    try:
        last_incident = db.query(Incident).order_by(Incident.created_at.desc()).first()
    except Exception:
        pass
    AccessibilityEngine.recalculate_all_accessibility(db, source_incident=last_incident)

    db.add(AuditLog(
        user_email="field_officer@linkx8.in",
        action="SYNC_FIELD_REPORTS",
        resource="FieldReport",
        details=f"Synchronized {synced_count} offline field reports to central GIS intelligence server"
    ))
    db.commit()

    return {
        "status": "SUCCESS",
        "synced_count": synced_count,
        "message": f"Successfully synchronized {synced_count} field report(s) to central database."
    }
