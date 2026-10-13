import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import (
    Incident, Alert, Delivery, Vehicle, AuditLog, Corridor, District, Bridge,
    WeatherRecord, RouteDecision, FieldReport, TelemetryLog, TrafficRecord
)
from app.services.routing_service import (
    RoutingService,
    PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS,
    ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS,
    PRIMARY_GUWAHATI_SHILLONG_WAYPOINTS,
    ALTERNATE_GUWAHATI_SHILLONG_WAYPOINTS
)
from app.services.accessibility_service import AccessibilityEngine
from app.services.alert_delivery_service import AlertDeliveryService
from app.services.rerouting_service import ReroutingService
from app.database.seed import seed_master_scenario_data

router = APIRouter(prefix="/demo", tags=["SIH Demonstration Engine"])

@router.post("/trigger-landslide")
def trigger_hackathon_demo_landslide(db: Session = Depends(get_db)):
    """
    Triggers Master Landslide Scenario:
    1. Massive landslide reported at Senapati Pass (NH27/NH2).
    2. Corridor COR-NH27 drops to 0 (BLOCKED).
    3. Senapati district accessibility drops to 24/100 (Severely Inaccessible).
    4. Operational Priority Alert generated and broadcast via SSE.
    5. AI Route Optimizer reroutes active consignment DEL-2026-001 via Alternate Route B (NH37 via Silchar/Jiribam).
    6. Dashboard GIS map updates live.
    """
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1. Create blocked landslide incident
    inc = Incident(
        incident_type="LANDSLIDE",
        description="Torrential mountain rain triggered massive landslide blocking NH27/NH2 near Senapati Pass (Km 214). Both lanes completely impassable.",
        latitude=25.2676,
        longitude=94.0210,
        location_name="Senapati Pass (NH27/NH2)",
        district_name="Senapati",
        severity="CRITICAL",
        road_status="BLOCKED",
        reporter_name="Field Officer (Senapati Patrol)",
        is_synced=True,
        created_at=now_dt
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)

    # 2. Update Corridor COR-NH27
    cor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH27").first()
    if cor:
        cor.status = "BLOCKED"
        cor.accessibility_score = 0.0
        cor.risk_level = "CRITICAL"
        cor.current_condition = "Impassable due to monsoon landslide at Senapati Pass"
        cor.weather_condition = "Torrential Downpour (75 mm/hr)"
        cor.reason = "Monsoon Landslide at Senapati Pass + 75 mm/hr Heavy Rain"
        cor.estimated_delay_mins = 150
        cor.incident_count = 1
        cor.last_updated = now_dt

    # 3. Update District Senapati
    dist = db.query(District).filter(District.name == "Senapati").first()
    if dist:
        dist.accessibility_index = 24.0
        dist.status = "Severely Inaccessible"
        dist.active_incidents_count = 1
        dist.critical_supply_status = "CRITICAL_DELAY"
        dist.last_recalculated = now_dt

    # 4. Create Emergency Operational Alert & Broadcast
    alert = AlertDeliveryService.create_and_broadcast_alert(
        db=db,
        alert_type="CRITICAL_ROUTE_ALERT",
        title="🚨 CRITICAL DISRUPTION: MONSOON LANDSLIDE AT SENAPATI PASS",
        message="NH27 Corridor blocked by Landslide. AI Route Risk score escalated to 82/100 (CRITICAL). Recommended Action: Approve detour for vehicle NER-V001 via Alternate Route B (NH37 via Silchar/Jiribam). Estimated delay: +35 mins.",
        severity="CRITICAL",
        location="Senapati Pass (NH27/NH2)",
        recommended_action="Approve reroute via Alternate Route B (via Silchar / Jiribam - NH37)",
        source_incident_id=inc.id,
        corridor_code="COR-NH27",
        district_name="Senapati"
    )

    # 5. Update active delivery DEL-2026-001 (Guwahati -> Imphal)
    deliv = db.query(Delivery).filter(Delivery.delivery_code == "DEL-2026-001").first()
    if deliv:
        deliv.route_risk_score = 82.0
        deliv.route_risk_category = "CRITICAL"
        deliv.status = "REROUTED"
        deliv.estimated_delay_mins = 35
        deliv.revised_eta = deliv.original_eta + timedelta(minutes=35)
        deliv.alternate_route_path = json.dumps(ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS)

    # 6. Update Vehicle NER-V001
    veh = db.query(Vehicle).filter(Vehicle.vehicle_code == "NER-V001").first()
    if veh:
        veh.risk_level = "CRITICAL"
        veh.status = "REROUTED"

    # Cascade recalculation
    AccessibilityEngine.recalculate_all_accessibility(db, source_incident=inc)

    db.add(AuditLog(
        user_email="system_demo@linkx8.in",
        action="SIH_DEMO_TRIGGER_LANDSLIDE",
        resource="GIS_Pipeline",
        details="Executed Landslide Scenario: Landslide reported -> AI Risk (82/100 CRITICAL) -> Corridor Blocked -> Alert -> Alternate Route B activated"
    ))
    db.commit()

    # Broadcast real-time demo scenario event over SSE
    scenario_payload = {
        "scenario_type": "LANDSLIDE_REROUTE",
        "title": "Landslide Scenario Activated",
        "affected_corridor": "COR-NH27",
        "incident_id": inc.id,
        "alert_id": alert.id,
        "recommended_route": "Alternate Route B (NH37 via Silchar/Jiribam)",
        "timestamp": now_dt.isoformat()
    }
    AlertDeliveryService.publish_generic_event("DEMO_SCENARIO_EVENT", scenario_payload)

    return {
        "success": True,
        "scenario": "MASTER_DISASTER_REROUTE_WORKFLOW_TRIGGERED",
        "incident": {
            "id": inc.id,
            "type": inc.incident_type,
            "location": inc.location_name,
            "severity": inc.severity,
            "road_status": inc.road_status
        },
        "risk_evaluation": {
            "risk_score": 82.0,
            "risk_category": "CRITICAL",
            "primary_reason": "Monsoon Landslide blockage at Senapati Pass + 75 mm/hr Heavy Rain"
        },
        "route_recommendation": {
            "action": "MANDATORY_REROUTE",
            "recommended_route": "Alternate Route B (via Silchar / Jiribam - NH37)",
            "revised_eta_delay_mins": 35
        }
    }

