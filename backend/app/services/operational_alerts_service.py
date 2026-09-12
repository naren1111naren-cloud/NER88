"""
Operational Automated Alert Intelligence Service
GAP 18 — Automated Blocked-Road Alerts
GAP 19 — Inaccessible-Region Alerts
GAP 20 — Delayed-Delivery Alerts

Connects the existing intelligence pipeline to the alert lifecycle:

  Road Incident / Bridge Closure
    → AccessibilityEngine.recalculate_all_accessibility()
    → BlockedRoadAlertService  (Gap 18)
    → InaccessibleRegionAlertService (Gap 19)

  Telemetry → ETAService.update_delivery_live_eta()
    → DelayedDeliveryAlertService (Gap 20)

DESIGN PRINCIPLES:
- Reuses existing Alert model, AlertDeliveryService, SSE stream
- Does NOT duplicate AccessibilityEngine, ETAService, or routing logic
- Deduplication: one active BLOCKED_ROAD alert per corridor/incident,
  one INACCESSIBLE_REGION per district, one DELIVERY_DELAY_WARNING per delivery
- Clear lifecycle: NEW → ACKNOWLEDGED → RESOLVED
- Clearly labels DEMO data as SIMULATED
"""

import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.models.models import Alert, Corridor, District, Delivery, Incident, AuditLog
from app.services.alert_delivery_service import AlertDeliveryService

logger = logging.getLogger("link_x8.operational_alerts")

# ─────────────────────────────────────────────────────────────
# CONFIGURABLE THRESHOLDS (documented, overridable via SystemSettings)
# ─────────────────────────────────────────────────────────────

# GAP 18: corridor accessibility score below which BLOCKED_ROAD alert fires
BLOCKED_ROAD_ALERT_SCORE_THRESHOLD = 0.0   # Only when score == 0 (BLOCKED status)
BLOCKED_ROAD_STATUS_VALUES = {"BLOCKED", "CLOSED"}

# GAP 19: district accessibility index below which INACCESSIBLE_REGION alert fires
INACCESSIBLE_REGION_THRESHOLD = 30.0  # 0-100 scale; score < 30 = critical
INACCESSIBLE_REGION_STATUSES = {"Severely Inaccessible (0-24)", "Poor (25-49)"}

# GAP 20: delay in minutes above which DELIVERY_DELAY_WARNING fires
# Source of truth: DELAY_ALERT_THRESHOLD_MINS in eta_service.py (currently 45)
# Imported here for shared visibility
from app.services.eta_service import DELAY_ALERT_THRESHOLD_MINS as DELIVERY_DELAY_THRESHOLD_MINS


def _alert_dict(alert: Alert) -> Dict[str, Any]:
    """Serializes an Alert for SSE broadcast."""
    return {
        "id": alert.id,
        "alert_type": alert.alert_type,
        "title": alert.title,
        "message": alert.message,
        "severity": alert.severity,
        "location": alert.location,
        "recommended_action": alert.recommended_action,
        "delivery_id": alert.delivery_id,
        "vehicle_id": alert.vehicle_id,
        "source_incident_id": alert.source_incident_id,
        "corridor_code": alert.corridor_code,
        "district_name": alert.district_name,
        "is_read": alert.is_read,
        "status": alert.status,
        "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
        "acknowledged_by": alert.acknowledged_by,
        "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
        "created_at": alert.created_at.isoformat() if alert.created_at else ""
    }


# ─────────────────────────────────────────────────────────────
# GAP 18 — BLOCKED-ROAD ALERT SERVICE
# ─────────────────────────────────────────────────────────────

