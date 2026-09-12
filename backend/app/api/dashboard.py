from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import Vehicle, Delivery, Incident, Alert, Corridor, District, SystemSettings, Bridge
from app.services.accessibility_service import AccessibilityEngine

router = APIRouter(prefix="/dashboard", tags=["Dashboard Summary"])

from datetime import datetime

@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    AccessibilityEngine.recalculate_all_accessibility(db)

    # Vehicles breakdown
    total_vehicles = db.query(Vehicle).count()
    online_vehicles = db.query(Vehicle).filter(Vehicle.telemetry_health == "LIVE").count()
    offline_vehicles = total_vehicles - online_vehicles
    active_vehicles = total_vehicles

    # Deliveries breakdown
    active_deliveries = db.query(Delivery).filter(Delivery.status.in_(["IN_TRANSIT", "ASSIGNED", "PENDING", "DELAYED", "REROUTED"])).count()
    in_transit_deliveries = db.query(Delivery).filter(Delivery.status.in_(["IN_TRANSIT", "REROUTED"])).count()
    delayed_deliveries = db.query(Delivery).filter((Delivery.estimated_delay_mins > 0) | (Delivery.status == "DELAYED")).count()
    high_risk_routes = db.query(Delivery).filter(Delivery.route_risk_category.in_(["HIGH", "CRITICAL"])).count()
    emergency_shipments = db.query(Delivery).filter(Delivery.priority == "EMERGENCY").count()

    # Incidents breakdown
    critical_incidents = db.query(Incident).filter(Incident.severity == "CRITICAL").count()
    high_incidents = db.query(Incident).filter(Incident.severity.in_(["HIGH", "CRITICAL"])).count()
    blocked_roads = db.query(Incident).filter(Incident.road_status.in_(["BLOCKED", "CLOSED"])).count()

    # Bridges breakdown
    bridges = db.query(Bridge).all()
    operational_bridges = sum(1 for b in bridges if b.status == "OPERATIONAL")
    restricted_bridges = sum(1 for b in bridges if b.status in ["RESTRICTED", "DAMAGED"])
    closed_bridges = sum(1 for b in bridges if b.status == "CLOSED")

    recent_incidents = db.query(Incident).order_by(Incident.created_at.desc()).limit(5).all()
    priority_alerts = db.query(Alert).filter(Alert.is_read == False).order_by(Alert.created_at.desc()).limit(5).all()

    # Corridors & Districts
    corridors = db.query(Corridor).all()
    blocked_corridors = sum(1 for c in corridors if c.status in ["BLOCKED", "CLOSED"])
    districts = db.query(District).all()

    emergency_setting = db.query(SystemSettings).filter(SystemSettings.setting_key == "EMERGENCY_OPERATIONS_MODE").first()
    is_emergency_mode = emergency_setting.setting_value.lower() == "true" if emergency_setting else False

    # Risk Distribution breakdown
    low_risk = db.query(Delivery).filter(Delivery.route_risk_category == "LOW").count()
    med_risk = db.query(Delivery).filter(Delivery.route_risk_category == "MEDIUM").count()
    high_risk = db.query(Delivery).filter(Delivery.route_risk_category == "HIGH").count()
    crit_risk = db.query(Delivery).filter(Delivery.route_risk_category == "CRITICAL").count()

    return {
        "kpi": {
            "active_vehicles": active_vehicles,
            "total_vehicles": total_vehicles,
            "online_vehicles": online_vehicles,
            "offline_vehicles": offline_vehicles,
            "active_deliveries": active_deliveries,
            "in_transit_deliveries": in_transit_deliveries,
            "delayed_deliveries": delayed_deliveries,
            "high_risk_routes": high_risk_routes,
            "critical_incidents": critical_incidents,
            "total_incidents": high_incidents,
            "blocked_roads": blocked_roads,
            "blocked_corridors": blocked_corridors,
            "emergency_shipments": emergency_shipments,
            "total_bridges": len(bridges),
            "operational_bridges": operational_bridges,
            "restricted_bridges": restricted_bridges,
            "closed_bridges": closed_bridges,
            "total_districts": len(districts),
            "total_corridors": len(corridors)
        },
        "emergency_operations_mode": is_emergency_mode,
        "risk_distribution": [
            {"category": "LOW", "count": low_risk, "color": "#10B981"},
            {"category": "MEDIUM", "count": med_risk, "color": "#F59E0B"},
            {"category": "HIGH", "count": high_risk, "color": "#F97316"},
            {"category": "CRITICAL", "count": crit_risk, "color": "#EF4444"}
        ],
        "sources": {
            "vehicles": "DATABASE + LIVE_GPS",
            "deliveries": "DATABASE",
            "bridges": "DATABASE",
            "incidents": "FIELD_GENERATED",
            "corridors": "CALCULATED",
            "districts": "CALCULATED",
            "weather": "LIVE_OPEN_METEO"
        },
        "updated_at": datetime.utcnow().isoformat(),
        "corridors": corridors,
        "bridges": bridges,
        "districts": districts,
        "recent_incidents": recent_incidents,
        "priority_alerts": priority_alerts
    }

@router.post("/emergency-mode/toggle")
def toggle_emergency_mode(db: Session = Depends(get_db)):
    setting = db.query(SystemSettings).filter(SystemSettings.setting_key == "EMERGENCY_OPERATIONS_MODE").first()
    if not setting:
        setting = SystemSettings(setting_key="EMERGENCY_OPERATIONS_MODE", setting_value="true", description="System-wide Emergency Mode")
        db.add(setting)
    else:
        new_val = "false" if setting.setting_value.lower() == "true" else "true"
        setting.setting_value = new_val
    db.commit()
    return {"success": True, "emergency_operations_mode": setting.setting_value.lower() == "true"}
