from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.security import get_current_active_user
from app.models.models import Bridge, Corridor, Incident, Alert, AuditLog, User
from app.schemas.schemas import BridgeOut, BridgeStatusUpdate, BridgeImpactOut, BridgeLoadValidationRequest, BridgeLoadValidationOut
from app.services.accessibility_service import AccessibilityEngine

router = APIRouter(prefix="/bridges", tags=["Bridge Accessibility Intelligence"])

@router.get("", response_model=List[BridgeOut])
def get_all_bridges(
    status: Optional[str] = Query(None, description="Filter by bridge status (OPERATIONAL, RESTRICTED, DAMAGED, CLOSED, UNKNOWN)"),
    corridor: Optional[str] = Query(None, description="Filter by corridor code"),
    district: Optional[str] = Query(None, description="Filter by district name"),
    db: Session = Depends(get_db)
):
    """Retrieves all monitored strategic bridges with accessibility scores, load restrictions, and risk levels."""
    query = db.query(Bridge)
    if status:
        query = query.filter(Bridge.status == status.upper())
    if corridor:
        query = query.filter(Bridge.corridor_code == corridor.upper())
    if district:
        query = query.filter(Bridge.district_name.ilike(f"%{district}%"))

    bridges = query.order_by(Bridge.accessibility_score.asc()).all()
    for b in bridges:
        AccessibilityEngine.recalculate_bridge_accessibility(b, db)
    db.commit()
    return bridges

@router.post("/validate-load", response_model=BridgeLoadValidationOut)
def validate_load_clearance(
    payload: BridgeLoadValidationRequest,
    db: Session = Depends(get_db)
):
    """
    Evaluates whether a shipment or vehicle weight is cleared to pass over a specific bridge.
    Checks physical load capacity, active structural restrictions, and bridge status.
    """
    if payload.bridge_id:
        bridge = db.query(Bridge).filter(Bridge.id == payload.bridge_id).first()
    elif payload.bridge_code:
        bridge = db.query(Bridge).filter(Bridge.bridge_code == payload.bridge_code).first()
    else:
        raise HTTPException(status_code=400, detail="Either bridge_id or bridge_code must be provided")

    if not bridge:
        raise HTTPException(status_code=404, detail="Bridge not found")

    return AccessibilityEngine.validate_bridge_load_clearance(
        bridge=bridge,
        vehicle_weight_tons=payload.vehicle_weight_tons,
        vehicle_type=payload.vehicle_type
    )

