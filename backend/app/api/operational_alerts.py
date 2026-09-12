"""
Operational Automated Alerts API Router
GAP 18 — Automated Blocked-Road Alerts
GAP 19 — Inaccessible-Region Alerts
GAP 20 — Delayed-Delivery Alerts

Endpoints:
  GET  /api/v1/operational-alerts/status           — Gap status & configuration
  GET  /api/v1/operational-alerts/configuration     — Alert thresholds & rules
  GET  /api/v1/operational-alerts/active            — All currently active operational alerts
  POST /api/v1/operational-alerts/{alert_id}/resolve — Explicit alert resolution
  POST /api/v1/operational-alerts/demo-scenario      — End-to-end demo (SIMULATED)
  GET  /api/v1/operational-alerts/demo-scenario/status — Demo state description
"""

import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.models import (
    Alert, Corridor, District, Incident, Bridge, Delivery, Vehicle, AuditLog
)
from app.schemas.schemas import AlertOut, AlertAcknowledgeIn
from app.services.accessibility_service import AccessibilityEngine
from app.services.operational_alerts_service import (
    BlockedRoadAlertService,
    InaccessibleRegionAlertService,
    DelayedDeliveryAlertService,
    resolve_alert,
    ALERT_CONFIGURATION,
    BLOCKED_ROAD_STATUS_VALUES,
    INACCESSIBLE_REGION_THRESHOLD,
    DELIVERY_DELAY_THRESHOLD_MINS
)

router = APIRouter(
    prefix="/operational-alerts",
    tags=["Operational Alerts — Gaps 18, 19, 20"]
)


# ─────────────────────────────────────────────────────────────
# STATUS
# ─────────────────────────────────────────────────────────────

@router.get("/status")
def get_operational_alerts_status(db: Session = Depends(get_db)):
    """
    Returns implementation status for Gaps 18, 19, 20 and current alert counts.
    """
    active_blocked = db.query(Alert).filter(
        Alert.alert_type == "BLOCKED_ROAD",
        Alert.status != "RESOLVED"
    ).count()

    active_inaccessible = db.query(Alert).filter(
        Alert.alert_type == "INACCESSIBLE_REGION",
        Alert.status != "RESOLVED"
    ).count()

    active_delay = db.query(Alert).filter(
        Alert.alert_type == "DELIVERY_DELAY_WARNING",
        Alert.status != "RESOLVED"
    ).count()

    blocked_corridors = db.query(Corridor).filter(
        Corridor.status.in_(["BLOCKED", "CLOSED"])
    ).count()

    critical_districts = db.query(District).filter(
        District.accessibility_index < INACCESSIBLE_REGION_THRESHOLD
    ).count()

    delayed_deliveries = db.query(Delivery).filter(
        Delivery.estimated_delay_mins >= DELIVERY_DELAY_THRESHOLD_MINS
    ).count()

    return {
        "gap18_blocked_road_alerts": {
            "status": "OPERATIONAL",
            "description": "Automatically generated when corridor.status becomes BLOCKED/CLOSED",
            "trigger": f"corridor.status in {list(BLOCKED_ROAD_STATUS_VALUES)} OR accessibility_score == 0",
            "active_alerts": active_blocked,
            "currently_blocked_corridors": blocked_corridors
        },
        "gap19_inaccessible_region_alerts": {
            "status": "OPERATIONAL",
            "description": "Automatically generated when district.accessibility_index < threshold",
            "trigger": f"district.accessibility_index < {INACCESSIBLE_REGION_THRESHOLD}",
            "threshold": INACCESSIBLE_REGION_THRESHOLD,
            "active_alerts": active_inaccessible,
            "currently_critical_districts": critical_districts
        },
        "gap20_delayed_delivery_alerts": {
            "status": "OPERATIONAL",
            "description": "Generated when delivery delay exceeds configured threshold",
            "trigger": f"estimated_delay_mins >= {DELIVERY_DELAY_THRESHOLD_MINS}",
            "threshold_mins": DELIVERY_DELAY_THRESHOLD_MINS,
            "active_alerts": active_delay,
            "currently_delayed_deliveries": delayed_deliveries
        },
        "alert_lifecycle": ["NEW", "SEEN", "ACKNOWLEDGED", "RESOLVED"],
        "delivery_method": "SSE (Server-Sent Events) real-time stream at /api/v1/alerts/stream",
        "deduplication": "One active alert per corridor/district/delivery — no repeated alerts for unchanged conditions",
        "resolution": "Auto-resolved when underlying condition clears; manual resolution via POST /{alert_id}/resolve"
    }