@router.post("/trigger-heavy-rainfall")
def trigger_hackathon_demo_rainfall(db: Session = Depends(get_db)):
    """
    Triggers Heavy Rainfall Scenario:
    1. Extreme monsoon rainfall surges to 65 mm/hr over Meghalaya / Southern Assam.
    2. Weather risk escalates to SEVERE (78/100).
    3. Road accessibility on NH40 (Guwahati -> Shillong) degrades to 42/100 (RESTRICTED).
    4. Operational weather alert generated and broadcast.
    5. Route optimizer adjusts travel speeds and delay estimates.
    """
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)

    # 1. Update/Add Weather Record
    w_rec = db.query(WeatherRecord).filter(WeatherRecord.location_name == "Shillong").first()
    if not w_rec:
        w_rec = WeatherRecord(location_name="Shillong", state="Meghalaya")
        db.add(w_rec)
    w_rec.temperature_c = 18.0
    w_rec.rainfall_mm_hr = 65.0
    w_rec.condition = "Heavy Monsoon Downpour"
    w_rec.wind_kmh = 42.0
    w_rec.recorded_at = now_dt

    # 2. Update Corridor COR-NH40
    cor = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH40").first()
    if cor:
        cor.status = "RESTRICTED"
        cor.accessibility_score = 42.0
        cor.risk_level = "HIGH"
        cor.weather_condition = "Heavy Monsoon Rain (65 mm/hr)"
        cor.reason = "Heavy Monsoon Downpour (65 mm/hr) + Reduced Traction on Ghats"
        cor.estimated_delay_mins = 45
        cor.last_updated = now_dt

    # 3. Create Weather Alert & Broadcast
    alert = AlertDeliveryService.create_and_broadcast_alert(
        db=db,
        alert_type="WEATHER_DISRUPTION",
        title="⛈️ SEVERE WEATHER ALERT: MONSOON SURGE (65 MM/HR) IN SHILLONG SECTOR",
        message="Intense rainfall over NH40 corridor. Aquaplaning hazard and hill slope mudslide risk elevated. Enforce speed reduction to 30 km/h.",
        severity="HIGH",
        location="Shillong / NH40 Ghat Corridor",
        recommended_action="Reduce vehicle convoy speeds, maintain anti-skid precautions, and alert drivers.",
        corridor_code="COR-NH40"
    )

    AccessibilityEngine.recalculate_all_accessibility(db)

    db.add(AuditLog(
        user_email="system_demo@linkx8.in",
        action="SIH_DEMO_TRIGGER_RAINFALL",
        resource="Weather_Pipeline",
        details="Triggered Heavy Rainfall Scenario (65 mm/hr) -> Corridor NH40 degraded -> Operational Weather Alert broadcast"
    ))
    db.commit()

    scenario_payload = {
        "scenario_type": "HEAVY_RAINFALL",
        "title": "Severe Rainfall Scenario Activated",
        "affected_corridor": "COR-NH40",
        "alert_id": alert.id,
        "rainfall_mm_hr": 65.0,
        "timestamp": now_dt.isoformat()
    }
    AlertDeliveryService.publish_generic_event("DEMO_SCENARIO_EVENT", scenario_payload)

    return {
        "success": True,
        "scenario": "HEAVY_RAINFALL_TRIGGERED",
        "corridor": "COR-NH40 (Guwahati -> Shillong)",
        "weather": {
            "rainfall_mm_hr": 65.0,
            "condition": "Heavy Monsoon Downpour",
            "risk_score": 78.0
        },
        "accessibility_score": 42.0
    }

@router.post("/reset")
def reset_demo_state(db: Session = Depends(get_db)):
    """Resets demo state back to initial clear conditions and broadcasts reset event."""
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)

    db.query(Incident).delete()
    db.query(Alert).delete()

    cor27 = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH27").first()
    if cor27:
        cor27.status = "OPEN"
        cor27.accessibility_score = 90.0
        cor27.risk_level = "LOW"
        cor27.current_condition = "Normal traffic flow along NH27/NH2 pass"
        cor27.weather_condition = "Light Rain"
        cor27.reason = "Normal road and bridge passage"
        cor27.estimated_delay_mins = 0
        cor27.incident_count = 0
        cor27.last_updated = now_dt

    cor40 = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH40").first()
    if cor40:
        cor40.status = "OPEN"
        cor40.accessibility_score = 94.0
        cor40.risk_level = "LOW"
        cor40.current_condition = "Clear driving conditions"
        cor40.weather_condition = "Clear"
        cor40.reason = "Normal road and bridge passage"
        cor40.estimated_delay_mins = 0
        cor40.last_updated = now_dt

    dist = db.query(District).filter(District.name == "Senapati").first()
    if dist:
        dist.accessibility_index = 82.0
        dist.status = "Good"
        dist.active_incidents_count = 0
        dist.critical_supply_status = "STABLE"
        dist.last_recalculated = now_dt

    # Reset bridges
    bridges = db.query(Bridge).all()
    for b in bridges:
        if b.status != "RESTRICTED":
            b.status = "OPERATIONAL"
            b.accessibility_score = 95.0
            b.risk_level = "LOW"
            b.condition_description = "Operational clearance normal"
            b.last_updated = now_dt

    deliv = db.query(Delivery).filter(Delivery.delivery_code == "DEL-2026-001").first()
    if deliv:
        deliv.route_risk_score = 18.0
        deliv.route_risk_category = "LOW"
        deliv.status = "IN_TRANSIT"
        deliv.estimated_delay_mins = 0
        deliv.revised_eta = deliv.original_eta
        deliv.active_route_path = json.dumps(PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS)

    veh = db.query(Vehicle).filter(Vehicle.vehicle_code == "NER-V001").first()
    if veh:
        veh.risk_level = "LOW"
        veh.status = "IN_TRANSIT"
        veh.current_lat = 26.1445
        veh.current_lng = 91.7362
        veh.tracking_mode = "SIMULATION"

    AccessibilityEngine.recalculate_all_accessibility(db)

    # Reset V-102 and MED-102 baseline
    seed_master_scenario_data(db)
    v102 = db.query(Vehicle).filter(Vehicle.vehicle_code == "V-102").first()
    if v102:
        v102.status = "IN_TRANSIT"
        v102.risk_level = "LOW"
        v102.current_lat = 26.1050
        v102.current_lng = 91.8200
        v102.speed_kmh = 45.0
        v102.tracking_mode = "SIMULATION"

    med102 = db.query(Delivery).filter(Delivery.delivery_code == "MED-102").first()
    if med102:
        med102.status = "IN_TRANSIT"
        med102.route_risk_score = 14.0
        med102.route_risk_category = "LOW"
        med102.estimated_delay_mins = 0
        med102.active_route_path = json.dumps(PRIMARY_GUWAHATI_SHILLONG_WAYPOINTS)
        med102.completed_at = None
        med102.actual_delivery_duration_hours = None

    db.add(AuditLog(
        user_email="admin@linkx8.in",
        action="RESET_DEMO_STATE",
        resource="System",
        details="Reset demo state back to initial clear conditions"
    ))
    db.commit()

    AlertDeliveryService.publish_generic_event("DEMO_SCENARIO_EVENT", {
        "scenario_type": "RESET",
        "title": "System Reset to Clear Operational Baseline",
        "timestamp": now_dt.isoformat()
    })

    return {"success": True, "message": "Demo state reset to initial clear conditions."}


