from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import Incident, Corridor, Bridge
from app.schemas.schemas import (
    RouteAnalysisRequest,
    RouteOptimizationRequest,
    RouteOptimizationResponseOut,
    RouteOptimizationObjectiveOut,
    CorridorOut
)
from app.services.routing_service import RoutingService, OPTIMIZATION_OBJECTIVES
from ml.src.predict import predict_route_risk
from ml.src.explain import explain_risk

router = APIRouter(prefix="/routes", tags=["AI Route Optimization & Multi-Candidate Engine"])

@router.post("/optimize", response_model=RouteOptimizationResponseOut)
def optimize_route(
    payload: RouteOptimizationRequest,
    db: Session = Depends(get_db)
):
    """
    AI Multi-Candidate Route Optimization Engine:
    Evaluates feasible candidate routes between NER origin-destination hubs.
    Performs multi-attribute feature extraction (travel time, distance, terrain risk, live Open-Meteo weather hazards,
    bridge load limits, and corridor resilience) and ranks candidates according to the chosen optimization objective.
    """
    # Query active incidents/road blockages from database
    blockages = db.query(Incident).filter(Incident.road_status.in_(["BLOCKED", "CLOSED"])).all()
    active_blk_list = [
        {"incident_type": b.incident_type, "location_name": b.location_name, "road_status": b.road_status}
        for b in blockages
    ]
    if payload.active_blockages:
        active_blk_list.extend(payload.active_blockages)

    res = RoutingService.optimize_routes(
        origin=payload.origin_city,
        destination=payload.destination_city,
        optimization_objective=payload.optimization_objective,
        cargo_priority=payload.cargo_priority,
        vehicle_weight_tons=payload.vehicle_weight_tons or 20.0,
        active_blockages=active_blk_list,
        avoid_closed_bridges=payload.avoid_closed_bridges,
        consider_live_weather=payload.consider_live_weather
    )
    return res

@router.get("/objectives", response_model=List[RouteOptimizationObjectiveOut])
def get_optimization_objectives():
    """
    Returns supported AI optimization objectives, policy descriptions, and weighting factors.
    """
    result = []
    for key, data in OPTIMIZATION_OBJECTIVES.items():
        result.append(RouteOptimizationObjectiveOut(
            objective_key=key,
            title=data["title"],
            description=data["description"],
            weights=data["weights"]
        ))
    return result

@router.post("/analyze")
def analyze_route(payload: RouteAnalysisRequest, db: Session = Depends(get_db)):
    """
    Integrated Route Analysis: Combines Random Forest ML risk inference with multi-candidate route optimization.
    """
    feature_dict = payload.model_dump()
    prediction = predict_route_risk(feature_dict)
    explanation = explain_risk(prediction)

    blockages = db.query(Incident).filter(Incident.road_status.in_(["BLOCKED", "CLOSED"])).all()
    active_blk_list = [
        {"incident_type": b.incident_type, "location_name": b.location_name, "road_status": b.road_status}
        for b in blockages
    ]

    # Run multi-candidate optimization
    candidates_eval = RoutingService.optimize_routes(
        origin=payload.origin_city,
        destination=payload.destination_city,
        optimization_objective="BALANCED" if payload.cargo_priority != "EMERGENCY" else "SAFEST",
        cargo_priority=payload.cargo_priority,
        active_blockages=active_blk_list
    )

    route_info = RoutingService.get_route(
        origin=payload.origin_city,
        destination=payload.destination_city,
        force_alternate=payload.road_blocked_status == 1,
        active_blockages=active_blk_list
    )

    from app.services.weather_service import WeatherService
    route_weather = WeatherService.evaluate_route_weather_risk(
        origin=payload.origin_city,
        destination=payload.destination_city,
        corridor_code="COR-NH27",
        waypoints=route_info.get("waypoints", [])
    )

    return {
        "origin": payload.origin_city,
        "destination": payload.destination_city,
        "cargo_priority": payload.cargo_priority,
        "ml_risk_evaluation": prediction,
        "explainable_ai": explanation,
        "weather_intelligence": route_weather,
        "multi_candidate_optimization": candidates_eval,
        "route_geometry": route_info
    }

@router.get("/corridors", response_model=List[CorridorOut])
def get_corridor_accessibility(db: Session = Depends(get_db)):
    """
    Retrieves all monitored strategic highway corridors with accessibility indices and active conditions.
    """
    corridors = db.query(Corridor).order_by(Corridor.corridor_code.asc()).all()
    return corridors

# =========================================================================
# PHASE 2: DISRUPTION DETECTION & INTELLIGENT REROUTING ENDPOINTS
# =========================================================================

from app.models.models import RouteDecision, Delivery, User
from app.schemas.schemas import (
    AffectedRouteOut,
    ETAComparisonOut,
    RouteDecisionOut,
    RerouteApprovalRequest
)
from app.services.rerouting_service import ReroutingService
from app.core.security import get_current_active_user
import json

