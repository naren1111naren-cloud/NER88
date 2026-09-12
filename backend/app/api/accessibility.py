from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.models import Corridor, Bridge, District, Vehicle, Delivery, Incident, WeatherRecord, AuditLog, Alert
from app.schemas.schemas import (
    CorridorOut, BridgeOut, BridgeStatusUpdate, DistrictOut,
    AssetAccessibilityDetailOut, AccessibilitySummaryOut, APIResponse
)
from app.services.accessibility_service import AccessibilityEngine

router = APIRouter(prefix="/accessibility", tags=["Unified Road, Bridge & Transport Accessibility Intelligence"])

@router.get("/summary", response_model=AccessibilitySummaryOut)
def get_accessibility_summary(db: Session = Depends(get_db)):
    """Provides high-level regional accessibility KPIs across roads, bridges, districts, and vehicles."""
    # Run cascade update
    AccessibilityEngine.recalculate_all_accessibility(db)

    corridors = db.query(Corridor).all()
    bridges = db.query(Bridge).all()
    districts = db.query(District).all()
    vehicles = db.query(Vehicle).all()
    incidents = db.query(Incident).all()

    total_cor = len(corridors)
    acc_cor = sum(1 for c in corridors if c.status in ["OPEN", "PASSABLE"])
    rest_cor = sum(1 for c in corridors if c.status in ["PARTIAL", "RESTRICTED"])
    blk_cor = sum(1 for c in corridors if c.status in ["BLOCKED", "CLOSED"])

    tot_brg = len(bridges)
    op_brg = sum(1 for b in bridges if b.status == "OPERATIONAL")
    rest_brg = sum(1 for b in bridges if b.status in ["RESTRICTED", "DAMAGED"])
    cls_brg = sum(1 for b in bridges if b.status == "CLOSED")

    tot_dist = len(districts)
    acc_dist = sum(1 for d in districts if d.accessibility_index >= 75.0)
    at_risk_dist = sum(1 for d in districts if 30.0 <= d.accessibility_index < 75.0)
    crit_dist = sum(1 for d in districts if d.accessibility_index < 30.0)

    avg_score = round(sum(d.accessibility_index for d in districts) / max(1, tot_dist), 1)
    impacted_vehs = sum(1 for v in vehicles if v.risk_level in ["HIGH", "CRITICAL"] or v.status in ["DELAYED", "REROUTED"])

    return {
        "total_corridors": total_cor,
        "accessible_corridors": acc_cor,
        "restricted_corridors": rest_cor,
        "blocked_corridors": blk_cor,
        "total_bridges": tot_brg,
        "operational_bridges": op_brg,
        "restricted_bridges": rest_brg,
        "closed_bridges": cls_brg,
        "total_districts": tot_dist,
        "accessible_districts": acc_dist,
        "at_risk_districts": at_risk_dist,
        "critical_districts": crit_dist,
        "average_regional_accessibility": avg_score,
        "active_incidents_count": len(incidents),
        "impacted_vehicles_count": impacted_vehs,
        "last_updated": datetime.utcnow()
    }

@router.get("/roads", response_model=List[CorridorOut])
def get_road_accessibility(db: Session = Depends(get_db)):
    """Returns accessibility and status for all monitored transport corridors/roads."""
    corridors = db.query(Corridor).order_by(Corridor.accessibility_score.asc()).all()
    for c in corridors:
        AccessibilityEngine.recalculate_corridor_accessibility(c, db)
    db.commit()
    return corridors

@router.get("/bridges", response_model=List[BridgeOut])
def get_bridge_accessibility(db: Session = Depends(get_db)):
    """Returns accessibility and operational status for all monitored bridges."""
    bridges = db.query(Bridge).order_by(Bridge.accessibility_score.asc()).all()
    for b in bridges:
        AccessibilityEngine.recalculate_bridge_accessibility(b, db)
    db.commit()
    return bridges

@router.get("/districts", response_model=List[DistrictOut])
def get_district_accessibility(db: Session = Depends(get_db)):
    """Returns dynamic district accessibility indices based on roads, bridges, and incidents."""
    districts = db.query(District).order_by(District.accessibility_index.asc()).all()
    for d in districts:
        AccessibilityEngine.recalculate_district_accessibility(d, db)
    db.commit()
    return districts