# =========================================================================
# PHASE 5: MASTER REGIONAL LOGISTICS INTELLIGENCE SCENARIO (SIH26002)
# Guwahati -> Shillong Essential Medicine Delivery (Consignment MED-102 / V-102)
# =========================================================================

@router.get("/scenario/status")
def get_master_scenario_status(db: Session = Depends(get_db)):
    """
    Returns the current state of the Guwahati -> Shillong Master Demonstration Scenario.
    Includes vehicle telemetry, consignment status, corridor accessibility, active decisions, and alerts.
    """
    v102 = db.query(Vehicle).filter(Vehicle.vehicle_code == "V-102").first()
    med102 = db.query(Delivery).filter(Delivery.delivery_code == "MED-102").first()
    cor40 = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH40").first()
    latest_decision = (
        db.query(RouteDecision)
        .filter(RouteDecision.corridor_code == "COR-NH40")
        .order_by(RouteDecision.created_at.desc())
        .first()
    )
    active_incident = (
        db.query(Incident)
        .filter(Incident.location_name.ilike("%Nongpoh%"))
        .order_by(Incident.created_at.desc())
        .first()
    )
    field_reports = (
        db.query(FieldReport)
        .filter(FieldReport.location_name.ilike("%Nongpoh%"))
        .order_by(FieldReport.reported_at.desc())
        .all()
    )
    alerts = (
        db.query(Alert)
        .filter(Alert.corridor_code == "COR-NH40")
        .order_by(Alert.created_at.desc())
        .limit(5)
        .all()
    )

    current_step = 1
    if not med102 or not v102:
        current_step = 0
    elif med102.status == "DELIVERED":
        current_step = 5
    elif latest_decision and latest_decision.status == "APPROVED":
        current_step = 4
    elif field_reports:
        current_step = 3
    elif cor40 and cor40.status in ["BLOCKED", "RESTRICTED"]:
        current_step = 2

    return {
        "scenario": "ESSENTIAL_MEDICINE_DELIVERY",
        "current_step": current_step,
        "origin": "Guwahati",
        "destination": "Shillong",
        "vehicle": {
            "code": v102.vehicle_code if v102 else "V-102",
            "driver": v102.driver_name if v102 else "Anil Das",
            "status": v102.status if v102 else "UNKNOWN",
            "current_lat": v102.current_lat if v102 else 26.1050,
            "current_lng": v102.current_lng if v102 else 91.8200,
            "speed_kmh": v102.speed_kmh if v102 else 45.0,
            "tracking_mode": v102.tracking_mode if v102 else "SIMULATION",
            "telemetry_health": v102.telemetry_health if v102 else "LIVE"
        } if v102 else None,
        "shipment": {
            "shipment_id": med102.delivery_code if med102 else "MED-102",
            "commodity": med102.cargo_name if med102 else "Essential medicines",
            "priority": med102.priority if med102 else "EMERGENCY",
            "status": med102.status if med102 else "IN_TRANSIT",
            "estimated_delay_mins": med102.estimated_delay_mins if med102 else 0,
            "original_eta": med102.original_eta.isoformat() if med102 and med102.original_eta else None,
            "revised_eta": med102.revised_eta.isoformat() if med102 and med102.revised_eta else None,
            "route_risk_score": med102.route_risk_score if med102 else 14.0,
            "route_risk_category": med102.route_risk_category if med102 else "LOW",
            "actual_delivery": med102.completed_at.isoformat() if med102 and med102.completed_at else None
        } if med102 else None,
        "corridor": {
            "code": cor40.corridor_code if cor40 else "COR-NH40",
            "name": cor40.name if cor40 else "NH40 Guwahati - Shillong Expressway",
            "status": cor40.status if cor40 else "OPEN",
            "accessibility_score": cor40.accessibility_score if cor40 else 94.0,
            "risk_level": cor40.risk_level if cor40 else "LOW",
            "reason": cor40.reason if cor40 else "Normal road and bridge passage"
        } if cor40 else None,
        "route_decision": {
            "id": latest_decision.id,
            "code": latest_decision.decision_code,
            "status": latest_decision.status,
            "original_route": latest_decision.original_route_name,
            "alternative_route": latest_decision.alternative_route_name,
            "additional_distance_km": latest_decision.additional_distance_km,
            "additional_time_minutes": latest_decision.additional_time_minutes,
            "rationale": latest_decision.rationale
        } if latest_decision else None,
        "active_incident": {
            "id": active_incident.id,
            "type": active_incident.incident_type,
            "location": active_incident.location_name,
            "severity": active_incident.severity,
            "status": active_incident.road_status
        } if active_incident else None,
        "alerts_count": len(alerts),
        "field_reports_count": len(field_reports)
    }