class BlockedRoadAlertService:
    """
    Generates BLOCKED_ROAD operational alerts when a corridor becomes blocked.

    Trigger condition:
      corridor.status in BLOCKED_ROAD_STATUS_VALUES OR corridor.accessibility_score == 0

    Duplicate prevention:
      One active (non-RESOLVED) BLOCKED_ROAD alert per corridor_code.
      New alert only when corridor transitions into BLOCKED state.

    Resolution:
      When corridor.status becomes OPEN/PASSABLE/PARTIAL, existing alert is RESOLVED.
    """

    @staticmethod
    def evaluate_and_alert(corridor: Corridor, db: Session,
                           source_incident: Optional[Incident] = None) -> Optional[Alert]:
        """
        Called after AccessibilityEngine.recalculate_corridor_accessibility().
        Creates a BLOCKED_ROAD alert if the corridor is BLOCKED, resolves it when recovered.
        Returns the created or existing alert, or None if no action needed.
        """
        is_blocked = (
            corridor.status in BLOCKED_ROAD_STATUS_VALUES or
            corridor.accessibility_score == 0.0
        )

        # Check for existing active alert for this corridor
        existing_alert = db.query(Alert).filter(
            Alert.alert_type == "BLOCKED_ROAD",
            Alert.corridor_code == corridor.corridor_code,
            Alert.status != "RESOLVED"
        ).order_by(Alert.created_at.desc()).first()

        if is_blocked:
            if existing_alert:
                # Already have an active alert — no duplicate
                logger.debug(f"[GAP18] Active BLOCKED_ROAD alert #{existing_alert.id} already exists for {corridor.corridor_code}")
                return existing_alert

            # Determine severity: CRITICAL if fully blocked, HIGH if restricted
            if corridor.accessibility_score == 0.0:
                severity = "CRITICAL"
            elif corridor.status in {"RESTRICTED", "PARTIAL"}:
                severity = "HIGH"
            else:
                severity = "CRITICAL"

            # Identify cause from corridor reason text
            cause_text = corridor.reason or "Road/bridge/weather disruption"

            # Format alert message
            affected_states = corridor.states_covered or "NER States"
            title = f"🚧 BLOCKED ROAD: {corridor.name} [{corridor.corridor_code}]"
            message = (
                f"Corridor {corridor.corridor_code} ({corridor.origin} → {corridor.destination}) "
                f"is currently {corridor.status}. "
                f"Accessibility Score: {corridor.accessibility_score}/100. "
                f"States Affected: {affected_states}. "
                f"Cause: {cause_text}. "
                f"Estimated Delay: {corridor.estimated_delay_mins} minutes."
            )
            if source_incident:
                message += f" Source Incident: {source_incident.incident_type} at {source_incident.location_name} ({source_incident.severity})."

            action = (
                f"Evaluate alternate routes bypassing {corridor.corridor_code}. "
                f"Check /api/v1/routes for multi-candidate re-routing. "
                f"Notify all dispatchers managing deliveries via {corridor.origin}–{corridor.destination} corridor."
            )

            alert = Alert(
                alert_type="BLOCKED_ROAD",
                title=title,
                message=message,
                severity=severity,
                location=f"{corridor.origin} → {corridor.destination} ({corridor.corridor_code})",
                recommended_action=action,
                source_incident_id=source_incident.id if source_incident else None,
                corridor_code=corridor.corridor_code,
                district_name=None,
                is_read=False,
                status="NEW",
                created_at=datetime.utcnow()
            )
            db.add(alert)
            db.flush()  # Get ID for SSE broadcast

            # SSE real-time broadcast
            AlertDeliveryService.publish_alert_event("NEW_ALERT", _alert_dict(alert))

            logger.info(f"[GAP18] BLOCKED_ROAD alert #{alert.id} created for {corridor.corridor_code} (score={corridor.accessibility_score})")

            db.add(AuditLog(
                user_email="system@linkx8.in",
                action="CREATE_BLOCKED_ROAD_ALERT",
                resource="Alert",
                details=f"Alert #{alert.id}: {corridor.corridor_code} BLOCKED (score={corridor.accessibility_score})"
            ))
            return alert

        else:
            # Corridor recovered — resolve existing alert
            if existing_alert and existing_alert.status not in ("RESOLVED",):
                existing_alert.status = "RESOLVED"
                existing_alert.resolved_at = datetime.utcnow()
                db.flush()
                AlertDeliveryService.publish_alert_event("ALERT_RESOLVED", _alert_dict(existing_alert))
                logger.info(f"[GAP18] BLOCKED_ROAD alert #{existing_alert.id} RESOLVED — {corridor.corridor_code} recovered (score={corridor.accessibility_score})")
                db.add(AuditLog(
                    user_email="system@linkx8.in",
                    action="RESOLVE_BLOCKED_ROAD_ALERT",
                    resource="Alert",
                    details=f"Alert #{existing_alert.id}: {corridor.corridor_code} recovered (score={corridor.accessibility_score})"
                ))
            return existing_alert

    @staticmethod
    def evaluate_all_corridors(db: Session, source_incident: Optional[Incident] = None) -> List[Alert]:
        """
        Evaluates all corridors after a recalculation and fires/resolves BLOCKED_ROAD alerts as needed.
        Called from incidents.py and field_reports.py after AccessibilityEngine.recalculate_all_accessibility().
        """
        corridors = db.query(Corridor).all()
        alerts_created = []
        for corridor in corridors:
            alert = BlockedRoadAlertService.evaluate_and_alert(corridor, db, source_incident)
            if alert and alert.status == "NEW":
                alerts_created.append(alert)
        return alerts_created