@router.get("/configuration")
def get_alert_configuration(db: Session = Depends(get_db)):
    """
    Returns the documented, configurable alert threshold rules for Gaps 18-20.
    """
    # Check if threshold is overridden by SystemSettings
    from app.models.models import SystemSettings
    threshold_setting = db.query(SystemSettings).filter(
        SystemSettings.setting_key == "DELAY_ALERT_THRESHOLD_MINS"
    ).first()

    config = dict(ALERT_CONFIGURATION)
    if threshold_setting:
        config["gap20_delayed_delivery"]["effective_threshold_mins"] = int(threshold_setting.setting_value)
        config["gap20_delayed_delivery"]["source"] = "SystemSettings override"
    else:
        config["gap20_delayed_delivery"]["effective_threshold_mins"] = DELIVERY_DELAY_THRESHOLD_MINS
        config["gap20_delayed_delivery"]["source"] = "Default (eta_service.DELAY_ALERT_THRESHOLD_MINS)"

    config["_note"] = (
        "To change the delay threshold: POST /api/v1/settings with "
        "setting_key='DELAY_ALERT_THRESHOLD_MINS' and setting_value='<minutes>'"
    )
    return config


# ─────────────────────────────────────────────────────────────
# ACTIVE ALERTS (filtered view)
# ─────────────────────────────────────────────────────────────