@router.get("/scenario/timeline")
def get_master_scenario_timeline(db: Session = Depends(get_db)):
    """
    Returns the real-time operational event timeline for shipment MED-102 and vehicle V-102.
    Strictly satisfies Section 16 of the NER88 specification using real database timestamps.
    """
    med102 = db.query(Delivery).filter(Delivery.delivery_code == "MED-102").first()
    v102 = db.query(Vehicle).filter(Vehicle.vehicle_code == "V-102").first()
    cor40 = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH40").first()

    timeline = []

    # 1. Dispatch event
    if med102:
        timeline.append({
            "id": "evt-dispatch",
            "timestamp": med102.created_at.isoformat(),
            "time_str": med102.created_at.strftime("%H:%M"),
            "title": "Shipment Dispatched from Guwahati Depot",
            "category": "DISPATCH",
            "description": f"Consignment MED-102 ({med102.cargo_name}) loaded and dispatched to Shillong via NH40 GS Road.",
            "source": "Logistics Dispatch Engine",
            "status": "COMPLETED",
            "badge_color": "green"
        })

    # 2. GPS tracking active
    if v102 and v102.last_telemetry_at:
        tel_time = v102.last_telemetry_at - timedelta(minutes=25) if med102 and v102.last_telemetry_at > med102.created_at else v102.last_telemetry_at
        timeline.append({
            "id": "evt-gps",
            "timestamp": tel_time.isoformat(),
            "time_str": tel_time.strftime("%H:%M"),
            "title": "Vehicle GPS Tracking Active (SIMULATED TELEMETRY)",
            "category": "TELEMETRY",
            "description": f"Vehicle V-102 active at Jorabat Gateway. Heading 165° toward Shillong at {v102.speed_kmh} km/h.",
            "source": "GPS Telemetry Receiver (SIMULATED)",
            "status": "COMPLETED",
            "badge_color": "blue"
        })

    # 3. Weather / rainfall surge
    w_rec = db.query(WeatherRecord).filter(WeatherRecord.location_name.in_(["Shillong", "Guwahati"])).order_by(WeatherRecord.recorded_at.desc()).first()
    if w_rec and w_rec.rainfall_mm_hr > 30:
        timeline.append({
            "id": "evt-weather",
            "timestamp": w_rec.recorded_at.isoformat(),
            "time_str": w_rec.recorded_at.strftime("%H:%M"),
            "title": f"Extreme Weather Surge: {w_rec.condition}",
            "category": "WEATHER",
            "description": f"Precipitation surged to {w_rec.rainfall_mm_hr} mm/hr over Meghalaya / GS Road sector.",
            "source": "Open-Meteo Live API",
            "status": "COMPLETED",
            "badge_color": "orange"
        })

    # 4. Disruption Incident
    inc = db.query(Incident).filter(Incident.location_name.ilike("%Nongpoh%")).order_by(Incident.created_at.desc()).first()
    if inc:
        timeline.append({
            "id": f"evt-inc-{inc.id}",
            "timestamp": inc.created_at.isoformat(),
            "time_str": inc.created_at.strftime("%H:%M"),
            "title": f"Disruption Detected: {inc.incident_type} at {inc.location_name}",
            "category": "INCIDENT",
            "description": inc.description,
            "source": "Incident Detection Engine",
            "status": "CRITICAL",
            "badge_color": "red"
        })

    # 5. Field Report Confirmation
    fr = db.query(FieldReport).filter(FieldReport.location_name.ilike("%Nongpoh%")).order_by(FieldReport.reported_at.desc()).first()
    if fr:
        timeline.append({
            "id": f"evt-fr-{fr.id}",
            "timestamp": fr.reported_at.isoformat(),
            "time_str": fr.reported_at.strftime("%H:%M"),
            "title": "Field Officer Geo-Tagged Verification Synced",
            "category": "FIELD_REPORT",
            "description": f"Field report {fr.report_code} confirmed road blockage with geo-tagged evidence. Status: {fr.sync_status}.",
            "source": "Offline Field Reporting App (Phase 4)",
            "status": "VERIFIED",
            "badge_color": "purple"
        })

    # 6. Route Decision (Rerouting)
    rdec = db.query(RouteDecision).filter(RouteDecision.corridor_code == "COR-NH40").order_by(RouteDecision.created_at.desc()).first()
    if rdec:
        timeline.append({
            "id": f"evt-rdec-{rdec.id}",
            "timestamp": rdec.created_at.isoformat(),
            "time_str": rdec.created_at.strftime("%H:%M"),
            "title": f"Deterministic Reroute Generated: {rdec.alternative_route_name}",
            "category": "REROUTE",
            "description": rdec.rationale or f"Detour via Eastern Bypass adds +{rdec.additional_distance_km} km (+{rdec.additional_time_minutes} min), avoiding blocked corridor.",
            "source": "Rerouting Engine (Phase 2)",
            "status": rdec.status,
            "badge_color": "cyan"
        })

        if rdec.approved_at:
            timeline.append({
                "id": f"evt-rdec-app-{rdec.id}",
                "timestamp": rdec.approved_at.isoformat(),
                "time_str": rdec.approved_at.strftime("%H:%M"),
                "title": f"Reroute Approved by Operator ({rdec.approved_by or 'Dispatcher'})",
                "category": "APPROVAL",
                "description": "Vehicle V-102 and shipment MED-102 updated to Route B Eastern Bypass. Alert broadcasted.",
                "source": "Command Center Control",
                "status": "APPROVED",
                "badge_color": "blue"
            })

    # 7. Delivery Arrival & Completion
    if med102 and med102.status == "DELIVERED" and med102.completed_at:
        timeline.append({
            "id": "evt-delivery-complete",
            "timestamp": med102.completed_at.isoformat(),
            "time_str": med102.completed_at.strftime("%H:%M"),
            "title": "Consignment Delivered at Shillong Civil Hospital",
            "category": "DELIVERED",
            "description": f"Vehicle V-102 reached destination. Actual delivery recorded ({med102.actual_delivery_duration_hours or 3.2} hrs transit). Consignment verified intact.",
            "source": "Hospital Consignee Gateway",
            "status": "COMPLETED",
            "badge_color": "green"
        })

    # Sort chronological
    timeline.sort(key=lambda x: x["timestamp"])
    return {
        "success": True,
        "delivery_code": "MED-102",
        "vehicle_code": "V-102",
        "events_count": len(timeline),
        "timeline": timeline
    }


