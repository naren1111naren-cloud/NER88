"""
Deliveries & Essential Commodity Lifecycle Router (Gaps 12 & 13)
Provides complete lifecycle tracking for Medicines, Food supplies, Construction materials,
and Agricultural produce, along with multi-factor ETA calculation and delay alerts.
"""

import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.security import get_current_active_user
from app.models.models import Delivery, Vehicle, AuditLog, User
from app.schemas.schemas import (
    DeliveryOut,
    DeliveryCreate,
    ETABreakdownOut,
    ETACalculationRequest,
    DeliveryETAUpdateOut,
    CommodityConsignmentCreateIn,
    CommodityStatusUpdateIn,
    CommodityDeliveryCompleteIn,
    EssentialCommoditiesOverviewOut
)
from app.services.routing_service import RoutingService
from app.services.eta_service import ETAService
from app.services.commodity_service import CommodityService

router = APIRouter(prefix="/deliveries", tags=["Logistics Deliveries & Commodity Lifecycle (Gaps 12 & 13)"])

# =========================================================================
# ESSENTIAL COMMODITY OVERVIEW & DEMO SEEDS (GAP 13)
# =========================================================================

@router.get("/overview/essential-commodities", response_model=EssentialCommoditiesOverviewOut)
def get_essential_commodities_overview(db: Session = Depends(get_db)):
    """
    Returns aggregated lifecycle statistics for Medicines, Food, Construction, and Agriculture.
    """
    return CommodityService.get_overview(db)

@router.post("/demo-essential-scenarios", response_model=List[DeliveryOut])
def seed_demo_essential_scenarios(db: Session = Depends(get_db)):
    """
    Seeds verified regional scenarios for all 4 SIH essential commodity categories.
    """
    return CommodityService.seed_demo_scenarios(db)

# =========================================================================
# ETA & ESTIMATED TRAVEL DELAY ENDPOINTS (GAP 12)
# =========================================================================

@router.post("/eta/calculate", response_model=ETABreakdownOut)
def calculate_eta_breakdown(
    payload: ETACalculationRequest,
    db: Session = Depends(get_db)
):
    """
    Computes multi-hazard ETA with explicit decomposition into Traffic, Weather, Incident, and Bridge delays.
    """
    return ETAService.calculate_eta_breakdown(
        origin=payload.origin,
        destination=payload.destination,
        corridor_code=payload.corridor_code or "COR-NH27",
        departure_time=payload.departure_time or datetime.utcnow(),
        db=db,
        vehicle_lat=payload.vehicle_lat,
        vehicle_lng=payload.vehicle_lng
    )

@router.get("/eta/breakdown", response_model=ETABreakdownOut)
def get_eta_breakdown(
    origin: str = "Guwahati",
    destination: str = "Imphal",
    corridor_code: str = "COR-NH27",
    db: Session = Depends(get_db)
):
    """
    Quick GET endpoint for evaluating route ETA breakdown.
    """
    return ETAService.calculate_eta_breakdown(
        origin=origin,
        destination=destination,
        corridor_code=corridor_code,
        departure_time=datetime.utcnow(),
        db=db
    )

@router.post("/{delivery_id}/update-live-eta", response_model=DeliveryETAUpdateOut)
def update_delivery_live_eta(
    delivery_id: int,
    current_lat: Optional[float] = None,
    current_lng: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """
    Recalculates delivery ETA and remaining distance as vehicle location advances.
    """
    deliv = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not deliv:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return ETAService.update_delivery_live_eta(deliv, current_lat, current_lng, db)

# =========================================================================
# COMMODITY CONSIGNMENT LIFECYCLE MANAGEMENT (GAP 13)
# =========================================================================

@router.post("/consignment", response_model=DeliveryOut)
def create_commodity_consignment(
    payload: CommodityConsignmentCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Creates an essential commodity consignment with designated category, temperature control, and route.
    """
    return CommodityService.create_consignment(payload, db)

@router.post("/{delivery_id}/update-status", response_model=DeliveryOut)
def update_commodity_status(
    delivery_id: int,
    payload: CommodityStatusUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Updates lifecycle status (CREATED -> ASSIGNED -> LOADED -> DISPATCHED -> IN_TRANSIT -> DELAYED_AT_RISK -> ARRIVED -> DELIVERED).
    """
    try:
        return CommodityService.update_lifecycle_status(delivery_id, payload, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{delivery_id}/complete", response_model=DeliveryOut)
def complete_commodity_delivery(
    delivery_id: int,
    payload: CommodityDeliveryCompleteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Marks delivery as completed with consignee acknowledgment and audit record.
    """
    try:
        return CommodityService.complete_delivery(delivery_id, payload, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/categories/{category_name}", response_model=List[DeliveryOut])
def get_deliveries_by_category(category_name: str, db: Session = Depends(get_db)):
    """
    Filters deliveries by essential commodity category (Medicines, Food supplies, Construction materials, Agricultural produce).
    """
    return db.query(Delivery).filter(Delivery.cargo_category.ilike(f"%{category_name}%")).order_by(Delivery.created_at.desc()).all()

# =========================================================================
# STANDARD DELIVERY ENDPOINTS (BACKWARD COMPATIBLE)
# =========================================================================

@router.get("", response_model=List[DeliveryOut])
def get_deliveries(db: Session = Depends(get_db)):
    return db.query(Delivery).order_by(Delivery.created_at.desc()).all()

@router.post("", response_model=DeliveryOut)
def create_delivery(
    payload: DeliveryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    consignment_payload = CommodityConsignmentCreateIn(
        cargo_name=payload.cargo_name,
        cargo_category=payload.cargo_category or "Medicines",
        cargo_type=payload.cargo_type,
        priority=payload.priority,
        origin_city=payload.origin_city,
        destination_city=payload.destination_city,
        assigned_vehicle_id=payload.assigned_vehicle_id,
        driver_name=payload.driver_name,
        quantity_description=payload.quantity_description or "Standard Pallet Load (500 units)",
        temperature_controlled=payload.temperature_controlled or False
    )
    return CommodityService.create_consignment(consignment_payload, db)

@router.get("/{delivery_id}", response_model=DeliveryOut)
def get_delivery(delivery_id: int, db: Session = Depends(get_db)):
    d = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return d

@router.post("/{delivery_id}/reroute", response_model=DeliveryOut)
def reroute_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    d = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    route = RoutingService.get_route(d.origin_city, d.destination_city, force_alternate=True)
    d.active_route_path = json.dumps(route["waypoints"])
    d.route_risk_category = "MEDIUM"
    d.route_risk_score = 42.0
    d.estimated_delay_mins = 35
    d.revised_eta = d.original_eta + timedelta(minutes=35)
    d.delay_reason = "Dynamic Corridor Reroute (Avoid Primary Obstruction)"

    db.add(AuditLog(
        user_email=current_user.email if hasattr(current_user, 'email') else "dispatcher@linkx8.in",
        action="REROUTE_DELIVERY",
        resource="Delivery",
        details=f"Approved reroute for {d.delivery_code} to Alternate Route B"
    ))
    db.commit()
    db.refresh(d)
    return d