@router.get("/transport")
def get_transport_accessibility(db: Session = Depends(get_db)):
    """Returns transport movement status connected to road & bridge accessibility."""
    AccessibilityEngine.evaluate_transport_impact(db)
    vehicles = db.query(Vehicle).all()
    deliveries = db.query(Delivery).all()

    return {
        "active_vehicles": [
            {
                "id": v.id,
                "vehicle_code": v.vehicle_code,
                "driver_name": v.driver_name,
                "status": v.status,
                "risk_level": v.risk_level,
                "speed_kmh": v.speed_kmh,
                "destination_city": v.destination_city,
                "current_lat": v.current_lat,
                "current_lng": v.current_lng,
                "telemetry_source": v.telemetry_source,
                "last_updated": v.last_updated
            } for v in vehicles
        ],
        "deliveries": [
            {
                "id": d.id,
                "delivery_code": d.delivery_code,
                "cargo_name": d.cargo_name,
                "priority": d.priority,
                "origin_city": d.origin_city,
                "destination_city": d.destination_city,
                "status": d.status,
                "route_risk_score": d.route_risk_score,
                "route_risk_category": d.route_risk_category,
                "estimated_delay_mins": d.estimated_delay_mins
            } for d in deliveries
        ]
    }

@router.get("/asset/{asset_type}/{asset_id}", response_model=AssetAccessibilityDetailOut)
def get_asset_accessibility_detail(asset_type: str, asset_id: str, db: Session = Depends(get_db)):
    """Returns detailed accessibility breakdown including reason, weather, delay, and data provenance."""
    asset_type = asset_type.lower()
    
    if asset_type in ["corridor", "road"]:
        cor = db.query(Corridor).filter((Corridor.corridor_code == asset_id) | (Corridor.id == int(asset_id) if asset_id.isdigit() else False)).first()
        if not cor:
            raise HTTPException(status_code=404, detail="Corridor/Road not found")
        AccessibilityEngine.recalculate_corridor_accessibility(cor, db)
        
        # Count impacted vehicles
        aff_vehs = db.query(Delivery).filter(Delivery.destination_city == cor.destination, Delivery.status.in_(["IN_TRANSIT", "DELAYED"])).count()

        return {
            "asset_id": cor.corridor_code,
            "asset_type": "corridor",
            "name": cor.name,
            "corridor": cor.corridor_code,
            "state": cor.states_covered,
            "status": cor.status,
            "accessibility_score": cor.accessibility_score,
            "risk_level": cor.risk_level,
            "current_condition": cor.current_condition,
            "active_incidents": cor.incident_count,
            "weather_condition": cor.weather_condition,
            "traffic_condition": f"Delay +{cor.estimated_delay_mins} mins",
            "estimated_delay_mins": cor.estimated_delay_mins,
            "affected_vehicles_count": aff_vehs,
            "reason": cor.reason or "Normal road and bridge passage",
            "data_source": cor.data_source or "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_confidence": cor.data_confidence or "HIGH",
            "last_updated": cor.last_updated
        }

    elif asset_type == "bridge":
        brg = db.query(Bridge).filter((Bridge.bridge_code == asset_id) | (Bridge.id == int(asset_id) if asset_id.isdigit() else False)).first()
        if not brg:
            raise HTTPException(status_code=404, detail="Bridge not found")
        AccessibilityEngine.recalculate_bridge_accessibility(brg, db)

        return {
            "asset_id": brg.bridge_code,
            "asset_type": "bridge",
            "name": brg.name,
            "latitude": brg.latitude,
            "longitude": brg.longitude,
            "district": brg.district_name,
            "state": brg.state,
            "corridor": brg.corridor_code,
            "status": brg.status,
            "accessibility_score": brg.accessibility_score,
            "risk_level": brg.risk_level,
            "current_condition": brg.condition_description,
            "active_incidents": 1 if brg.status != "OPERATIONAL" else 0,
            "weather_condition": "Monsoon Mountain River Flow",
            "traffic_condition": brg.restriction_details or f"Load Limit: {brg.load_capacity_tons}T",
            "estimated_delay_mins": 0 if brg.status == "OPERATIONAL" else (180 if brg.status == "CLOSED" else 45),
            "affected_vehicles_count": 0,
            "reason": brg.condition_description or f"Bridge status is {brg.status}",
            "data_source": brg.data_source,
            "data_confidence": brg.data_confidence,
            "last_updated": brg.last_updated
        }

    elif asset_type == "district":
        dist = db.query(District).filter((District.name.ilike(f"%{asset_id}%")) | (District.id == int(asset_id) if asset_id.isdigit() else False)).first()
        if not dist:
            raise HTTPException(status_code=404, detail="District not found")
        AccessibilityEngine.recalculate_district_accessibility(dist, db)

        return {
            "asset_id": f"DIST-{dist.name.upper()}",
            "asset_type": "district",
            "name": dist.name,
            "district": dist.name,
            "state": dist.state,
            "status": dist.status,
            "accessibility_score": dist.accessibility_index,
            "risk_level": "CRITICAL" if dist.accessibility_index < 30 else ("HIGH" if dist.accessibility_index < 50 else "LOW"),
            "current_condition": f"Supply status: {dist.critical_supply_status}",
            "active_incidents": dist.active_incidents_count,
            "weather_condition": "Regional Weather Monitored",
            "traffic_condition": f"{dist.bridge_count} Bridges, {dist.accessible_corridor_count} Active Corridors",
            "estimated_delay_mins": 0 if dist.accessibility_index > 70 else 60,
            "affected_vehicles_count": 0,
            "reason": f"Accessibility index {dist.accessibility_index}/100 based on {dist.active_incidents_count} active incidents and {dist.bridge_count} bridges.",
            "data_source": "INTEGRATED_DISTRICT_ACCESSIBILITY_MODEL",
            "data_confidence": "HIGH",
            "last_updated": dist.last_recalculated or datetime.utcnow()
        }

    raise HTTPException(status_code=400, detail=f"Unsupported asset type: {asset_type}")