@router.post("/scenario/start")
def start_master_scenario(db: Session = Depends(get_db)):
    """
    Initializes Stage 1 of the Master Scenario:
    Guwahati -> Shillong Essential Medicine Delivery on COR-NH40 under clear baseline conditions.
    """
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    seed_master_scenario_data(db)

    # 1. Ensure Corridor COR-NH40 is clear
    cor40 = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH40").first()
    if cor40:
        cor40.status = "OPEN"
        cor40.accessibility_status = "OPEN"
        cor40.accessibility_score = 94.0
        cor40.risk_level = "LOW"
        cor40.current_condition = "4-Lane Expressway clear and operational"
        cor40.weather_condition = "Clear / Light Mist"
        cor40.reason = "Normal road and bridge passage"
        cor40.estimated_delay_mins = 0
        cor40.incident_count = 0
        cor40.polyline_coords = json.dumps(PRIMARY_GUWAHATI_SHILLONG_WAYPOINTS)
        cor40.last_updated = now_dt

    # 2. Reset Vehicle V-102
    v102 = db.query(Vehicle).filter(Vehicle.vehicle_code == "V-102").first()
    if v102:
        v102.status = "IN_TRANSIT"
        v102.risk_level = "LOW"
        v102.current_lat = 26.1050  # Jorabat Gateway
        v102.current_lng = 91.8200
        v102.speed_kmh = 45.0
        v102.heading_deg = 165.0
        v102.connectivity_status = "ONLINE"
        v102.telemetry_health = "LIVE"
        v102.tracking_mode = "SIMULATION"
        v102.telemetry_source = "SIMULATED GPS TELEMETRY"
        v102.last_telemetry_at = now_dt

    # 3. Reset Delivery MED-102
    med102 = db.query(Delivery).filter(Delivery.delivery_code == "MED-102").first()
    if med102:
        med102.status = "IN_TRANSIT"
        med102.route_risk_score = 14.0
        med102.route_risk_category = "LOW"
        med102.estimated_delay_mins = 0
        med102.delay_reason = "Normal Mountain Transit Clearance"
        med102.original_eta = now_dt + timedelta(hours=2.5)
        med102.revised_eta = now_dt + timedelta(hours=2.5)
        med102.active_route_path = json.dumps(PRIMARY_GUWAHATI_SHILLONG_WAYPOINTS)
        med102.alternate_route_path = json.dumps(ALTERNATE_GUWAHATI_SHILLONG_WAYPOINTS)
        med102.completed_at = None
        med102.actual_delivery_duration_hours = None
        med102.created_at = now_dt - timedelta(minutes=30)

    # 4. Clean up any previous Nongpoh incidents or decisions
    db.query(Incident).filter(Incident.location_name.ilike("%Nongpoh%")).delete()
    db.query(FieldReport).filter(FieldReport.location_name.ilike("%Nongpoh%")).delete()
    db.query(RouteDecision).filter(RouteDecision.corridor_code == "COR-NH40").delete()
    db.query(Alert).filter(Alert.corridor_code == "COR-NH40").delete()

    # Reset weather for Shillong and Guwahati to clear baseline
    shillong_w = db.query(WeatherRecord).filter(WeatherRecord.location_name == "Shillong").first()
    if shillong_w:
        shillong_w.rainfall_mm_hr = 0.0
        shillong_w.condition = "Clear / Light Mist"
        shillong_w.temperature_c = 21.0
        shillong_w.wind_kmh = 10.0

    guwahati_w = db.query(WeatherRecord).filter(WeatherRecord.location_name == "Guwahati").first()
    if guwahati_w:
        guwahati_w.rainfall_mm_hr = 0.0
        guwahati_w.condition = "Partly Cloudy"
        guwahati_w.temperature_c = 28.0
        guwahati_w.wind_kmh = 8.0

    # Reset traffic record for COR-NH40 to low/clear baseline
    cor40_traffic = db.query(TrafficRecord).filter(TrafficRecord.corridor_code == "COR-NH40").first()
    if cor40_traffic:
        cor40_traffic.congestion_level = "LOW"
        cor40_traffic.congestion_index = 0.15
        cor40_traffic.average_speed_kmh = 55.0
        cor40_traffic.traffic_delay_mins = 0
        cor40_traffic.travel_time_multiplier = 1.0

    # Reset bridges on COR-NH40
    for b in db.query(Bridge).filter(Bridge.corridor_code == "COR-NH40").all():
        b.status = "OPERATIONAL"
        b.accessibility_score = 98.0
        b.risk_level = "LOW"
        b.load_restriction_type = "No Restriction"

    AccessibilityEngine.recalculate_all_accessibility(db)

    # Ensure corridor state remains explicitly pristine after recalculation
    if cor40:
        cor40.status = "OPEN"
        cor40.accessibility_status = "OPEN"
        cor40.accessibility_score = 94.0
        cor40.risk_level = "LOW"
        cor40.reason = "Normal road and bridge passage"
        cor40.factor_summary = "Normal road and bridge passage"
        cor40.estimated_delay_mins = 0

    db.add(AuditLog(
        user_email="system_demo@linkx8.in",
        action="MASTER_SCENARIO_START",
        resource="Logistics_Workflow",
        details="Initialized Master Scenario: V-102 active carrying MED-102 Guwahati -> Shillong via COR-NH40"
    ))
    db.commit()

    scenario_payload = {
        "scenario_type": "SCENARIO_START",
        "title": "Master Scenario Initialized: Guwahati -> Shillong Delivery Active",
        "vehicle_code": "V-102",
        "delivery_code": "MED-102",
        "corridor_code": "COR-NH40",
        "timestamp": now_dt.isoformat()
    }
    AlertDeliveryService.publish_generic_event("DEMO_SCENARIO_EVENT", scenario_payload)

    return {
        "success": True,
        "step": 1,
        "message": "Master Scenario initialized. V-102 carrying MED-102 en route from Guwahati to Shillong under clear conditions.",
        "vehicle": "V-102",
        "consignment": "MED-102",
        "corridor": "COR-NH40 (OPEN, Score 94.0)",
        "eta": (now_dt + timedelta(hours=2.5)).isoformat()
    }


@router.post("/scenario/disrupt")
def disrupt_master_scenario(db: Session = Depends(get_db)):
    """
    Triggers the disruption cascade for the Master Scenario:
    1. Monsoon landslide + 72 mm/hr rain reported near Nongpoh on GS Road (COR-NH40).
    2. Corridor COR-NH40 accessibility drops to 0 (BLOCKED).
    3. Rerouting engine identifies affected vehicle V-102 and consignment MED-102.
    4. Deterministic alternative route generated (Route B via Jagiroad - Bhoirymbong / NH106).
    5. Additional distance (+36 km) and transit delay (+78 min) computed.
    6. RouteDecision stored (status=PROPOSED) and priority alert generated and broadcast.
    """
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    seed_master_scenario_data(db)

    # 1. Create blocked landslide incident on NH40 near Nongpoh
    inc = Incident(
        incident_type="LANDSLIDE",
        description="Torrential monsoon downpour triggered massive hill slope collapse blocking NH40 (GS Road) near Nongpoh Checkpoint (Km 48). Both carriageways impassable.",
        latitude=25.9000,
        longitude=91.8800,
        location_name="Nongpoh Sector (GS Road NH40)",
        district_name="Ri Bhoi",
        severity="CRITICAL",
        road_status="BLOCKED",
        reporter_name="Field Officer (Ri Bhoi Patrol)",
        is_synced=True,
        created_at=now_dt
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)

    # 2. Record Weather Spike
    w_rec = db.query(WeatherRecord).filter(WeatherRecord.location_name == "Shillong").first()
    if not w_rec:
        w_rec = WeatherRecord(location_name="Shillong", state="Meghalaya")
        db.add(w_rec)
    w_rec.temperature_c = 17.0
    w_rec.rainfall_mm_hr = 72.0
    w_rec.condition = "Torrential Monsoon Downpour"
    w_rec.wind_kmh = 45.0
    w_rec.recorded_at = now_dt

    # 3. Update Corridor COR-NH40
    cor40 = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH40").first()
    if cor40:
        cor40.status = "BLOCKED"
        cor40.accessibility_status = "BLOCKED"
        cor40.accessibility_score = 0.0
        cor40.risk_level = "CRITICAL"
        cor40.current_condition = "Impassable due to hill slope landslide at Nongpoh"
        cor40.weather_condition = "Torrential Downpour (72 mm/hr)"
        cor40.reason = "Monsoon Landslide at Nongpoh + 72 mm/hr Torrential Downpour"
        cor40.factor_summary = "Landslide blockage at Nongpoh (COR-NH40 Impassable)"
        cor40.estimated_delay_mins = 120
        cor40.incident_count = 1
        cor40.last_updated = now_dt

    # 4. Cascade regional accessibility recalculation
    AccessibilityEngine.recalculate_all_accessibility(db, source_incident=inc)

    # 5. Identify affected delivery & vehicle, calculate alternative route via ReroutingService
    med102 = db.query(Delivery).filter(Delivery.delivery_code == "MED-102").first()
    v102 = db.query(Vehicle).filter(Vehicle.vehicle_code == "V-102").first()

    decision = None
    if med102 and cor40:
        decision = ReroutingService.calculate_reroute_proposal(med102, cor40, db, incident=inc)

    # 6. Update vehicle risk status
    if v102:
        v102.risk_level = "HIGH"
        v102.status = "DELAYED"
        v102.last_updated = now_dt

    db.add(AuditLog(
        user_email="system_demo@linkx8.in",
        action="MASTER_SCENARIO_DISRUPT",
        resource="Disruption_Pipeline",
        details="Disruption cascade: COR-NH40 BLOCKED -> V-102 affected -> Route B generated (+36 km, +78 min delay)"
    ))
    db.commit()

    scenario_payload = {
        "scenario_type": "DISRUPTION_CASCADE",
        "title": "Corridor NH40 Blocked by Landslide at Nongpoh",
        "incident_id": inc.id,
        "corridor_code": "COR-NH40",
        "affected_vehicle": "V-102",
        "affected_delivery": "MED-102",
        "recommended_route": "Route B (Eastern Bypass via Jagiroad - Bhoirymbong / NH106)",
        "additional_distance_km": decision.additional_distance_km if decision else 36.0,
        "additional_delay_mins": decision.additional_time_minutes if decision else 78,
        "decision_id": decision.id if decision else None,
        "timestamp": now_dt.isoformat()
    }
    AlertDeliveryService.publish_generic_event("DEMO_SCENARIO_EVENT", scenario_payload)

    return {
        "success": True,
        "step": 2,
        "incident": {
            "id": inc.id,
            "type": inc.incident_type,
            "location": inc.location_name,
            "severity": inc.severity,
            "status": inc.road_status
        },
        "corridor_impact": {
            "corridor_code": "COR-NH40",
            "previous_status": "OPEN",
            "current_status": "BLOCKED",
            "accessibility_score": 0.0,
            "reason": cor40.reason if cor40 else "Landslide Blockage"
        },
        "affected_entities": {
            "vehicle": "V-102",
            "delivery": "MED-102",
            "cargo": med102.cargo_name if med102 else "Essential medicines"
        },
        "route_optimization": {
            "decision_code": decision.decision_code if decision else None,
            "decision_id": decision.id if decision else None,
            "original_route": decision.original_route_name if decision else "Route A (Direct GS Road - NH40)",
            "alternative_route": decision.alternative_route_name if decision else "Route B (Eastern Bypass via Jagiroad - Bhoirymbong / NH106)",
            "additional_distance_km": decision.additional_distance_km if decision else 36.0,
            "estimated_delay_mins": decision.additional_time_minutes if decision else 78,
            "original_eta": decision.original_eta.isoformat() if decision else None,
            "revised_eta": decision.new_eta.isoformat() if decision else None,
            "risk_score_before": decision.risk_score_before if decision else 82.0,
            "risk_score_after": decision.risk_score_after if decision else 28.0,
            "rationale": decision.rationale if decision else None,
            "status": decision.status if decision else "PROPOSED"
        }
    }


