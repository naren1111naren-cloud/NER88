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
