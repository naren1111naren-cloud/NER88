from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from app.models.models import Corridor, Bridge, District, Incident, Vehicle, Delivery, Alert, WeatherRecord, AuditLog

class AccessibilityEngine:
    @staticmethod
    def classify_accessibility_status(score: float) -> str:
        """Returns standard accessibility classification according to SIH Gap scale."""
        if score >= 90.0:
            return "FULLY PASSABLE"
        elif score >= 70.0:
            return "PASSABLE / LOW IMPACT"
        elif score >= 40.0:
            return "DEGRADED"
        elif score > 0.0:
            return "RESTRICTED / HIGH RISK"
        else:
            return "BLOCKED"

    @staticmethod
    def get_district_status_label(score: float) -> str:
        """Returns district accessibility health category."""
        if score >= 90.0:
            return "Highly Accessible (90+)"
        elif score >= 75.0:
            return "Good (75-89)"
        elif score >= 50.0:
            return "Moderate (50-74)"
        elif score >= 25.0:
            return "Poor (25-49)"
        else:
            return "Severely Inaccessible (0-24)"

    @staticmethod
    def recalculate_bridge_accessibility(bridge: Bridge, db: Session) -> Dict[str, Any]:
        """Calculates bridge accessibility score and risk based on condition, incidents, and load restrictions."""
        base_score = 100.0
        risk_level = "LOW"
        reasons = []

        # 1. Structural / Operational Status
        if bridge.status == "CLOSED":
            base_score = 0.0
            risk_level = "CRITICAL"
            reasons.append("Bridge completely closed for traffic")
        elif bridge.status == "DAMAGED":
            base_score = 25.0
            risk_level = "HIGH"
            reasons.append("Structural damage detected")
        elif bridge.status == "RESTRICTED":
            base_score = 60.0
            risk_level = "MEDIUM"
            reasons.append("Operational restriction active")
        elif bridge.status == "UNKNOWN":
            base_score = 50.0
            risk_level = "MEDIUM"
            reasons.append("Inspection pending / condition unverified")

        # 2. Evaluate Load Restriction Type
        if bridge.load_restriction_type == "Closed":
            base_score = 0.0
            risk_level = "CRITICAL"
            reasons.append("Load Restriction: Closed to all vehicular movement")
        elif bridge.load_restriction_type == "Light Vehicles Only":
            base_score = min(base_score, 45.0)
            if risk_level != "CRITICAL":
                risk_level = "HIGH"
            reasons.append("Load Restriction: Light vehicles only (No heavy trucks)")
        elif bridge.load_restriction_type == "Heavy Vehicles Restricted":
            base_score = min(base_score, 55.0)
            if risk_level != "CRITICAL":
                risk_level = "HIGH"
            reasons.append("Load Restriction: Heavy logistics carriers restricted")
        elif bridge.load_restriction_type == "Reduced Load (Max 20T)":
            base_score = min(base_score, 70.0)
            if risk_level == "LOW":
                risk_level = "MEDIUM"
            reasons.append("Load Restriction: 20T weight ceiling enforced")

        # 3. Check directly linked or nearby incidents
        incidents = db.query(Incident).filter(
            (Incident.affected_bridge_id == bridge.id) |
            (Incident.affected_bridge_code == bridge.bridge_code) |
            (Incident.location_name.ilike(f"%{bridge.name}%")) |
            ((Incident.incident_type == "BRIDGE_DAMAGE") & (Incident.district_name == bridge.district_name))
        ).all()

        for inc in incidents:
            if inc.road_status in ["BLOCKED", "CLOSED"]:
                base_score = 0.0
                risk_level = "CRITICAL"
                reasons.append(f"Active Incident: {inc.incident_type} ({inc.road_status})")
            elif inc.severity in ["HIGH", "CRITICAL"]:
                base_score = max(0.0, base_score - 35.0)
                risk_level = "HIGH" if risk_level != "CRITICAL" else "CRITICAL"
                reasons.append(f"Nearby severe hazard: {inc.incident_type}")

        bridge.accessibility_score = round(max(0.0, min(100.0, base_score)), 1)
        bridge.risk_level = risk_level
        bridge.condition_description = "; ".join(reasons) if reasons else "Operational clearance normal"
        bridge.last_updated = datetime.utcnow()
        return {
            "accessibility_score": bridge.accessibility_score,
            "risk_level": bridge.risk_level,
            "status": bridge.status,
            "reason": bridge.condition_description
        }

    @staticmethod
    def validate_bridge_load_clearance(bridge: Bridge, vehicle_weight_tons: float, vehicle_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Validates whether a vehicle/cargo shipment is compatible with a bridge's physical load capacity and operational restrictions.
        """
        capacity = bridge.load_capacity_tons or 40.0
        status = bridge.status or "OPERATIONAL"
        restriction = bridge.load_restriction_type or "No Restriction"

        is_compatible = True
        clearance_status = "PASSABLE"
        reasons = []
        action = "Vehicle load is within bridge capacity clearance."

        # 1. Closed or Blocked Bridge
        if status == "CLOSED" or restriction == "Closed":
            is_compatible = False
            clearance_status = "BLOCKED"
            reasons.append(f"Bridge {bridge.name} is completely CLOSED for all traffic.")
            action = "Reroute transport via alternate corridor bypass."

        # 2. Structural Damage
        elif status == "DAMAGED":
            is_compatible = False
            clearance_status = "RESTRICTED"
            reasons.append(f"Bridge {bridge.name} has structural damage. Heavy transit prohibited.")
            action = "Inspect alternate river crossing or await engineer clearance."

        # 3. Light Vehicles Only Restriction
        elif restriction == "Light Vehicles Only" and vehicle_weight_tons > 5.0:
            is_compatible = False
            clearance_status = "EXCEEDS_CAPACITY"
            reasons.append(f"Bridge restricted to light vehicles only. Vehicle weight ({vehicle_weight_tons}T) exceeds restriction.")
            action = "Divert heavy cargo carrier to multi-lane trunk bridge."

        # 4. Weight Exceeds Maximum Load Capacity
        elif vehicle_weight_tons > capacity:
            is_compatible = False
            clearance_status = "EXCEEDS_CAPACITY"
            excess = round(vehicle_weight_tons - capacity, 1)
            reasons.append(f"Vehicle weight ({vehicle_weight_tons}T) exceeds bridge load capacity ({capacity}T) by {excess} tons.")
            action = f"Reroute shipment via a corridor with bridge capacity >= {vehicle_weight_tons}T."

        # 5. Heavy Vehicles Restricted (e.g. max 20T or heavy multiaxle restriction)
        elif restriction == "Heavy Vehicles Restricted" and vehicle_weight_tons > 20.0:
            is_compatible = False
            clearance_status = "RESTRICTED"
            reasons.append(f"Bridge has active heavy vehicle restriction (limit 20T). Vehicle is {vehicle_weight_tons}T.")
            action = "Apply for special heavy-cargo clearance or use alternate bypass."

        # 6. Reduced Load (Max 20T)
        elif restriction == "Reduced Load (Max 20T)" and vehicle_weight_tons > 20.0:
            is_compatible = False
            clearance_status = "EXCEEDS_CAPACITY"
            reasons.append(f"Bridge restricted to max 20T. Vehicle weight {vehicle_weight_tons}T is not permitted.")
            action = "Use alternate route with higher load rating."

        # 7. Operational & within limits
        else:
            if status == "RESTRICTED":
                clearance_status = "PASSABLE_WITH_CAUTION"
                reasons.append("Bridge is under operational caution. Speed restriction enforced (20 km/h).")
                action = "Passage allowed with single-vehicle spacing and caution."
            else:
                reasons.append(f"Load ({vehicle_weight_tons}T) cleared for bridge limit ({capacity}T).")

        return {
            "bridge_id": bridge.id,
            "bridge_code": bridge.bridge_code,
            "bridge_name": bridge.name,
            "connected_corridor": bridge.corridor_code,
            "bridge_capacity_tons": capacity,
            "vehicle_weight_tons": vehicle_weight_tons,
            "is_compatible": is_compatible,
            "status": clearance_status,
            "reason": "; ".join(reasons),
            "restriction_details": bridge.restriction_details,
            "recommended_action": action
        }

    @staticmethod
    def recalculate_corridor_accessibility(corridor: Corridor, db: Session) -> Dict[str, Any]:
        """
        Calculates corridor accessibility score (0-100), risk level, delay, and root cause reasons.
        Formula: Accessibility Index = max(0.0, min(100.0, 100.0 - (Incident_Penalties + Bridge_Penalties + Weather_Penalties)))
        Critical blockages / bridge closures set score to 0.0 (BLOCKED).
        """
        base_score = 100.0
        incident_penalty = 0.0
        bridge_penalty = 0.0
        weather_penalty = 0.0
        risk_level = "LOW"
        delay_mins = 0
        reasons = []
        is_blocked = False

        # 1. Check connected bridges on this corridor
        bridges = db.query(Bridge).filter(Bridge.corridor_code == corridor.corridor_code).all()
        for b in bridges:
            if b.status == "CLOSED" or b.accessibility_score == 0:
                is_blocked = True
                bridge_penalty = 100.0
                risk_level = "CRITICAL"
                delay_mins += 180
                reasons.append(f"Bridge closed: {b.name} on {b.river_name or 'River Crossing'}")
            elif b.status == "DAMAGED":
                bridge_penalty = max(bridge_penalty, 35.0)
                if risk_level != "CRITICAL":
                    risk_level = "HIGH"
                delay_mins += 60
                reasons.append(f"Bridge damaged: {b.name} (Capacity limited)")
            elif b.status == "RESTRICTED" or (b.load_restriction_type and b.load_restriction_type not in ["No Restriction", "None", ""]):
                bridge_penalty = max(bridge_penalty, 25.0)
                if risk_level not in ["CRITICAL", "HIGH"]:
                    risk_level = "MEDIUM"
                delay_mins += 45
                reasons.append(f"Bridge restriction: {b.name} ({b.load_restriction_type or b.status})")

        # 2. Check active road incidents on corridor
        incidents = db.query(Incident).all()
        matching_incidents = []
        cor_sectors = {
            "COR-NH27": ["senapati", "kohima", "dimapur", "kamrup", "guwahati", "imphal"],
            "COR-NH37": ["silchar", "cachar", "jiribam", "imphal", "irang"],
            "COR-NH54": ["silchar", "cachar", "vairengte", "aizawl", "dhaleswari"],
            "COR-NH10": ["siliguri", "teesta", "gangtok", "sikkim"],
            "COR-NH40": ["guwahati", "kamrup", "shillong", "khasi", "barapani"],
            "COR-NH44": ["shillong", "silchar", "cachar", "agartala", "tripura"],
            "COR-NH415": ["banderdewa", "itanagar", "papum pare", "dikrong"]
        }
        sectors = cor_sectors.get(corridor.corridor_code, [corridor.origin.lower(), corridor.destination.lower()])

        for inc in incidents:
            loc_str = f"{inc.location_name or ''} {inc.district_name or ''}".lower()
            loc_match = (
                corridor.name.lower().find(inc.location_name.lower()) != -1 or
                any(sec in loc_str for sec in sectors)
            )
            if loc_match:
                matching_incidents.append(inc)

        for inc in matching_incidents:
            if inc.road_status in ["BLOCKED", "CLOSED"]:
                is_blocked = True
                incident_penalty = 100.0
                risk_level = "CRITICAL"
                delay_mins = max(delay_mins, 150)
                reasons.append(f"Road Blockage: {inc.incident_type} at {inc.location_name}")
            elif inc.severity in ["CRITICAL", "HIGH"]:
                incident_penalty += 35.0
                if risk_level != "CRITICAL":
                    risk_level = "HIGH"
                delay_mins = max(delay_mins, 60)
                reasons.append(f"Disruption: {inc.incident_type} ({inc.road_status})")
            elif inc.severity == "MEDIUM":
                incident_penalty += 18.0
                if risk_level not in ["CRITICAL", "HIGH"]:
                    risk_level = "MEDIUM"
                delay_mins = max(delay_mins, 30)
                reasons.append(f"Hazard: {inc.incident_type}")
            elif inc.severity == "LOW":
                incident_penalty += 8.0
                delay_mins = max(delay_mins, 10)
                reasons.append(f"Minor Disruption: {inc.incident_type}")

        # 3. Check Weather for Corridor origin or destination
        weather_records = db.query(WeatherRecord).filter(
            (WeatherRecord.location_name == corridor.origin) | 
            (WeatherRecord.location_name == corridor.destination)
        ).all()
        for w in weather_records:
            if w.rainfall_mm_hr >= 50.0:
                weather_penalty = max(weather_penalty, 25.0)
                delay_mins += 30
                reasons.append(f"Extreme Monsoon Rain ({w.rainfall_mm_hr} mm/hr) in {w.location_name}")
                if risk_level == "LOW":
                    risk_level = "MEDIUM"
            elif w.rainfall_mm_hr >= 25.0:
                weather_penalty = max(weather_penalty, 15.0)
                delay_mins += 15
                reasons.append(f"Heavy Rain ({w.rainfall_mm_hr} mm/hr) in {w.location_name}")
            elif w.rainfall_mm_hr >= 10.0:
                weather_penalty = max(weather_penalty, 8.0)
                delay_mins += 5

            wind = getattr(w, 'wind_kmh', None) or getattr(w, 'wind_speed_kmh', None) or 0.0
            if wind >= 40.0:
                weather_penalty = max(weather_penalty, 10.0)
                reasons.append(f"High Winds ({wind} km/h) in {w.location_name}")

        # Final calculated score
        if is_blocked:
            score = 0.0
        else:
            total_penalty = incident_penalty + bridge_penalty + weather_penalty
            score = max(0.0, min(100.0, base_score - total_penalty))

        # Determine corridor status
        if is_blocked or score == 0:
            corridor.status = "BLOCKED"
        elif score < 40:
            corridor.status = "RESTRICTED"
        elif score < 75:
            corridor.status = "PARTIAL"
        elif score < 90:
            corridor.status = "PASSABLE"
        else:
            corridor.status = "OPEN"

        corridor.accessibility_score = round(score, 1)
        corridor.risk_level = risk_level
        corridor.estimated_delay_mins = delay_mins
        corridor.incident_count = len(matching_incidents)
        corridor.reason = "; ".join(reasons) if reasons else "Normal road and bridge passage"
        corridor.last_updated = datetime.utcnow()

        return {
            "corridor_code": corridor.corridor_code,
            "status": corridor.status,
            "accessibility_score": corridor.accessibility_score,
            "risk_level": corridor.risk_level,
            "estimated_delay_mins": corridor.estimated_delay_mins,
            "reason": corridor.reason
        }

    @staticmethod
    def recalculate_district_accessibility(district: District, db: Session) -> Dict[str, Any]:
        """
        Calculates district accessibility index (0-100) dynamically derived from:
        - Underlying road/corridor conditions traversing the district (45%)
        - Bridge accessibility in the district (30%)
        - Active incident density & severity in the district (25%)
        """
        # 1. Incidents in district
        incidents = db.query(Incident).filter(
            (Incident.district_name == district.name) |
            Incident.location_name.ilike(f"%{district.name}%")
        ).all()
        district.active_incidents_count = len(incidents)

        incident_penalty = 0.0
        has_blocked_incident = False
        for inc in incidents:
            if inc.road_status in ["BLOCKED", "CLOSED"]:
                incident_penalty += 45.0
                has_blocked_incident = True
            elif inc.severity in ["HIGH", "CRITICAL"]:
                incident_penalty += 25.0
            else:
                incident_penalty += 10.0

        # 2. Bridges in district
        bridges = db.query(Bridge).filter(Bridge.district_name == district.name).all()
        district.bridge_count = len(bridges)
        bridge_avg = 95.0
        if bridges:
            bridge_avg = sum(b.accessibility_score for b in bridges) / len(bridges)

        # 3. Corridors traversing state or district
        corridors = db.query(Corridor).filter(Corridor.states_covered.ilike(f"%{district.state}%")).all()
        corridor_avg = 90.0
        accessible_corridors = 0
        if corridors:
            corridor_avg = sum(c.accessibility_score for c in corridors) / len(corridors)
            accessible_corridors = sum(1 for c in corridors if c.status in ["OPEN", "PASSABLE"])
        district.accessible_corridor_count = accessible_corridors

        # Aggregate Score
        composite_score = (corridor_avg * 0.45) + (bridge_avg * 0.30) - incident_penalty
        if has_blocked_incident:
            composite_score = min(composite_score, 24.0)

        composite_score = round(max(0.0, min(100.0, composite_score)), 1)
        district.accessibility_index = composite_score
        district.status = AccessibilityEngine.get_district_status_label(composite_score)

        if composite_score < 30.0:
            district.critical_supply_status = "CRITICAL_DELAY"
        elif composite_score < 75.0:
            district.critical_supply_status = "AT_RISK"
        else:
            district.critical_supply_status = "STABLE"

        district.last_recalculated = datetime.utcnow()

        return {
            "name": district.name,
            "accessibility_index": district.accessibility_index,
            "status": district.status,
            "critical_supply_status": district.critical_supply_status,
            "active_incidents": district.active_incidents_count,
            "bridge_count": district.bridge_count
        }

    @staticmethod
    def get_bridge_logistics_impact(bridge_id: int, db: Session) -> Dict[str, Any]:
        """Evaluates how a bridge's accessibility status impacts active transport deliveries and vehicles."""
        bridge = db.query(Bridge).filter(Bridge.id == bridge_id).first()
        if not bridge:
            return {"error": "Bridge not found"}

        corridor = db.query(Corridor).filter(Corridor.corridor_code == bridge.corridor_code).first()
        
        # Find deliveries traversing this corridor
        target_dest = corridor.destination if corridor else None
        deliveries = db.query(Delivery).filter(
            Delivery.status.in_(["IN_TRANSIT", "DELAYED", "REROUTED"])
        ).all()

        matching_deliveries = []
        for d in deliveries:
            if target_dest and target_dest in (d.destination_city or ""):
                matching_deliveries.append({
                    "id": d.id,
                    "delivery_code": d.delivery_code,
                    "cargo_name": d.cargo_name,
                    "priority": d.priority,
                    "status": d.status,
                    "route_risk_score": d.route_risk_score,
                    "estimated_delay_mins": d.estimated_delay_mins,
                    "driver_name": d.driver_name,
                    "origin_city": d.origin_city,
                    "destination_city": d.destination_city
                })

        action_recommendation = (
            "Normal transport passage permitted." if bridge.status == "OPERATIONAL"
            else f"Bridge {bridge.name} is {bridge.status}. Reroute heavy supply transports via alternate regional bypass corridors."
        )

        return {
            "bridge_id": bridge.id,
            "bridge_code": bridge.bridge_code,
            "bridge_name": bridge.name,
            "status": bridge.status,
            "accessibility_score": bridge.accessibility_score,
            "connected_corridor": bridge.corridor_code,
            "corridor_status": corridor.status if corridor else "UNKNOWN",
            "affected_vehicles_count": len(matching_deliveries),
            "affected_deliveries_count": len(matching_deliveries),
            "affected_deliveries": matching_deliveries,
            "recommended_action": action_recommendation
        }

    @staticmethod
    def evaluate_transport_impact(db: Session):
        """Connects vehicle telemetry and active deliveries to corridor/bridge accessibility."""
        corridors = {c.corridor_code: c for c in db.query(Corridor).all()}
        deliveries = db.query(Delivery).filter(Delivery.status.in_(["IN_TRANSIT", "DELAYED", "REROUTED"])).all()

        for d in deliveries:
            cor_code = "COR-NH27" if "Imphal" in d.destination_city else ("COR-NH54" if "Aizawl" in d.destination_city else "COR-NH40")
            cor = corridors.get(cor_code)
            if cor:
                if cor.status in ["BLOCKED", "CLOSED"]:
                    d.route_risk_score = 82.0
                    d.route_risk_category = "CRITICAL"
                    d.estimated_delay_mins = max(d.estimated_delay_mins, cor.estimated_delay_mins)
                    d.status = "DELAYED"
                    if d.vehicle:
                        d.vehicle.risk_level = "CRITICAL"
                        d.vehicle.status = "DELAYED"
                elif cor.status == "RESTRICTED":
                    d.route_risk_score = 58.0
                    d.route_risk_category = "HIGH"
                    d.estimated_delay_mins = max(d.estimated_delay_mins, cor.estimated_delay_mins)
                    if d.vehicle:
                        d.vehicle.risk_level = "HIGH"
                elif cor.status in ["OPEN", "PASSABLE"]:
                    if d.status != "REROUTED":
                        d.route_risk_score = 18.0
                        d.route_risk_category = "LOW"
                        if d.vehicle:
                            d.vehicle.risk_level = "LOW"
                            d.vehicle.status = "IN_TRANSIT"

    @classmethod
    def recalculate_all_accessibility(cls, db: Session, source_incident=None) -> Dict[str, Any]:
        """Performs full cascade recalculation across bridges, corridors, districts, and transport.
        After recalculation, fires GAP 18 (BLOCKED_ROAD) and GAP 19 (INACCESSIBLE_REGION) alerts.
        """
        bridges = db.query(Bridge).all()
        for b in bridges:
            cls.recalculate_bridge_accessibility(b, db)

        corridors = db.query(Corridor).all()
        for c in corridors:
            cls.recalculate_corridor_accessibility(c, db)

        districts = db.query(District).all()
        for d in districts:
            cls.recalculate_district_accessibility(d, db)

        cls.evaluate_transport_impact(db)
        db.commit()

        # GAP 18 — Evaluate corridor blocked-road alerts
        try:
            from app.services.operational_alerts_service import BlockedRoadAlertService, InaccessibleRegionAlertService
            blocked_alerts = BlockedRoadAlertService.evaluate_all_corridors(db, source_incident)
            region_alerts = InaccessibleRegionAlertService.evaluate_all_districts(db, source_incident)
            db.commit()  # Commit alert records
        except Exception as e:
            import logging
            logging.getLogger("link_x8.accessibility").warning(f"Alert hook failed: {e}")
            blocked_alerts = []
            region_alerts = []

        return {
            "bridges_recalculated": len(bridges),
            "corridors_recalculated": len(corridors),
            "districts_recalculated": len(districts),
            "blocked_road_alerts_fired": len(blocked_alerts),
            "inaccessible_region_alerts_fired": len(region_alerts),
            "timestamp": datetime.utcnow().isoformat()
        }