@router.post("/scenario/field-confirm")
def field_confirm_master_scenario(db: Session = Depends(get_db)):
    """
    Demonstrates Phase 4 Offline Field Intelligence Integration:
    1. Field Officer at Nongpoh patrol captures geo-tagged blockage report with photo evidence.
    2. Synchronized back to NER88 Central Command Center.
    3. Confirms ground truth and reinforces corridor blockage state.
    """
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    report_code = f"FR-NONGPOH-{int(now_dt.timestamp())}"

    fr = FieldReport(
        report_code=report_code,
        incident_type="LANDSLIDE",
        description="Ground inspection confirms major mudslide with fallen boulders at Km 48 near Nongpoh. Road impassable for heavy freight. Border Roads Task Force en route for clearance.",
        latitude=25.9000,
        longitude=91.8800,
        location_name="Nongpoh Checkpoint Sector (GS Road Km 48)",
        district_name="Ri Bhoi",
        severity="HIGH",
        road_status="BLOCKED",
        photo_url="/uploads/evidence/nongpoh_landslide_ground_evidence.jpg",
        sync_status="SYNCED",
        reported_at=now_dt
    )
    db.add(fr)

    # Link incident if exists
    inc = db.query(Incident).filter(Incident.location_name.ilike("%Nongpoh%")).order_by(Incident.created_at.desc()).first()
    if inc:
        inc.photo_url = fr.photo_url
        inc.description = f"{inc.description} | Verified by Field Officer ({report_code})"

    db.add(AuditLog(
        user_email="field_officer@linkx8.in",
        action="FIELD_REPORT_SYNCED",
        resource="Field_Intelligence",
        details=f"Field Report {report_code} synchronized from offline storage. Confirmed landslide blockage at Nongpoh."
    ))
    db.commit()
    db.refresh(fr)

    scenario_payload = {
        "scenario_type": "FIELD_CONFIRMED",
        "title": "Field Ground Report Synced from Low-Connectivity Zone",
        "report_code": fr.report_code,
        "location": fr.location_name,
        "sync_status": "SYNCED",
        "timestamp": now_dt.isoformat()
    }
    AlertDeliveryService.publish_generic_event("DEMO_SCENARIO_EVENT", scenario_payload)

    return {
        "success": True,
        "step": 3,
        "field_report": {
            "report_code": fr.report_code,
            "incident_type": fr.incident_type,
            "location": fr.location_name,
            "road_status": fr.road_status,
            "sync_status": fr.sync_status,
            "photo_url": fr.photo_url,
            "reported_at": fr.reported_at.isoformat()
        },
        "message": "Field Officer geo-tagged ground confirmation synchronized to Command Center."
    }