@router.put("/bridges/{bridge_id}/status", response_model=BridgeOut)
def update_bridge_status(bridge_id: int, payload: BridgeStatusUpdate, db: Session = Depends(get_db)):
    """Updates bridge operational condition and triggers cascade accessibility recalculation."""
    b = db.query(Bridge).filter(Bridge.id == bridge_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bridge not found")

    old_status = b.status
    b.status = payload.status.upper()
    if payload.condition_description:
        b.condition_description = payload.condition_description
    if payload.restriction_details:
        b.restriction_details = payload.restriction_details

    AccessibilityEngine.recalculate_bridge_accessibility(b, db)

    # Cascade recalculate
    AccessibilityEngine.recalculate_all_accessibility(db)

    # Trigger alert if bridge closed or damaged
    if b.status in ["CLOSED", "DAMAGED"]:
        alert = Alert(
            alert_type="BRIDGE_DISRUPTION",
            title=f"🌉 CRITICAL INFRASTRUCTURE ALERT: {b.name.upper()} {b.status}",
            message=f"Bridge {b.name} on corridor {b.corridor_code} is now {b.status}. {b.condition_description}. Accessibility score reduced to {b.accessibility_score}/100.",
            severity="CRITICAL" if b.status == "CLOSED" else "HIGH",
            location=f"{b.name} ({b.district_name})",
            recommended_action=f"Inspect alternate river crossings or reroute heavy transport via alternate corridors.",
            is_read=False
        )
        db.add(alert)

    db.add(AuditLog(
        user_email="dispatcher@linkx8.in",
        action="UPDATE_BRIDGE_STATUS",
        resource="Bridge",
        details=f"Updated bridge {b.bridge_code} status from {old_status} to {b.status} ({b.condition_description})"
    ))
    db.commit()
    db.refresh(b)
    return b

@router.post("/recalculate")
def trigger_manual_recalculation(db: Session = Depends(get_db)):
    """Manually triggers regional cascade accessibility recalculation."""
    res = AccessibilityEngine.recalculate_all_accessibility(db)
    return {
        "status": "SUCCESS",
        "message": "Regional accessibility intelligence recalculated across all roads, bridges, districts, and vehicles.",
        "details": res
    }
