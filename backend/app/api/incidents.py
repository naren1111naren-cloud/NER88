from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import Incident, Alert, Delivery, AuditLog, Bridge
from app.schemas.schemas import IncidentOut, IncidentCreate
from app.services.accessibility_service import AccessibilityEngine
from app.services.operational_alerts_service import BlockedRoadAlertService

router = APIRouter(prefix="/incidents", tags=["Incidents & Road Blockages"])

@router.get("", response_model=List[IncidentOut])
def get_incidents(db: Session = Depends(get_db)):
    return db.query(Incident).order_by(Incident.created_at.desc()).all()

@router.post("", response_model=IncidentOut)
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    load_restriction = data.pop("load_restriction_type", None)
    inc = Incident(**data)
    db.add(inc)
    db.commit()
    db.refresh(inc)

    # If linked to a bridge or is BRIDGE_DAMAGE, update the Bridge entity directly
    target_bridge = None
    if inc.affected_bridge_id:
        target_bridge = db.query(Bridge).filter(Bridge.id == inc.affected_bridge_id).first()
    elif inc.affected_bridge_code:
        target_bridge = db.query(Bridge).filter(Bridge.bridge_code == inc.affected_bridge_code).first()
    elif inc.incident_type == "BRIDGE_DAMAGE" or "bridge" in (inc.location_name or "").lower():
        target_bridge = db.query(Bridge).filter(
            Bridge.district_name == inc.district_name
        ).first()

    if target_bridge:
        target_bridge.active_incident_id = inc.id
        if inc.road_status in ["BLOCKED", "CLOSED"]:
            target_bridge.status = "CLOSED"
            target_bridge.load_restriction_type = "Closed"
        elif inc.severity in ["HIGH", "CRITICAL"]:
            target_bridge.status = "DAMAGED"
            target_bridge.load_restriction_type = "Heavy Vehicles Restricted"
        elif inc.road_status in ["RESTRICTED", "PARTIAL"]:
            target_bridge.status = "RESTRICTED"
            target_bridge.load_restriction_type = "Reduced Load (Max 20T)"
        target_bridge.condition_description = f"{inc.incident_type}: {inc.description}"
        target_bridge.data_source = "FIELD_REPORT"

    # Trigger Regional Cascade Accessibility Recalculation
    # Passes source_incident so GAP 18 & GAP 19 alert hooks can link alerts to this incident
    AccessibilityEngine.recalculate_all_accessibility(db, source_incident=inc)

    db.add(AuditLog(
        user_email="field_officer@linkx8.in",
        action="REPORT_INCIDENT",
        resource="Incident",
        details=f"Field incident reported: {inc.incident_type} at {inc.location_name} ({inc.severity})"
    ))
    db.commit()
    return inc