# ─────────────────────────────────────────────────────────────
# GAP 19 — INACCESSIBLE REGION ALERT SERVICE
# ─────────────────────────────────────────────────────────────

class InaccessibleRegionAlertService:
    """
    Generates INACCESSIBLE_REGION alerts when a district crosses the critical accessibility threshold.

    Threshold (documented and configurable):
      district.accessibility_index < INACCESSIBLE_REGION_THRESHOLD (default: 30.0)
      This maps to AccessibilityEngine status: "Poor (25-49)" or "Severely Inaccessible (0-24)"

    Duplicate prevention:
      One active (non-RESOLVED) INACCESSIBLE_REGION alert per district_name.

    Resolution:
      When district.accessibility_index recovers above threshold, alert is RESOLVED.
    """

    @staticmethod
    def evaluate_and_alert(district: District, db: Session,
                           source_incident: Optional[Incident] = None) -> Optional[Alert]:
        """
        Called after AccessibilityEngine.recalculate_district_accessibility().
        Creates INACCESSIBLE_REGION alert if district crosses critical threshold.
        """
        is_critical = district.accessibility_index < INACCESSIBLE_REGION_THRESHOLD

        # Check for existing active alert for this district
        existing_alert = db.query(Alert).filter(
            Alert.alert_type == "INACCESSIBLE_REGION",
            Alert.district_name == district.name,
            Alert.status != "RESOLVED"
        ).order_by(Alert.created_at.desc()).first()

        if is_critical:
            if existing_alert:
                logger.debug(f"[GAP19] Active INACCESSIBLE_REGION alert #{existing_alert.id} already exists for {district.name}")
                return existing_alert

            # Determine severity by score
            if district.accessibility_index < 10.0:
                severity = "CRITICAL"
            elif district.accessibility_index < 25.0:
                severity = "CRITICAL"
            else:
                severity = "HIGH"

            # Identify causes from incidents in district
            incidents = db.query(Incident).filter(
                (Incident.district_name == district.name) |
                Incident.location_name.ilike(f"%{district.name}%")
            ).filter(
                Incident.severity.in_(["HIGH", "CRITICAL"]) |
                (Incident.road_status == "BLOCKED")
            ).all()

            cause_parts = []
            for inc in incidents[:3]:  # Limit to top 3
                cause_parts.append(f"{inc.incident_type} at {inc.location_name}")
            if source_incident and source_incident.district_name == district.name:
                cause_desc = f"{source_incident.incident_type} at {source_incident.location_name}"
                if cause_desc not in cause_parts:
                    cause_parts.insert(0, cause_desc)

            cause_text = "; ".join(cause_parts) if cause_parts else "Multiple simultaneous disruptions"

            # Get affected corridors in district's state
            from app.models.models import Corridor as CorridorModel
            affected_corridors = db.query(CorridorModel).filter(
                CorridorModel.states_covered.ilike(f"%{district.state}%"),
                CorridorModel.status.in_(["BLOCKED", "RESTRICTED", "PARTIAL"])
            ).all()
            corridor_list = ", ".join(c.corridor_code for c in affected_corridors[:5]) if affected_corridors else "None identified"

            title = f"⚠️ INACCESSIBLE REGION: {district.name} District ({district.state})"
            message = (
                f"District '{district.name}' ({district.state}) has critically low accessibility. "
                f"Current Score: {district.accessibility_index}/100 "
                f"[{district.status}]. "
                f"Supply Status: {district.critical_supply_status}. "
                f"Active Incidents: {district.active_incidents_count}. "
                f"Primary Cause: {cause_text}. "
                f"Affected Corridors in {district.state}: {corridor_list}."
            )

            action = (
                f"Evaluate resilient alternate corridors for {district.name} district. "
                f"Coordinate with NDRF/PWD for emergency road clearance. "
                f"Prioritize critical supply deliveries via accessible routes."
            )

            alert = Alert(
                alert_type="INACCESSIBLE_REGION",
                title=title,
                message=message,
                severity=severity,
                location=f"{district.name}, {district.state}",
                recommended_action=action,
                source_incident_id=source_incident.id if source_incident else None,
                corridor_code=None,
                district_name=district.name,
                is_read=False,
                status="NEW",
                created_at=datetime.utcnow()
            )
            db.add(alert)
            db.flush()

            AlertDeliveryService.publish_alert_event("NEW_ALERT", _alert_dict(alert))

            logger.info(f"[GAP19] INACCESSIBLE_REGION alert #{alert.id} for {district.name} (score={district.accessibility_index})")

            db.add(AuditLog(
                user_email="system@linkx8.in",
                action="CREATE_INACCESSIBLE_REGION_ALERT",
                resource="Alert",
                details=f"Alert #{alert.id}: {district.name} accessibility={district.accessibility_index} (threshold={INACCESSIBLE_REGION_THRESHOLD})"
            ))
            return alert

        else:
            # District recovered — resolve existing alert
            if existing_alert and existing_alert.status not in ("RESOLVED",):
                existing_alert.status = "RESOLVED"
                existing_alert.resolved_at = datetime.utcnow()
                db.flush()
                AlertDeliveryService.publish_alert_event("ALERT_RESOLVED", _alert_dict(existing_alert))
                logger.info(f"[GAP19] INACCESSIBLE_REGION alert #{existing_alert.id} RESOLVED — {district.name} recovered (score={district.accessibility_index})")
                db.add(AuditLog(
                    user_email="system@linkx8.in",
                    action="RESOLVE_INACCESSIBLE_REGION_ALERT",
                    resource="Alert",
                    details=f"Alert #{existing_alert.id}: {district.name} recovered (score={district.accessibility_index})"
                ))
            return existing_alert

    @staticmethod
    def evaluate_all_districts(db: Session, source_incident: Optional[Incident] = None) -> List[Alert]:
        """
        Evaluates all districts after a recalculation and fires/resolves alerts as needed.
        Called from accessibility recalculation hooks.
        """
        districts = db.query(District).all()
        alerts_created = []
        for district in districts:
            alert = InaccessibleRegionAlertService.evaluate_and_alert(district, db, source_incident)
            if alert and alert.status == "NEW":
                alerts_created.append(alert)
        return alerts_created