@router.get("/{bridge_id}", response_model=BridgeOut)
def get_bridge_by_id(bridge_id: int, db: Session = Depends(get_db)):
    """Retrieves detailed operational profile for a single bridge."""
    b = db.query(Bridge).filter(Bridge.id == bridge_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bridge not found")
    AccessibilityEngine.recalculate_bridge_accessibility(b, db)
    db.commit()
    return b

@router.post("/{bridge_id}/validate-load", response_model=BridgeLoadValidationOut)
def validate_load_for_bridge_id(
    bridge_id: int,
    payload: BridgeLoadValidationRequest,
    db: Session = Depends(get_db)
):
    """Evaluates whether vehicle load exceeds capacity or restriction for a specific bridge ID."""
    bridge = db.query(Bridge).filter(Bridge.id == bridge_id).first()
    if not bridge:
        raise HTTPException(status_code=404, detail="Bridge not found")

    return AccessibilityEngine.validate_bridge_load_clearance(
        bridge=bridge,
        vehicle_weight_tons=payload.vehicle_weight_tons,
        vehicle_type=payload.vehicle_type
    )

@router.get("/{bridge_id}/accessibility")
def get_bridge_accessibility_details(bridge_id: int, db: Session = Depends(get_db)):
    """Returns accessibility score, risk breakdown, and active hazard factors for a bridge."""
    b = db.query(Bridge).filter(Bridge.id == bridge_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bridge not found")
    
    calc = AccessibilityEngine.recalculate_bridge_accessibility(b, db)
    return {
        "bridge_id": b.id,
        "bridge_code": b.bridge_code,
        "name": b.name,
        "river_name": b.river_name,
        "status": b.status,
        "load_restriction_type": b.load_restriction_type,
        "load_capacity_tons": b.load_capacity_tons,
        "accessibility_score": b.accessibility_score,
        "risk_level": b.risk_level,
        "reason": b.condition_description,
        "is_verified": b.is_verified,
        "data_source": b.data_source,
        "data_confidence": b.data_confidence,
        "scoring_breakdown": {
            "operational_status_penalty": round(100.0 - b.accessibility_score, 1) if b.status in ["RESTRICTED", "DAMAGED", "CLOSED"] else 0.0,
            "load_restriction_penalty": 30.0 if "Heavy" in (b.load_restriction_type or "") else (40.0 if "Light" in (b.load_restriction_type or "") else 0.0),
            "final_accessibility_score": b.accessibility_score
        },
        "last_updated": b.last_updated
    }

@router.get("/{bridge_id}/impact", response_model=BridgeImpactOut)
def get_bridge_impact(bridge_id: int, db: Session = Depends(get_db)):
    """Evaluates how bridge disruption affects connected transport corridor, active deliveries, and fleet."""
    impact = AccessibilityEngine.get_bridge_logistics_impact(bridge_id, db)
    if "error" in impact:
        raise HTTPException(status_code=404, detail=impact["error"])
    return impact

@router.put("/{bridge_id}/status", response_model=BridgeOut)
def update_bridge_status(
    bridge_id: int,
    payload: BridgeStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Updates bridge operational status, load restrictions, and condition.
    Triggers automatic cascade recalculation of connected corridor, district accessibility, and alerts.
    """
    b = db.query(Bridge).filter(Bridge.id == bridge_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bridge not found")

    old_status = b.status
    b.status = payload.status.upper()
    if payload.condition_description:
        b.condition_description = payload.condition_description
    if payload.load_restriction_type:
        b.load_restriction_type = payload.load_restriction_type
    if payload.load_capacity_tons is not None:
        b.load_capacity_tons = payload.load_capacity_tons
    if hasattr(payload, 'restriction_details') and payload.restriction_details:
        b.restriction_details = payload.restriction_details
    if hasattr(payload, 'data_source') and payload.data_source:
        b.data_source = payload.data_source

    b.is_verified = True
    b.last_inspected_at = datetime.utcnow()
    b.last_updated = datetime.utcnow()

    # Recalculate bridge and network cascade
    AccessibilityEngine.recalculate_bridge_accessibility(b, db)
    AccessibilityEngine.recalculate_all_accessibility(db)

    # Trigger alert if bridge is closed or damaged
    if b.status in ["CLOSED", "DAMAGED"]:
        alert = Alert(
            alert_type="BRIDGE_DISRUPTION",
            title=f"🌉 CRITICAL BRIDGE ALERT: {b.name.upper()} IS {b.status}",
            message=f"Bridge {b.name} on corridor {b.corridor_code} is now {b.status}. Restriction: {b.load_restriction_type}. {b.condition_description}. Connected corridor accessibility adjusted to 0/100.",
            severity="CRITICAL" if b.status == "CLOSED" else "HIGH",
            location=f"{b.name} ({b.district_name})",
            recommended_action=f"Activate alternate corridor bypass and review active heavy truck shipments.",
            is_read=False
        )
        db.add(alert)

    db.add(AuditLog(
        user_email="dispatcher@linkx8.in",
        action="UPDATE_BRIDGE_STATUS",
        resource="Bridge",
        details=f"Updated bridge {b.bridge_code} status from {old_status} to {b.status} (Restriction: {b.load_restriction_type})"
    ))
    db.commit()
    db.refresh(b)
    return b
