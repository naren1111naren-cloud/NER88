import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import Incident, Alert, Delivery, Vehicle, AuditLog, Corridor, District, Bridge, WeatherRecord
from app.services.routing_service import RoutingService, PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS, ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS
from app.services.accessibility_service import AccessibilityEngine
from app.services.alert_delivery_service import AlertDeliveryService

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