# ─────────────────────────────────────────────────────────────
# GAP 20 — DELAYED DELIVERY ALERT SERVICE
# ─────────────────────────────────────────────────────────────

class DelayedDeliveryAlertService:
    """
    Generates DELIVERY_DELAY_WARNING alerts when delivery delay exceeds the configured threshold.

    Threshold:
      DELIVERY_DELAY_THRESHOLD_MINS (from eta_service.py, currently 45 minutes)
      Configurable via SystemSettings key 'DELAY_ALERT_THRESHOLD_MINS'.

    Data source:
      Delivery.estimated_delay_mins — calculated by ETAService.update_delivery_live_eta()
      Delivery.delay_reason — set by ETAService from primary contributing factor

    Duplicate prevention:
      One active (non-RESOLVED) DELIVERY_DELAY_WARNING per delivery_id.
      New alert only when delivery crosses the threshold.

    Recovery:
      When delay falls below threshold (e.g. rerouting succeeds), alert is RESOLVED.
    """

    @staticmethod
    def get_effective_threshold(db: Session) -> int:
        """Returns the effective delay threshold. Reads from SystemSettings if available."""
        from app.models.models import SystemSettings
        setting = db.query(SystemSettings).filter(
            SystemSettings.setting_key == "DELAY_ALERT_THRESHOLD_MINS"
        ).first()
        if setting:
            try:
                return int(setting.setting_value)
            except ValueError:
                pass
        return DELIVERY_DELAY_THRESHOLD_MINS

    @staticmethod
    def evaluate_and_alert(delivery: Delivery, db: Session) -> Optional[Alert]:
        """
        Called from ETAService.update_delivery_live_eta() after ETA is recalculated.
        Creates, updates, or resolves DELIVERY_DELAY_WARNING as appropriate.
        Returns alert if created or already active, None if no action.
        """
        threshold = DelayedDeliveryAlertService.get_effective_threshold(db)
        delay_mins = delivery.estimated_delay_mins or 0

        existing_alert = db.query(Alert).filter(
            Alert.alert_type == "DELIVERY_DELAY_WARNING",
            Alert.delivery_id == delivery.id,
            Alert.status != "RESOLVED"
        ).order_by(Alert.created_at.desc()).first()

        if delay_mins >= threshold:
            if existing_alert:
                logger.debug(f"[GAP20] Active DELIVERY_DELAY_WARNING alert #{existing_alert.id} already exists for delivery #{delivery.id}")
                return existing_alert

            # Severity
            if delay_mins >= 120:
                severity = "CRITICAL"
            elif delay_mins >= 60:
                severity = "HIGH"
            else:
                severity = "MEDIUM"

            # Map delay_reason to human-readable cause
            reason_map = {
                "TRAFFIC": "Traffic congestion on route",
                "WEATHER": "Adverse weather conditions",
                "INCIDENT": "Active road/bridge obstruction",
                "BRIDGE": "Bridge load restriction",
                "NORMAL": "Normal transit clearance"
            }
            reason_human = reason_map.get(delivery.delay_reason, delivery.delay_reason or "UNKNOWN")

            # Cargo category for commodity linkage (Gap 25)
            cargo_info = ""
            if delivery.cargo_category:
                cargo_info = f" Commodity: {delivery.cargo_category}."

            vehicle_code = delivery.vehicle.vehicle_code if delivery.vehicle else "UNASSIGNED"
            revised_eta_str = (
                delivery.revised_eta.strftime("%H:%M %d-%b-%Y")
                if delivery.revised_eta else "Unknown"
            )
            original_eta_str = (
                delivery.original_eta.strftime("%H:%M %d-%b-%Y")
                if delivery.original_eta else "Unknown"
            )

            title = (
                f"⏰ DELIVERY DELAY ALERT: {delivery.delivery_code} "
                f"[+{delay_mins} mins] — {delivery.destination_city}"
            )
            message = (
                f"Delivery {delivery.delivery_code} ({delivery.cargo_name}) "
                f"to {delivery.destination_city} is delayed by {delay_mins} minutes "
                f"(threshold: {threshold} mins). "
                f"Original ETA: {original_eta_str}. "
                f"Revised ETA: {revised_eta_str}. "
                f"Primary Cause: {reason_human}. "
                f"Vehicle: {vehicle_code}. "
                f"Origin: {delivery.origin_city}.{cargo_info}"
            )

            action = (
                f"Review dynamic re-routing options at /api/v1/deliveries/{delivery.id}/reroute. "
                f"Notify receiving depot/facility at {delivery.destination_city}. "
                f"Assess priority: {delivery.priority}."
            )

            alert = Alert(
                alert_type="DELIVERY_DELAY_WARNING",
                title=title,
                message=message,
                severity=severity,
                location=delivery.destination_city,
                recommended_action=action,
                delivery_id=delivery.id,
                vehicle_id=delivery.assigned_vehicle_id,
                source_incident_id=None,
                corridor_code=None,
                district_name=None,
                is_read=False,
                status="NEW",
                created_at=datetime.utcnow()
            )
            db.add(alert)
            db.flush()

            AlertDeliveryService.publish_alert_event("NEW_ALERT", _alert_dict(alert))

            logger.info(f"[GAP20] DELIVERY_DELAY_WARNING alert #{alert.id} for {delivery.delivery_code} (delay={delay_mins}m, threshold={threshold}m)")

            db.add(AuditLog(
                user_email="system@linkx8.in",
                action="CREATE_DELIVERY_DELAY_ALERT",
                resource="Alert",
                details=f"Alert #{alert.id}: {delivery.delivery_code} delayed {delay_mins} mins via {delivery.delay_reason}"
            ))
            return alert

        else:
            # Delay dropped below threshold — resolve alert
            if existing_alert and existing_alert.status not in ("RESOLVED",):
                existing_alert.status = "RESOLVED"
                existing_alert.resolved_at = datetime.utcnow()
                db.flush()
                AlertDeliveryService.publish_alert_event("ALERT_RESOLVED", _alert_dict(existing_alert))
                logger.info(f"[GAP20] DELIVERY_DELAY_WARNING alert #{existing_alert.id} RESOLVED — {delivery.delivery_code} delay={delay_mins}m < threshold={threshold}m")
                db.add(AuditLog(
                    user_email="system@linkx8.in",
                    action="RESOLVE_DELIVERY_DELAY_ALERT",
                    resource="Alert",
                    details=f"Alert #{existing_alert.id}: {delivery.delivery_code} delay recovered to {delay_mins}m"
                ))
            return existing_alert


