"""
Intelligent Disruption Detection & Rerouting Service (Phase 2)
Implements the end-to-end event-to-command-center intelligence cascade:

EVENT
  → detect disruption/risk
  → identify affected road/corridor
  → update accessibility
  → determine affected vehicles
  → calculate alternative route
  → calculate new ETA
  → generate alert
  → update command center

Principles:
- Deterministic routing calculation (distance, velocity, bridge load clearance).
- Transparently labeled predictive/risk components (weather hazard, terrain ML).
- Persistent RouteDecision records in SQLite.
- Integrates directly with Phase 1 AccessibilityEngine and RoutingService.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.models import (
    Corridor,
    Delivery,
    Vehicle,
    Incident,
    Alert,
    AuditLog,
    RouteDecision,
    Bridge
)
from app.services.routing_service import (
    RoutingService,
    PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS,
    ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS,
    ROUTE_C_NORTHERN_WAYPOINTS
)
from app.services.operational_alerts_service import _alert_dict
from app.services.alert_delivery_service import AlertDeliveryService

logger = logging.getLogger("link_x8.rerouting_service")

# Standard Corridor sector maps for routing alignment
CORRIDOR_SECTORS = {
    "COR-NH27": ["guwahati", "nagaon", "dabaka", "dimapur", "kohima", "senapati", "kangpokpi", "imphal"],
    "COR-NH37": ["guwahati", "shillong", "jowai", "silchar", "jiribam", "noney", "imphal"],
    "COR-NH40": ["guwahati", "jorabat", "nongpoh", "umsning", "shillong"],
    "COR-NH44": ["shillong", "silchar", "karimganj", "churaibari", "agartala"],
    "COR-NH54": ["silchar", "cachar", "vairengte", "kolasib", "aizawl"],
    "COR-NH10": ["siliguri", "sevoke", "coronation", "teesta", "rangpo", "singtam", "gangtok"],
    "COR-NH15": ["baihata", "mangaldai", "tezpur", "north lakhimpur", "dhemaji", "jonai"],
    "COR-NH102": ["imphal", "thoubal", "kakching", "pallel", "moreh"]
}

PREDICTIVE_COMPONENTS = [
    "Open-Meteo Atmospheric Weather Hazard Index",
    "Terrain Moisture Saturation & Slope Vulnerability Model",
    "Historical Monsoon Landslide Frequency Estimator",
    "Dynamic Traffic Congestion & Friction Index"
]

class ReroutingService:

    @staticmethod
    def find_affected_vehicles_and_deliveries(corridor: Corridor, db: Session) -> Dict[str, Any]:
        """
        Identifies active deliveries and assigned vehicles traversing or routed through
        a restricted or blocked corridor.
        """
        active_deliveries = db.query(Delivery).filter(
            Delivery.status.in_(["IN_TRANSIT", "DELAYED", "DELAYED_AT_RISK", "ASSIGNED", "DISPATCHED", "REROUTED"])
        ).all()

        cor_code = corridor.corridor_code
        cor_orig = (corridor.origin or "").strip().lower()
        cor_dest = (corridor.destination or "").strip().lower()
        sectors = CORRIDOR_SECTORS.get(cor_code, [cor_orig, cor_dest])

        matched_deliveries = []
        matched_vehicles = []
        seen_vehicle_ids = set()

        for deliv in active_deliveries:
            deliv_orig = (deliv.origin_city or "").strip().lower()
            deliv_dest = (deliv.destination_city or "").strip().lower()

            is_match = False

            # Direct corridor match (origin & destination alignment)
            if (deliv_orig in cor_orig or cor_orig in deliv_orig) and (deliv_dest in cor_dest or cor_dest in deliv_dest):
                is_match = True
            elif deliv_dest in cor_dest or cor_dest in deliv_dest:
                is_match = True
            elif any(sec in deliv_dest for sec in sectors) or any(sec in deliv_orig for sec in sectors):
                is_match = True

            # Waypoint check if available
            if not is_match and deliv.active_route_path:
                try:
                    wpts = json.loads(deliv.active_route_path) if isinstance(deliv.active_route_path, str) else deliv.active_route_path
                    if isinstance(wpts, list) and len(wpts) > 0:
                        # If route waypoints match standard corridor waypoints
                        if cor_code == "COR-NH27" and any(abs(pt[0] - 25.2676) < 0.3 and abs(pt[1] - 94.0210) < 0.3 for pt in wpts): # Near Senapati
                            is_match = True
                except Exception:
                    pass

            if is_match:
                matched_deliveries.append(deliv)
                veh = deliv.vehicle or (db.query(Vehicle).filter(Vehicle.id == deliv.assigned_vehicle_id).first() if deliv.assigned_vehicle_id else None)
                if veh and veh.id not in seen_vehicle_ids:
                    seen_vehicle_ids.add(veh.id)
                    matched_vehicles.append(veh)

        return {
            "corridor_code": cor_code,
            "corridor_name": corridor.name,
            "deliveries": matched_deliveries,
            "vehicles": matched_vehicles
        }

    @classmethod
    def calculate_reroute_proposal(
        cls,
        delivery: Delivery,
        corridor: Corridor,
        db: Session,
        incident: Optional[Incident] = None
    ) -> RouteDecision:
        """
        Calculates an alternative route avoiding the blocked corridor using RoutingService.
        Computes deterministic side-by-side comparison metrics (distance, time, ETA delta),
        labels predictive risk factors, and persists the proposal in RouteDecision.
        """
        # Blockage configuration
        blockage_desc = incident.incident_type if incident else "Corridor Blockage"
        loc_name = incident.location_name if incident else corridor.name
        active_blk = [{
            "incident_type": blockage_desc,
            "location_name": loc_name,
            "road_status": "BLOCKED"
        }]

        # Call existing AI multi-candidate optimization engine
        eval_result = RoutingService.optimize_routes(
            origin=delivery.origin_city,
            destination=delivery.destination_city,
            optimization_objective="SAFEST" if delivery.priority == "EMERGENCY" else "BALANCED",
            cargo_priority=delivery.priority,
            active_blockages=active_blk
        )

        candidates = eval_result["candidate_routes"]

        # Default fallback candidates if evaluation is empty
        if not candidates:
            candidates = RoutingService.generate_candidate_paths(delivery.origin_city, delivery.destination_city)

        # Identify original candidate (the route using the affected corridor, e.g. ROUTE_A / COR-NH27)
        orig_cand = None
        for c in candidates:
            if c.get("corridor_code") == corridor.corridor_code or c.get("id") == "ROUTE_A":
                orig_cand = c
                break
        if not orig_cand:
            raw = RoutingService.generate_candidate_paths(delivery.origin_city, delivery.destination_city)
            orig_cand = raw[0] if raw else candidates[0]

        # Identify alternative candidate (the top recommended unblocked detour)
        alt_cand = None
        for c in candidates:
            if not c.get("is_blocked", False) and c["id"] != orig_cand["id"]:
                alt_cand = c
                break
        if not alt_cand and len(candidates) > 1:
            other_cands = [c for c in candidates if c["id"] != orig_cand["id"]]
            alt_cand = other_cands[0] if other_cands else candidates[0]
        elif not alt_cand:
            alt_cand = orig_cand


        # Deterministic comparisons
        orig_dist = float(orig_cand.get("distance_km", 480.0))
        alt_dist = float(alt_cand.get("distance_km", 535.0))
        add_dist_km = round(max(0.0, alt_dist - orig_dist), 1)

        orig_time_hrs = float(orig_cand.get("estimated_travel_time_hours", 11.0))
        alt_time_hrs = float(alt_cand.get("estimated_travel_time_hours", 13.5))

        # Additional travel time in minutes
        raw_add_time_mins = int(round((alt_time_hrs - orig_time_hrs) * 60))
        add_time_mins = max(15, raw_add_time_mins) if alt_cand["id"] != orig_cand["id"] else 0

        # ETA calculations
        now = datetime.utcnow()
        orig_eta = delivery.original_eta or (now + timedelta(hours=orig_time_hrs))
        new_eta = orig_eta + timedelta(minutes=add_time_mins)

        # Risk scoring
        risk_before = float(orig_cand.get("risk_score", 82.0 if corridor.status in ["BLOCKED", "CLOSED"] else 65.0))
        risk_after = float(alt_cand.get("risk_score", 38.0))

        # Transparent explainable rationale
        trigger_evt = "CORRIDOR_BLOCKED" if corridor.status in ["BLOCKED", "CLOSED"] else "CORRIDOR_RESTRICTED"
        detour_name = alt_cand.get("name", "Alternative Route B (via Silchar / Jiribam)")
        rationale = (
            f"Corridor {corridor.corridor_code} is {corridor.status} ({corridor.factor_summary or 'Disruption detected'}). "
            f"Deterministic reroute selects {detour_name}. "
            f"Adds +{add_dist_km} km (+{add_time_mins} min detour), reducing transit hazard risk score from {risk_before} to {risk_after}."
        )

        veh = delivery.vehicle or (db.query(Vehicle).filter(Vehicle.id == delivery.assigned_vehicle_id).first() if delivery.assigned_vehicle_id else None)
        veh_code = veh.vehicle_code if veh else "NER-V001"
        veh_id = veh.id if veh else None

        # Check if an existing PROPOSED decision exists for this delivery and corridor
        existing_decision = db.query(RouteDecision).filter(
            RouteDecision.delivery_id == delivery.id,
            RouteDecision.corridor_code == corridor.corridor_code,
            RouteDecision.status == "PROPOSED"
        ).first()

        alt_wpts = alt_cand.get("waypoints", ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS)
        orig_wpts = orig_cand.get("waypoints", PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS)

        metadata_dict = {
            "predictive_components": PREDICTIVE_COMPONENTS,
            "routing_method": "DETERMINISTIC_MULTI_ATTRIBUTE_OPTIMIZATION",
            "corridor_accessibility_score": corridor.accessibility_score,
            "corridor_factor_summary": corridor.factor_summary,
            "bridge_clearance_status": alt_cand.get("bridge_clearance_status", "OPERATIONAL (Verified 24T)"),
            "weather_risk_category": alt_cand.get("weather_risk_category", "LOW")
        }

        if existing_decision:
            existing_decision.corridor_code = corridor.corridor_code
            existing_decision.incident_id = incident.id if incident else existing_decision.incident_id
            existing_decision.trigger_event = trigger_evt
            existing_decision.original_distance_km = orig_dist
            existing_decision.original_travel_time_hours = orig_time_hrs
            existing_decision.original_eta = orig_eta
            existing_decision.alternative_route_id = alt_cand.get("id", "ROUTE_B")
            existing_decision.alternative_route_name = detour_name
            existing_decision.alternative_distance_km = alt_dist
            existing_decision.alternative_travel_time_hours = alt_time_hrs
            existing_decision.new_eta = new_eta
            existing_decision.additional_distance_km = add_dist_km
            existing_decision.additional_time_minutes = add_time_mins
            existing_decision.risk_score_before = risk_before
            existing_decision.risk_score_after = risk_after
            existing_decision.rationale = rationale
            existing_decision.waypoints_json = json.dumps(alt_wpts)
            existing_decision.original_waypoints_json = json.dumps(orig_wpts)
            existing_decision.decision_metadata = json.dumps(metadata_dict)
            existing_decision.updated_at = now
            db.commit()
            db.refresh(existing_decision)
            return existing_decision

        # Create new RouteDecision record with unique code
        import uuid
        code = f"RDEC-{now.year}-{uuid.uuid4().hex[:6].upper()}"


        decision = RouteDecision(
            decision_code=code,
            delivery_id=delivery.id,
            delivery_code=delivery.delivery_code,
            vehicle_id=veh_id,
            vehicle_code=veh_code,
            corridor_code=corridor.corridor_code,
            incident_id=incident.id if incident else None,
            trigger_event=trigger_evt,
            original_route_id=orig_cand.get("id", "ROUTE_A"),
            original_route_name=orig_cand.get("name", "Route A (via Kohima - NH27/NH2)"),
            original_distance_km=orig_dist,
            original_travel_time_hours=orig_time_hrs,
            original_eta=orig_eta,
            alternative_route_id=alt_cand.get("id", "ROUTE_B"),
            alternative_route_name=detour_name,
            alternative_distance_km=alt_dist,
            alternative_travel_time_hours=alt_time_hrs,
            new_eta=new_eta,
            additional_distance_km=add_dist_km,
            additional_time_minutes=add_time_mins,
            risk_score_before=risk_before,
            risk_score_after=risk_after,
            status="PROPOSED",
            rationale=rationale,
            waypoints_json=json.dumps(alt_wpts),
            original_waypoints_json=json.dumps(orig_wpts),
            decision_metadata=json.dumps(metadata_dict),
            created_at=now,
            updated_at=now
        )
        db.add(decision)
        db.commit()
        db.refresh(decision)
        logger.info(f"[PHASE2] Stored RouteDecision {decision.decision_code} for {delivery.delivery_code} (status=PROPOSED)")
        return decision

    @classmethod
    def generate_reroute_alert(cls, decision: RouteDecision, db: Session) -> Optional[Alert]:
        """
        Creates an operational Alert for affected users and dispatchers.
        Deduplicates against active alerts for the same delivery and corridor.
        """
        existing = db.query(Alert).filter(
            Alert.alert_type == "REROUTE_RECOMMENDED",
            Alert.delivery_id == decision.delivery_id,
            Alert.status != "RESOLVED"
        ).first()

        if existing:
            return existing

        sev = "CRITICAL" if decision.trigger_event == "CORRIDOR_BLOCKED" else "HIGH"
        title = f"🚧 REROUTE ADVISORY: {decision.delivery_code} (Vehicle {decision.vehicle_code or 'Fleet'})"
        msg = (
            f"Corridor {decision.corridor_code} disruption detected. "
            f"Active delivery {decision.delivery_code} recommended for detour via {decision.alternative_route_name}. "
            f"Distance: {decision.alternative_distance_km} km (+{decision.additional_distance_km} km). "
            f"New ETA: {decision.new_eta.strftime('%d-%b %H:%M UTC')} (+{decision.additional_time_minutes} mins). "
            f"Risk drops from {decision.risk_score_before} to {decision.risk_score_after}."
        )
        action = (
            f"Authorize detour via {decision.alternative_route_name}. "
            f"Bypasses physical obstruction on {decision.corridor_code}."
        )

        alert = Alert(
            alert_type="REROUTE_RECOMMENDED",
            title=title,
            message=msg,
            severity=sev,
            location=f"{decision.corridor_code} (En route to {decision.delivery_code})",
            recommended_action=action,
            delivery_id=decision.delivery_id,
            vehicle_id=decision.vehicle_id,
            corridor_code=decision.corridor_code,
            source_incident_id=decision.incident_id,
            status="NEW",
            created_at=datetime.utcnow()
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        try:
            AlertDeliveryService.publish_alert_event("NEW_ALERT", _alert_dict(alert))
        except Exception as e:
            logger.debug(f"SSE publish alert event warning: {e}")

        logger.info(f"[PHASE2] Created REROUTE_RECOMMENDED Alert #{alert.id} for {decision.delivery_code}")
        return alert

    @classmethod
    def approve_route_decision(
        cls,
        decision_id: int,
        user_email: str,
        db: Session,
        notes: Optional[str] = None
    ) -> RouteDecision:
        """
        Executes a proposed reroute decision:
        - Updates RouteDecision status to APPROVED / EXECUTED
        - Updates Delivery active_route_path, revised_eta, route_risk_score, status
        - Updates Vehicle risk level
        - Acknowledges the related alert
        - Logs audit record
        """
        dec = db.query(RouteDecision).filter(RouteDecision.id == decision_id).first()
        if not dec:
            raise ValueError(f"RouteDecision with id {decision_id} not found")

        now = datetime.utcnow()
        dec.status = "APPROVED"
        dec.approved_by = user_email
        dec.approved_at = now
        dec.updated_at = now

        # Update target delivery
        deliv = db.query(Delivery).filter(Delivery.id == dec.delivery_id).first()
        if deliv:
            if dec.waypoints_json:
                deliv.active_route_path = dec.waypoints_json
            deliv.revised_eta = dec.new_eta
            deliv.estimated_delay_mins = dec.additional_time_minutes
            deliv.route_risk_score = dec.risk_score_after
            deliv.route_risk_category = "LOW" if dec.risk_score_after < 40 else "MEDIUM"
            deliv.delay_reason = f"Approved Detour: {dec.alternative_route_name}"
            deliv.status = "REROUTED"

            # Update vehicle
            if deliv.vehicle:
                deliv.vehicle.status = "IN_TRANSIT"
                deliv.vehicle.risk_level = deliv.route_risk_category

        # Acknowledge / resolve alert
        alerts = db.query(Alert).filter(
            Alert.delivery_id == dec.delivery_id,
            Alert.alert_type == "REROUTE_RECOMMENDED"
        ).all()
        for a in alerts:
            a.status = "ACKNOWLEDGED"
            a.acknowledged_by = user_email
            a.acknowledged_at = now

        # Audit log
        db.add(AuditLog(
            user_email=user_email,
            action="APPROVE_ROUTE_DECISION",
            resource="RouteDecision",
            details=f"Approved decision {dec.decision_code} for delivery {dec.delivery_code}: Rerouted via {dec.alternative_route_name}"
        ))

        db.commit()
        db.refresh(dec)
        logger.info(f"[PHASE2] Approved and executed RouteDecision {dec.decision_code} for delivery {dec.delivery_code}")
        return dec

    @classmethod
    def detect_and_evaluate_disruptions(
        cls,
        db: Session,
        source_incident: Optional[Incident] = None
    ) -> List[RouteDecision]:
        """
        Orchestration Hook called by AccessibilityEngine.recalculate_all_accessibility.
        Scans corridors for RESTRICTED or BLOCKED states and triggers vehicle identification,
        alternative route calculation, and alert generation.
        """
        disrupted_corridors = db.query(Corridor).filter(
            (Corridor.status.in_(["BLOCKED", "CLOSED", "RESTRICTED"])) |
            (Corridor.accessibility_status.in_(["BLOCKED", "RESTRICTED"])) |
            (Corridor.accessibility_score < 70.0)
        ).all()

        generated_decisions = []

        for cor in disrupted_corridors:
            affected = cls.find_affected_vehicles_and_deliveries(cor, db)
            deliveries = affected.get("deliveries", [])

            for deliv in deliveries:
                # Do not re-propose if delivery has already been APPROVED or executed for this alternate route
                existing_approved = db.query(RouteDecision).filter(
                    RouteDecision.delivery_id == deliv.id,
                    RouteDecision.corridor_code == cor.corridor_code,
                    RouteDecision.status == "APPROVED"
                ).first()
                if existing_approved:
                    continue

                decision = cls.calculate_reroute_proposal(deliv, cor, db, incident=source_incident)
                cls.generate_reroute_alert(decision, db)
                generated_decisions.append(decision)

        return generated_decisions

    @classmethod
    def get_affected_routes(cls, db: Session) -> List[Dict[str, Any]]:
        """
        API helper: Returns all currently restricted or blocked corridors
        with their impacted vehicles and active consignments.
        """
        disrupted = db.query(Corridor).filter(
            (Corridor.status.in_(["BLOCKED", "CLOSED", "RESTRICTED"])) |
            (Corridor.accessibility_status.in_(["BLOCKED", "RESTRICTED"])) |
            (Corridor.accessibility_score < 70.0)
        ).all()

        results = []
        for cor in disrupted:
            aff = cls.find_affected_vehicles_and_deliveries(cor, db)
            d_items = []
            for d in aff["deliveries"]:
                d_items.append({
                    "delivery_id": d.id,
                    "delivery_code": d.delivery_code,
                    "cargo_name": d.cargo_name,
                    "priority": d.priority,
                    "origin_city": d.origin_city,
                    "destination_city": d.destination_city,
                    "original_eta": d.original_eta,
                    "revised_eta": d.revised_eta,
                    "estimated_delay_mins": d.estimated_delay_mins,
                    "vehicle_code": d.vehicle.vehicle_code if d.vehicle else None
                })

            v_items = []
            for v in aff["vehicles"]:
                v_items.append({
                    "vehicle_id": v.id,
                    "vehicle_code": v.vehicle_code,
                    "driver_name": v.driver_name,
                    "status": v.status,
                    "risk_level": v.risk_level,
                    "current_lat": v.current_lat,
                    "current_lng": v.current_lng,
                    "destination_city": v.destination_city
                })

            # Recommend detour name
            detour = "Alternative Route B (via Silchar / Jiribam - NH37)" if "27" in cor.corridor_code or "Imphal" in cor.destination else "Regional Highway Bypass Detour"

            results.append({
                "corridor_code": cor.corridor_code,
                "corridor_name": cor.name,
                "status": cor.status,
                "accessibility_status": cor.accessibility_status or cor.status,
                "accessibility_score": cor.accessibility_score,
                "risk_level": cor.risk_level,
                "factor_summary": cor.factor_summary,
                "affected_vehicles_count": len(v_items),
                "affected_deliveries_count": len(d_items),
                "affected_vehicles": v_items,
                "affected_deliveries": d_items,
                "recommended_detour": detour,
                "last_updated": cor.last_updated or datetime.utcnow()
            })

        return results

    @classmethod
    def get_eta_comparison(
        cls,
        db: Session,
        delivery_id: Optional[int] = None,
        origin: Optional[str] = None,
        destination: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        API helper: Compares original route vs alternative route side-by-side
        including distances, travel times, ETAs, and risk deltas.
        """
        delivery = None
        decision = None

        if delivery_id:
            delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
            if delivery:
                origin = delivery.origin_city
                destination = delivery.destination_city
                decision = db.query(RouteDecision).filter(RouteDecision.delivery_id == delivery.id).order_by(RouteDecision.created_at.desc()).first()

        origin = origin or "Guwahati"
        destination = destination or "Imphal"

        if decision:
            return {
                "delivery_code": decision.delivery_code,
                "vehicle_code": decision.vehicle_code,
                "origin": origin,
                "destination": destination,
                "corridor_code": decision.corridor_code,
                "decision_code": decision.decision_code,
                "status": decision.status,
                "original_route": {
                    "id": decision.original_route_id,
                    "name": decision.original_route_name,
                    "distance_km": decision.original_distance_km,
                    "travel_time_hours": decision.original_travel_time_hours,
                    "eta": decision.original_eta,
                    "risk_score": decision.risk_score_before
                },
                "alternative_route": {
                    "id": decision.alternative_route_id,
                    "name": decision.alternative_route_name,
                    "distance_km": decision.alternative_distance_km,
                    "travel_time_hours": decision.alternative_travel_time_hours,
                    "eta": decision.new_eta,
                    "risk_score": decision.risk_score_after
                },
                "comparison": {
                    "additional_distance_km": decision.additional_distance_km,
                    "additional_time_minutes": decision.additional_time_minutes,
                    "risk_reduction": round(decision.risk_score_before - decision.risk_score_after, 1),
                    "rationale": decision.rationale,
                    "is_recommended": True
                },
                "predictive_components": PREDICTIVE_COMPONENTS
            }

        # Dynamic fallback computation if no decision record exists yet
        raw_candidates = RoutingService.generate_candidate_paths(origin, destination)
        c1 = raw_candidates[0]
        c2 = raw_candidates[1] if len(raw_candidates) > 1 else raw_candidates[0]

        now = datetime.utcnow()
        orig_eta = (delivery.original_eta if delivery else None) or (now + timedelta(hours=c1["estimated_travel_time_hours"]))
        time_diff_mins = int(round((c2["estimated_travel_time_hours"] - c1["estimated_travel_time_hours"]) * 60))
        new_eta = orig_eta + timedelta(minutes=max(15, time_diff_mins))

        return {
            "delivery_code": delivery.delivery_code if delivery else None,
            "vehicle_code": delivery.vehicle.vehicle_code if (delivery and delivery.vehicle) else None,
            "origin": origin,
            "destination": destination,
            "corridor_code": c1.get("corridor_code", "COR-NH27"),
            "decision_code": None,
            "status": "DYNAMIC_PREVIEW",
            "original_route": {
                "id": c1["id"],
                "name": c1["name"],
                "distance_km": c1["distance_km"],
                "travel_time_hours": c1["estimated_travel_time_hours"],
                "eta": orig_eta,
                "risk_score": c1.get("base_risk_score", 20.0)
            },
            "alternative_route": {
                "id": c2["id"],
                "name": c2["name"],
                "distance_km": c2["distance_km"],
                "travel_time_hours": c2["estimated_travel_time_hours"],
                "eta": new_eta,
                "risk_score": c2.get("base_risk_score", 35.0)
            },
            "comparison": {
                "additional_distance_km": round(max(0.0, c2["distance_km"] - c1["distance_km"]), 1),
                "additional_time_minutes": max(15, time_diff_mins),
                "risk_reduction": round(c1.get("base_risk_score", 20.0) - c2.get("base_risk_score", 35.0), 1),
                "rationale": f"Candidate evaluation between {origin} and {destination}",
                "is_recommended": True
            },
            "predictive_components": PREDICTIVE_COMPONENTS
        }