@router.get("/active", response_model=List[AlertOut])
def get_active_operational_alerts(
    alert_type: Optional[str] = Query(None, description="BLOCKED_ROAD | INACCESSIBLE_REGION | DELIVERY_DELAY_WARNING"),
    severity: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns all currently active (non-RESOLVED) operational alerts for Gaps 18-20.
    """
    query = db.query(Alert).filter(
        Alert.alert_type.in_(["BLOCKED_ROAD", "INACCESSIBLE_REGION", "DELIVERY_DELAY_WARNING"]),
        Alert.status != "RESOLVED"
    )
    if alert_type:
        query = query.filter(Alert.alert_type == alert_type.upper())
    if severity:
        query = query.filter(Alert.severity == severity.upper())
    return query.order_by(Alert.created_at.desc()).all()


# ─────────────────────────────────────────────────────────────
# ALERT RESOLUTION
# ─────────────────────────────────────────────────────────────

@router.post("/{alert_id}/resolve", response_model=AlertOut)
def resolve_operational_alert(
    alert_id: int,
    payload: AlertAcknowledgeIn = AlertAcknowledgeIn(),
    db: Session = Depends(get_db)
):
    """
    Explicitly marks an alert as RESOLVED.
    Use when: the underlying condition has been corrected (road cleared, district accessible again, delivery recovered).
    Distinct from ACKNOWLEDGED — resolution means the problem is fixed.
    """
    try:
        return resolve_alert(
            alert_id=alert_id,
            resolved_by=payload.acknowledged_by or "Regional Dispatcher",
            db=db
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─────────────────────────────────────────────────────────────
# END-TO-END DEMO SCENARIO (SIMULATED — clearly labelled)
# ─────────────────────────────────────────────────────────────

@router.get("/demo-scenario/status")
def get_demo_scenario_description():
    """
    Describes what the demo-scenario endpoint will demonstrate without executing it.
    """
    return {
        "scenario": "LINK X8 End-to-End Operational Alert Demo",
        "data_label": "SIMULATED — All events are synthetic for demonstration purposes",
        "flow": [
            "1. A LANDSLIDE incident is reported on NH27 corridor (Senapati district)",
            "2. AccessibilityEngine.recalculate_all_accessibility() runs the full cascade",
            "3. COR-NH27 corridor accessibility drops to 0 → status becomes BLOCKED",
            "4. GAP 18: BLOCKED_ROAD alert created for COR-NH27, broadcast via SSE",
            "5. Senapati district accessibility_index drops below threshold (30)",
            "6. GAP 19: INACCESSIBLE_REGION alert created for Senapati, broadcast via SSE",
            "7. Active IN_TRANSIT delivery via COR-NH27 gets ETA recalculated",
            "8. Delivery.estimated_delay_mins exceeds 45-minute threshold",
            "9. GAP 20: DELIVERY_DELAY_WARNING alert created for delivery, broadcast via SSE",
            "10. All 3 alerts visible at GET /api/v1/alerts (filter by type or All)",
            "11. Dispatcher acknowledges alerts via POST /api/v1/alerts/{id}/acknowledge",
            "12. Demo cleanup: incident removed, corridor recovered, alerts resolved"
        ],
        "endpoints_to_observe": [
            "GET /api/v1/alerts — all operational alerts",
            "GET /api/v1/operational-alerts/active — Gap 18/19/20 alerts",
            "GET /api/v1/alerts/stream — live SSE stream",
            "GET /api/v1/corridors — corridor statuses",
            "GET /api/v1/districts — district accessibility",
            "GET /api/v1/deliveries — delivery delays"
        ]
    }


@router.post("/demo-scenario")
def trigger_demo_scenario(db: Session = Depends(get_db)):
    """
    Triggers a complete SIMULATED end-to-end demonstration of Gaps 18, 19, and 20.

    ⚠️ DATA: All events are SIMULATED/DEMO. No real road is being blocked.
             Do not present this as a live operational event.

    Flow:
      1. Simulated LANDSLIDE incident on COR-NH27 (Senapati → accessibility drops)
      2. AccessibilityEngine recalculation cascade
      3. GAP 18: BLOCKED_ROAD alert for COR-NH27
      4. GAP 19: INACCESSIBLE_REGION alert for affected district
      5. GAP 20: DELIVERY_DELAY_WARNING for active delivery on route
    """
    results = {
        "scenario": "LINK X8 Gaps 18-19-20 End-to-End Demo",
        "data_label": "SIMULATED — Not a live operational event",
        "timestamp": datetime.utcnow().isoformat(),
        "steps": []
    }

    # ─── STEP 1: Create a simulated LANDSLIDE incident on NH27 ───
    existing_demo = db.query(Incident).filter(
        Incident.description.ilike("%DEMO-SCENARIO-18-19-20%")
    ).first()

    if existing_demo:
        demo_incident = existing_demo
        results["steps"].append({
            "step": 1,
            "action": "SIMULATED INCIDENT",
            "result": f"Reusing existing demo incident #{demo_incident.id} at {demo_incident.location_name}",
            "data_label": "SIMULATED"
        })
    else:
        demo_incident = Incident(
            incident_type="LANDSLIDE",
            description="[DEMO-SCENARIO-18-19-20] Simulated landslide blocking NH27 near Senapati for demonstration of Gaps 18, 19, 20. NOT A REAL EVENT.",
            latitude=25.2747,
            longitude=93.9348,
            location_name="Senapati (NH27 Demo Block)",
            district_name="Senapati",
            severity="CRITICAL",
            road_status="BLOCKED",
            reporter_name="Demo System (SIMULATED)",
            is_synced=True
        )
        db.add(demo_incident)
        db.commit()
        db.refresh(demo_incident)
        results["steps"].append({
            "step": 1,
            "action": "SIMULATED INCIDENT CREATED",
            "incident_id": demo_incident.id,
            "type": "LANDSLIDE",
            "location": "Senapati (NH27)",
            "severity": "CRITICAL",
            "road_status": "BLOCKED",
            "data_label": "SIMULATED"
        })

    # ─── STEP 2: Trigger full AccessibilityEngine cascade ───
    cascade_result = AccessibilityEngine.recalculate_all_accessibility(db, source_incident=demo_incident)
    db.commit()  # commit alerts from hooks
    results["steps"].append({
        "step": 2,
        "action": "ACCESSIBILITY CASCADE RECALCULATION",
        "result": cascade_result
    })

    # ─── STEP 3: Capture BLOCKED_ROAD alerts ───
    blocked_alerts = db.query(Alert).filter(
        Alert.alert_type == "BLOCKED_ROAD",
        Alert.status != "RESOLVED"
    ).order_by(Alert.created_at.desc()).limit(5).all()

    results["steps"].append({
        "step": 3,
        "action": "GAP 18 — BLOCKED_ROAD ALERTS",
        "alert_count": len(blocked_alerts),
        "alerts": [
            {
                "id": a.id,
                "title": a.title,
                "severity": a.severity,
                "corridor_code": a.corridor_code,
                "location": a.location,
                "status": a.status
            }
            for a in blocked_alerts
        ]
    })

    # ─── STEP 4: Capture INACCESSIBLE_REGION alerts ───
    region_alerts = db.query(Alert).filter(
        Alert.alert_type == "INACCESSIBLE_REGION",
        Alert.status != "RESOLVED"
    ).order_by(Alert.created_at.desc()).limit(5).all()

    results["steps"].append({
        "step": 4,
        "action": "GAP 19 — INACCESSIBLE_REGION ALERTS",
        "alert_count": len(region_alerts),
        "inaccessible_threshold": INACCESSIBLE_REGION_THRESHOLD,
        "alerts": [
            {
                "id": a.id,
                "title": a.title,
                "severity": a.severity,
                "district_name": a.district_name,
                "location": a.location,
                "status": a.status
            }
            for a in region_alerts
        ]
    })

    # ─── STEP 5: Trigger GAP 20 — find active delivery and update ETA ───
    # Find or create a delivery to demonstrate delay
    delivery = db.query(Delivery).filter(
        Delivery.status == "IN_TRANSIT",
        Delivery.destination_city.ilike("%Imphal%")
    ).first()

    if not delivery:
        delivery = db.query(Delivery).filter(
            Delivery.status.in_(["IN_TRANSIT", "DISPATCHED", "LOADED"])
        ).first()

    delay_alert_result = {"message": "No IN_TRANSIT delivery found for delay demo"}
    if delivery:
        from app.services.eta_service import ETAService
        eta_result = ETAService.update_delivery_live_eta(
            delivery=delivery,
            current_lat=delivery.vehicle.current_lat if delivery.vehicle else 25.5,
            current_lng=delivery.vehicle.current_lng if delivery.vehicle else 93.8,
            db=db
        )
        db.commit()

        delay_alerts = db.query(Alert).filter(
            Alert.alert_type == "DELIVERY_DELAY_WARNING",
            Alert.delivery_id == delivery.id,
            Alert.status != "RESOLVED"
        ).all()

        delay_alert_result = {
            "delivery_id": delivery.id,
            "delivery_code": delivery.delivery_code,
            "cargo": delivery.cargo_name,
            "cargo_category": delivery.cargo_category,
            "estimated_delay_mins": eta_result.estimated_delay_mins,
            "delay_threshold_mins": DELIVERY_DELAY_THRESHOLD_MINS,
            "delay_alert_active": eta_result.delay_alert_active,
            "delay_reason": eta_result.delay_reason,
            "original_eta": eta_result.base_eta.isoformat() if eta_result.base_eta else None,
            "revised_eta": eta_result.revised_eta.isoformat() if eta_result.revised_eta else None,
            "active_delay_alerts": [{"id": a.id, "title": a.title, "severity": a.severity} for a in delay_alerts]
        }

    results["steps"].append({
        "step": 5,
        "action": "GAP 20 — DELIVERY_DELAY_WARNING",
        "result": delay_alert_result
    })

    # ─── SUMMARY ───
    total_operational_alerts = len(blocked_alerts) + len(region_alerts)
    delay_alerts_count = len(delay_alert_result.get("active_delay_alerts", [])) if isinstance(delay_alert_result, dict) else 0

    results["summary"] = {
        "gap18_blocked_road_alerts_active": len(blocked_alerts),
        "gap19_inaccessible_region_alerts_active": len(region_alerts),
        "gap20_delivery_delay_alerts_active": delay_alerts_count,
        "total_new_operational_alerts": total_operational_alerts + delay_alerts_count,
        "next_steps": [
            "View alerts: GET /api/v1/alerts?alert_type=BLOCKED_ROAD",
            "View alerts: GET /api/v1/alerts?alert_type=INACCESSIBLE_REGION",
            "View alerts: GET /api/v1/alerts?alert_type=DELIVERY_DELAY_WARNING",
            "Acknowledge: POST /api/v1/alerts/{alert_id}/acknowledge",
            "Resolve: POST /api/v1/operational-alerts/{alert_id}/resolve",
            "View active: GET /api/v1/operational-alerts/active",
            "Evaluate alternate route: POST /api/v1/routes/analyze (multi-candidate routing)"
        ],
        "data_label": "SIMULATED — All events are synthetic for demonstration purposes"
    }

    db.add(AuditLog(
        user_email="dispatcher@linkx8.in",
        action="DEMO_SCENARIO_18_19_20",
        resource="OperationalAlerts",
        details=f"Demo triggered. Blocked-road alerts: {len(blocked_alerts)}, Region alerts: {len(region_alerts)}, Delay alerts: {delay_alerts_count}"
    ))
    db.commit()

    return results


@router.delete("/demo-scenario/cleanup")
def cleanup_demo_scenario(db: Session = Depends(get_db)):
    """
    Cleans up the demo scenario:
    - Removes the simulated LANDSLIDE incident
    - Recalculates accessibility (corridors/districts recover)
    - Resolves all demo-triggered alerts

    Data label: SIMULATED — cleanup of demo data only.
    """
    # Remove demo incident
    demo_incidents = db.query(Incident).filter(
        Incident.description.ilike("%DEMO-SCENARIO-18-19-20%")
    ).all()
    removed_ids = []
    for inc in demo_incidents:
        removed_ids.append(inc.id)
        db.delete(inc)
    db.commit()

    # Recalculate (should recover corridors/districts)
    cascade = AccessibilityEngine.recalculate_all_accessibility(db)
    db.commit()

    # Resolve any remaining demo alerts
    demo_alerts = db.query(Alert).filter(
        Alert.alert_type.in_(["BLOCKED_ROAD", "INACCESSIBLE_REGION"]),
        Alert.status != "RESOLVED"
    ).all()
    resolved_alert_ids = []
    for alert in demo_alerts:
        alert.status = "RESOLVED"
        alert.resolved_at = datetime.utcnow()
        resolved_alert_ids.append(alert.id)
    db.commit()

    return {
        "status": "DEMO_CLEANED_UP",
        "removed_incident_ids": removed_ids,
        "accessibility_recalculated": True,
        "resolved_alert_ids": resolved_alert_ids,
        "cascade_result": cascade
    }