# ─────────────────────────────────────────────────────────────
# ALERT RESOLUTION API
# ─────────────────────────────────────────────────────────────

def resolve_alert(alert_id: int, resolved_by: str, db: Session) -> Alert:
    """
    Explicitly resolves an alert (e.g. when the road blockage is cleared by dispatcher).
    Does not confuse acknowledgement with resolution — a RESOLVED alert means the
    underlying condition has been corrected, not just seen.
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise ValueError(f"Alert with ID {alert_id} not found")

    alert.status = "RESOLVED"
    alert.resolved_at = datetime.utcnow()
    alert.acknowledged_by = resolved_by
    db.add(AuditLog(
        user_email=resolved_by,
        action="RESOLVE_ALERT",
        resource="Alert",
        details=f"Alert #{alert.id} ({alert.alert_type}: {alert.title}) manually resolved by {resolved_by}"
    ))
    db.commit()
    db.refresh(alert)
    AlertDeliveryService.publish_alert_event("ALERT_RESOLVED", _alert_dict(alert))
    return alert


# ─────────────────────────────────────────────────────────────
# CONFIGURATION CONSTANTS (for API endpoint exposure)
# ─────────────────────────────────────────────────────────────

ALERT_CONFIGURATION = {
    "gap18_blocked_road": {
        "trigger": "corridor.status in {BLOCKED, CLOSED} OR corridor.accessibility_score == 0",
        "score_threshold": BLOCKED_ROAD_ALERT_SCORE_THRESHOLD,
        "deduplication": "One active BLOCKED_ROAD alert per corridor_code",
        "resolution": "Auto-resolved when corridor recovers",
        "severity_logic": "CRITICAL if score=0, HIGH if restricted/partial"
    },
    "gap19_inaccessible_region": {
        "trigger": f"district.accessibility_index < {INACCESSIBLE_REGION_THRESHOLD}",
        "score_threshold": INACCESSIBLE_REGION_THRESHOLD,
        "deduplication": "One active INACCESSIBLE_REGION alert per district_name",
        "resolution": "Auto-resolved when district score recovers above threshold",
        "severity_logic": "CRITICAL if score < 25, HIGH if score < 30"
    },
    "gap20_delayed_delivery": {
        "trigger": f"delivery.estimated_delay_mins >= DELAY_ALERT_THRESHOLD_MINS ({DELIVERY_DELAY_THRESHOLD_MINS} mins)",
        "score_threshold": DELIVERY_DELAY_THRESHOLD_MINS,
        "deduplication": "One active DELIVERY_DELAY_WARNING per delivery_id",
        "resolution": "Auto-resolved when delay drops below threshold",
        "severity_logic": "CRITICAL >= 120 mins, HIGH >= 60 mins, MEDIUM >= threshold",
        "configurable_via": "SystemSettings.setting_key = 'DELAY_ALERT_THRESHOLD_MINS'"
    }
}