def _serialize_decision(dec: RouteDecision) -> Dict[str, Any]:
    wpts = []
    if dec.waypoints_json:
        try:
            wpts = json.loads(dec.waypoints_json) if isinstance(dec.waypoints_json, str) else dec.waypoints_json
        except Exception:
            wpts = []
    orig_wpts = []
    if dec.original_waypoints_json:
        try:
            orig_wpts = json.loads(dec.original_waypoints_json) if isinstance(dec.original_waypoints_json, str) else dec.original_waypoints_json
        except Exception:
            orig_wpts = []

    return {
        "id": dec.id,
        "decision_code": dec.decision_code,
        "delivery_id": dec.delivery_id,
        "delivery_code": dec.delivery_code,
        "vehicle_id": dec.vehicle_id,
        "vehicle_code": dec.vehicle_code,
        "corridor_code": dec.corridor_code,
        "incident_id": dec.incident_id,
        "trigger_event": dec.trigger_event,
        "original_route_id": dec.original_route_id,
        "original_route_name": dec.original_route_name,
        "original_distance_km": dec.original_distance_km,
        "original_travel_time_hours": dec.original_travel_time_hours,
        "original_eta": dec.original_eta,
        "alternative_route_id": dec.alternative_route_id,
        "alternative_route_name": dec.alternative_route_name,
        "alternative_distance_km": dec.alternative_distance_km,
        "alternative_travel_time_hours": dec.alternative_travel_time_hours,
        "new_eta": dec.new_eta,
        "additional_distance_km": dec.additional_distance_km,
        "additional_time_minutes": dec.additional_time_minutes,
        "risk_score_before": dec.risk_score_before,
        "risk_score_after": dec.risk_score_after,
        "status": dec.status,
        "rationale": dec.rationale,
        "waypoints": wpts,
        "original_waypoints": orig_wpts,
        "approved_by": dec.approved_by,
        "approved_at": dec.approved_at,
        "created_at": dec.created_at,
        "updated_at": dec.updated_at
    }

@router.get("/affected", response_model=List[AffectedRouteOut])
def get_affected_routes(db: Session = Depends(get_db)):
    """
    Phase 2: Returns all currently restricted or blocked corridors with impacted
    active fleet vehicles and consignments traversing the corridor.
    """
    return ReroutingService.get_affected_routes(db)

@router.get("/alternative-candidates")
def get_alternative_candidates(
    origin: str = Query("Guwahati", description="Origin city / hub"),
    destination: str = Query("Imphal", description="Destination city / hub"),
    avoid_corridor: Optional[str] = Query(None, description="Corridor code to avoid, e.g. COR-NH27"),
    vehicle_weight_tons: float = Query(20.0, description="Vehicle weight in tons"),
    db: Session = Depends(get_db)
):
    """
    Phase 2: Calculates feasible alternative routes bypassing the specified blocked corridor
    or currently active blockages, using multi-factor normalized scoring.
    """
    blockages = db.query(Incident).filter(Incident.road_status.in_(["BLOCKED", "CLOSED"])).all()
    active_blk_list = [
        {"incident_type": b.incident_type, "location_name": b.location_name, "road_status": b.road_status}
        for b in blockages
    ]
    if avoid_corridor:
        active_blk_list.append({"incident_type": "Corridor Disruption", "location_name": avoid_corridor, "road_status": "BLOCKED"})

    res = RoutingService.optimize_routes(
        origin=origin,
        destination=destination,
        optimization_objective="BALANCED",
        vehicle_weight_tons=vehicle_weight_tons,
        active_blockages=active_blk_list
    )
    return res

@router.get("/eta-comparison", response_model=ETAComparisonOut)
def get_eta_comparison(
    delivery_id: Optional[int] = Query(None, description="Delivery ID to evaluate"),
    origin: Optional[str] = Query(None, description="Origin hub (if delivery_id omitted)"),
    destination: Optional[str] = Query(None, description="Destination hub (if delivery_id omitted)"),
    db: Session = Depends(get_db)
):
    """
    Phase 2: Side-by-side deterministic comparison between original route and alternative route:
    - Original distance vs Alternative distance (+Delta km)
    - Original travel time vs Alternative travel time (+Delta minutes)
    - Original ETA vs New ETA
    - Risk score reduction (predictive factors clearly labeled)
    """
    return ReroutingService.get_eta_comparison(
        db=db,
        delivery_id=delivery_id,
        origin=origin,
        destination=destination
    )

@router.get("/decisions", response_model=List[RouteDecisionOut])
def list_route_decisions(
    status: Optional[str] = Query(None, description="Filter by status: PROPOSED, APPROVED, EXECUTED, REJECTED"),
    delivery_id: Optional[int] = Query(None, description="Filter by delivery ID"),
    corridor_code: Optional[str] = Query(None, description="Filter by corridor code"),
    db: Session = Depends(get_db)
):
    """
    Phase 2: Retrieves stored route decisions from backend.
    """
    query = db.query(RouteDecision)
    if status:
        query = query.filter(RouteDecision.status == status.upper())
    if delivery_id:
        query = query.filter(RouteDecision.delivery_id == delivery_id)
    if corridor_code:
        query = query.filter(RouteDecision.corridor_code == corridor_code)

    decisions = query.order_by(RouteDecision.created_at.desc()).all()
    return [_serialize_decision(d) for d in decisions]

@router.get("/decisions/{decision_id}", response_model=RouteDecisionOut)
def get_route_decision(decision_id: int, db: Session = Depends(get_db)):
    """
    Phase 2: Retrieves specific route decision by ID.
    """
    dec = db.query(RouteDecision).filter(RouteDecision.id == decision_id).first()
    if not dec:
        raise HTTPException(status_code=404, detail=f"RouteDecision #{decision_id} not found")
    return _serialize_decision(dec)

@router.post("/decisions/{decision_id}/approve", response_model=RouteDecisionOut)
def approve_route_decision(
    decision_id: int,
    payload: Optional[RerouteApprovalRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Phase 2: Approves and executes a proposed reroute decision:
    - Transitions RouteDecision status to APPROVED
    - Updates delivery active_route_path to alternative waypoints
    - Updates revised_eta, delay minutes, risk score
    - Updates vehicle status and risk level
    - Logs audit record
    """
    user_email = current_user.email if hasattr(current_user, 'email') else "dispatcher@linkx8.in"
    notes = payload.notes if payload else None
    try:
        dec = ReroutingService.approve_route_decision(
            decision_id=decision_id,
            user_email=user_email,
            db=db,
            notes=notes
        )
        return _serialize_decision(dec)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