@router.post("/scenario/reroute-approve")
def approve_master_scenario_reroute(db: Session = Depends(get_db)):
    """
    Approves the proposed detour for vehicle V-102 and delivery MED-102:
    1. Updates RouteDecision status to APPROVED.
    2. Switches active path to Route B (Eastern Bypass via Jagiroad - Bhoirymbong / NH106).
    3. Updates delivery status to REROUTED and vehicle status to REROUTED.
    4. Advances vehicle position to Bhoirymbong link.
    5. Broadcasts real-time confirmation.
    """
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)

    decision = (
        db.query(RouteDecision)
        .filter(RouteDecision.corridor_code == "COR-NH40")
        .order_by(RouteDecision.created_at.desc())
        .first()
    )

    if not decision:
        # Generate proposal on the fly if disrupt wasn't called
        med102 = db.query(Delivery).filter(Delivery.delivery_code == "MED-102").first()
        cor40 = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH40").first()
        if med102 and cor40:
            decision = ReroutingService.calculate_reroute_proposal(med102, cor40, db)

    if decision:
        decision.status = "APPROVED"
        decision.approved_by = "Logistics Dispatch Officer"
        decision.approved_at = now_dt

    # Update Delivery MED-102
    med102 = db.query(Delivery).filter(Delivery.delivery_code == "MED-102").first()
    if med102:
        med102.status = "REROUTED"
        med102.active_route_path = json.dumps(ALTERNATE_GUWAHATI_SHILLONG_WAYPOINTS)
        if decision:
            med102.revised_eta = decision.new_eta
            med102.estimated_delay_mins = decision.additional_time_minutes
            med102.route_risk_score = decision.risk_score_after

    # Update Vehicle V-102
    v102 = db.query(Vehicle).filter(Vehicle.vehicle_code == "V-102").first()
    if v102:
        v102.status = "REROUTED"
        v102.risk_level = "LOW"
        # Move vehicle onto Bhoirymbong eastern bypass link
        v102.current_lat = 25.6800
        v102.current_lng = 92.0200
        v102.speed_kmh = 38.0
        v102.heading_deg = 205.0
        v102.last_telemetry_at = now_dt

    # Acknowledge or resolve blockage alert and post reroute approved alert
    alert = AlertDeliveryService.create_and_broadcast_alert(
        db=db,
        alert_type="REROUTE_APPROVED",
        title="🚚 REROUTE APPROVED: V-102 DETOUR VIA EASTERN BYPASS (NH106)",
        message="Logistics Dispatcher approved Route B detour via Jagiroad - Bhoirymbong. Consignment MED-102 transit restored. Revised delay: +78 mins.",
        severity="MEDIUM",
        location="Bhoirymbong Link (Eastern Bypass NH106)",
        recommended_action="Maintain convoy communications along bypass link.",
        corridor_code="COR-NH40",
        district_name="Ri Bhoi"
    )

    db.add(AuditLog(
        user_email="dispatcher@linkx8.in",
        action="REROUTE_DECISION_APPROVED",
        resource="RouteDecision",
        details=f"Approved Route B detour for V-102 / MED-102. New ETA: {med102.revised_eta if med102 else 'N/A'}"
    ))
    db.commit()

    scenario_payload = {
        "scenario_type": "REROUTE_APPROVED",
        "title": "Reroute Approved: V-102 Detour Active",
        "vehicle_code": "V-102",
        "delivery_code": "MED-102",
        "active_corridor": "COR-NH106-BYPASS",
        "alert_id": alert.id,
        "timestamp": now_dt.isoformat()
    }
    AlertDeliveryService.publish_generic_event("DEMO_SCENARIO_EVENT", scenario_payload)

    return {
        "success": True,
        "step": 4,
        "decision_code": decision.decision_code if decision else None,
        "status": "APPROVED",
        "active_route": "Route B (Eastern Bypass via Jagiroad - Bhoirymbong / NH106)",
        "vehicle_position": {"lat": 25.6800, "lng": 92.0200, "heading": 205.0},
        "revised_eta": med102.revised_eta.isoformat() if med102 else None,
        "message": "Detour approved. V-102 trajectory updated to Eastern Bypass on GIS Command Center."
    }


@router.post("/scenario/telemetry-advance")
def advance_master_scenario_telemetry(db: Session = Depends(get_db)):
    """
    Advances V-102 telemetry along the bypass route closer to Shillong destination.
    Demonstrates real-time GPS telemetry ingestion (Phase 3).
    """
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    v102 = db.query(Vehicle).filter(Vehicle.vehicle_code == "V-102").first()
    if not v102:
        return {"success": False, "message": "Vehicle V-102 not found."}

    # Advance to NEIGRIHMS Junction near Shillong city gate
    v102.current_lat = 25.6100
    v102.current_lng = 91.9500
    v102.speed_kmh = 40.0
    v102.heading_deg = 220.0
    v102.odometer_km = 8520.0
    v102.last_telemetry_at = now_dt

    # Log telemetry
    tlog = TelemetryLog(
        vehicle_id=v102.id,
        vehicle_code=v102.vehicle_code,
        device_id="OBD-V102-SIM",
        latitude=v102.current_lat,
        longitude=v102.current_lng,
        speed_kmh=v102.speed_kmh,
        heading_deg=v102.heading_deg,
        altitude_m=1450.0,
        odometer_km=v102.odometer_km,
        ignition_status="ON",
        battery_level_pct=94.0,
        satellites_connected=14,
        telemetry_source="SIMULATED GPS TELEMETRY",
        recorded_at=now_dt
    )
    db.add(tlog)
    db.commit()

    scenario_payload = {
        "scenario_type": "TELEMETRY_ADVANCED",
        "title": "Vehicle V-102 Advanced to NEIGRIHMS Junction",
        "vehicle_code": "V-102",
        "lat": v102.current_lat,
        "lng": v102.current_lng,
        "speed": v102.speed_kmh,
        "timestamp": now_dt.isoformat()
    }
    AlertDeliveryService.publish_generic_event("DEMO_SCENARIO_EVENT", scenario_payload)

    return {
        "success": True,
        "vehicle": "V-102",
        "location": "NEIGRIHMS Junction (Shillong Gate)",
        "lat": v102.current_lat,
        "lng": v102.current_lng,
        "speed_kmh": v102.speed_kmh
    }


@router.post("/scenario/deliver")
def complete_master_scenario_delivery(db: Session = Depends(get_db)):
    """
    Finalizes the complete logistics lifecycle (Section 15):
    1. Vehicle V-102 arrives at destination (Shillong Civil Hospital Hub).
    2. Consignment MED-102 marked DELIVERED with actual delivery duration and completed_at recorded.
    3. Operational delivery completion alert generated.
    4. Command Center status and timeline updated.
    """
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)

    v102 = db.query(Vehicle).filter(Vehicle.vehicle_code == "V-102").first()
    if v102:
        v102.current_lat = 25.5788  # Shillong Civil Hospital Hub
        v102.current_lng = 91.8933
        v102.status = "IDLE"
        v102.speed_kmh = 0.0
        v102.last_telemetry_at = now_dt

    med102 = db.query(Delivery).filter(Delivery.delivery_code == "MED-102").first()
    if med102:
        med102.status = "DELIVERED"
        med102.completed_at = now_dt
        med102.actual_delivery_duration_hours = 3.2
        med102.route_risk_score = 5.0
        med102.route_risk_category = "LOW"

    # Create completion alert
    alert = AlertDeliveryService.create_and_broadcast_alert(
        db=db,
        alert_type="DELIVERY_COMPLETED",
        title="🏥 DELIVERY COMPLETED: ESSENTIAL MEDICINES ARRIVED AT SHILLONG",
        message="Consignment MED-102 successfully delivered at Shillong Civil Hospital Hub via Eastern Bypass Detour. All 24 cryogenic cold-chain vaccine containers verified intact.",
        severity="LOW",
        location="Shillong Civil Hospital Central Pharmacy",
        recommended_action="Proceed with hospital inventory intake and cold-chain temperature verification.",
        corridor_code="COR-NH40",
        district_name="East Khasi Hills"
    )

    db.add(AuditLog(
        user_email="system_demo@linkx8.in",
        action="DELIVERY_LIFECYCLE_COMPLETED",
        resource="Consignment_MED-102",
        details="Delivery completed: V-102 reached Shillong. Status: DELIVERED. Actual duration: 3.2 hrs."
    ))
    db.commit()

    scenario_payload = {
        "scenario_type": "DELIVERY_COMPLETED",
        "title": "Consignment MED-102 Delivered at Shillong Civil Hospital",
        "vehicle_code": "V-102",
        "delivery_code": "MED-102",
        "status": "DELIVERED",
        "completed_at": now_dt.isoformat(),
        "alert_id": alert.id,
        "timestamp": now_dt.isoformat()
    }
    AlertDeliveryService.publish_generic_event("DEMO_SCENARIO_EVENT", scenario_payload)

    return {
        "success": True,
        "step": 5,
        "delivery_code": "MED-102",
        "status": "DELIVERED",
        "completed_at": now_dt.isoformat(),
        "actual_duration_hours": 3.2,
        "destination": "Shillong Civil Hospital Hub",
        "message": "Full end-to-end logistics lifecycle completed. Consignment MED-102 DELIVERED."
    }


@router.post("/scenario/reset")
def reset_master_scenario(db: Session = Depends(get_db)):
    """
    Resets the Master Scenario back to initial baseline without deleting unrelated user data.
    """
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    seed_master_scenario_data(db)

    # 1. Reset Corridor COR-NH40
    cor40 = db.query(Corridor).filter(Corridor.corridor_code == "COR-NH40").first()
    if cor40:
        cor40.status = "OPEN"
        cor40.accessibility_status = "OPEN"
        cor40.accessibility_score = 94.0
        cor40.risk_level = "LOW"
        cor40.current_condition = "4-Lane Expressway clear and operational"
        cor40.weather_condition = "Clear / Light Mist"
        cor40.reason = "Normal road and bridge passage"
        cor40.factor_summary = "Normal road and bridge passage"
        cor40.estimated_delay_mins = 0
        cor40.incident_count = 0
        cor40.polyline_coords = json.dumps(PRIMARY_GUWAHATI_SHILLONG_WAYPOINTS)
        cor40.last_updated = now_dt

    # 2. Reset Vehicle V-102
    v102 = db.query(Vehicle).filter(Vehicle.vehicle_code == "V-102").first()
    if v102:
        v102.status = "IN_TRANSIT"
        v102.risk_level = "LOW"
        v102.current_lat = 26.1050
        v102.current_lng = 91.8200
        v102.speed_kmh = 45.0
        v102.heading_deg = 165.0
        v102.tracking_mode = "SIMULATION"
        v102.telemetry_source = "SIMULATED GPS TELEMETRY"
        v102.last_telemetry_at = now_dt

    # 3. Reset Delivery MED-102
    med102 = db.query(Delivery).filter(Delivery.delivery_code == "MED-102").first()
    if med102:
        med102.status = "IN_TRANSIT"
        med102.route_risk_score = 14.0
        med102.route_risk_category = "LOW"
        med102.estimated_delay_mins = 0
        med102.delay_reason = "Normal Mountain Transit Clearance"
        med102.original_eta = now_dt + timedelta(hours=2.5)
        med102.revised_eta = now_dt + timedelta(hours=2.5)
        med102.active_route_path = json.dumps(PRIMARY_GUWAHATI_SHILLONG_WAYPOINTS)
        med102.alternate_route_path = json.dumps(ALTERNATE_GUWAHATI_SHILLONG_WAYPOINTS)
        med102.completed_at = None
        med102.actual_delivery_duration_hours = None

    # 4. Remove scenario-specific records
    db.query(Incident).filter(Incident.location_name.ilike("%Nongpoh%")).delete()
    db.query(FieldReport).filter(FieldReport.location_name.ilike("%Nongpoh%")).delete()
    db.query(RouteDecision).filter(RouteDecision.corridor_code == "COR-NH40").delete()
    db.query(Alert).filter(Alert.corridor_code == "COR-NH40").delete()

    # Reset weather for Shillong and Guwahati to clear baseline
    shillong_w = db.query(WeatherRecord).filter(WeatherRecord.location_name == "Shillong").first()
    if shillong_w:
        shillong_w.rainfall_mm_hr = 0.0
        shillong_w.condition = "Clear / Light Mist"
        shillong_w.temperature_c = 21.0
        shillong_w.wind_kmh = 10.0

    guwahati_w = db.query(WeatherRecord).filter(WeatherRecord.location_name == "Guwahati").first()
    if guwahati_w:
        guwahati_w.rainfall_mm_hr = 0.0
        guwahati_w.condition = "Partly Cloudy"
        guwahati_w.temperature_c = 28.0
        guwahati_w.wind_kmh = 8.0

    # Reset traffic record for COR-NH40 to low/clear baseline
    cor40_traffic = db.query(TrafficRecord).filter(TrafficRecord.corridor_code == "COR-NH40").first()
    if cor40_traffic:
        cor40_traffic.congestion_level = "LOW"
        cor40_traffic.congestion_index = 0.15
        cor40_traffic.average_speed_kmh = 55.0
        cor40_traffic.traffic_delay_mins = 0
        cor40_traffic.travel_time_multiplier = 1.0

    # Reset bridges on COR-NH40
    for b in db.query(Bridge).filter(Bridge.corridor_code == "COR-NH40").all():
        b.status = "OPERATIONAL"
        b.accessibility_score = 98.0
        b.risk_level = "LOW"
        b.load_restriction_type = "No Restriction"

    AccessibilityEngine.recalculate_all_accessibility(db)

    # Ensure corridor state remains explicitly pristine after recalculation
    if cor40:
        cor40.status = "OPEN"
        cor40.accessibility_status = "OPEN"
        cor40.accessibility_score = 94.0
        cor40.risk_level = "LOW"
        cor40.reason = "Normal road and bridge passage"
        cor40.factor_summary = "Normal road and bridge passage"
        cor40.estimated_delay_mins = 0

    db.add(AuditLog(
        user_email="system_demo@linkx8.in",
        action="MASTER_SCENARIO_RESET",
        resource="Logistics_Workflow",
        details="Reset Master Demonstration Scenario to initial clear baseline"
    ))
    db.commit()

    AlertDeliveryService.publish_generic_event("DEMO_SCENARIO_EVENT", {
        "scenario_type": "RESET",
        "title": "Master Demonstration Scenario Reset to Clear Baseline",
        "timestamp": now_dt.isoformat()
    })

    return {"success": True, "message": "Master Scenario successfully reset to baseline."}

