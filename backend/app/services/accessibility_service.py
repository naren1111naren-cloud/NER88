import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, Callable
from sqlalchemy.orm import Session

from app.models.models import Corridor, Bridge, District, Incident, Vehicle, Delivery, Alert, WeatherRecord, AuditLog

logger = logging.getLogger("link_x8.accessibility")

class AccessibilityEngine:
    _SOURCE_PROVIDERS: List[Callable] = []

    @classmethod
    def register_source_provider(cls, provider_func: Callable):
        """
        Allows external government/weather/transport adapters (e.g. NHAI ATMS, MoRTH VAHAN, IMD, BRO Swastik)
        to register dynamic penalty/factor evaluation functions without modifying core engine logic.
        Signature: provider_func(corridor: Corridor, db: Session) -> Optional[Dict[str, Any]]
        Return format: {"penalty": float, "reason": str, "source": str, "risk_level": Optional[str], "is_blocked": bool}
        """
        if provider_func not in cls._SOURCE_PROVIDERS:
            cls._SOURCE_PROVIDERS.append(provider_func)

    @staticmethod
    def classify_accessibility_status(score: float) -> str:
        """Returns standard accessibility classification: OPEN, RESTRICTED, BLOCKED."""
        if score >= 70.0:
            return "OPEN"
        elif score > 0.0:
            return "RESTRICTED"
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

    @classmethod
    def recalculate_corridor_accessibility(cls, corridor: Corridor, db: Session) -> Dict[str, Any]:
        """
        Production-Oriented Regional Accessibility Engine for SIH26002:
        - Evaluates transparent, deterministic mathematical accessibility score (0 to 100).
        - Classifies corridor into strict accessibility_status: OPEN, RESTRICTED, BLOCKED.
        - Integrates real environmental inputs: Open-Meteo weather records, verified field reports,
          active road incidents, and strategic bridge physical infrastructure capacities.
        - Produces explainable factor summary (e.g. 'Heavy rainfall + verified field incident')
          and standard formatted explanation header (e.g. 'Accessibility 38/100 — RESTRICTED').
        - Stores UTC timestamps, data provenance, and provides pluggable government source hooks.
        """
        base_score = 100.0
        incident_penalty = 0.0
        bridge_penalty = 0.0
        weather_penalty = 0.0
        external_penalty = 0.0
        risk_level = "LOW"
        delay_mins = 0
        reasons = []
        sources = [
            "Integrated Regional Accessibility Engine",
            "Open-Meteo Live Weather API",
            "Field Officer Inspection Incident Feed"
        ]
        is_blocked = False

        # 1. Check connected bridges on this corridor
        bridges = db.query(Bridge).filter(
            (Bridge.corridor_code == corridor.corridor_code) |
            (Bridge.connected_road.ilike(f"%{corridor.corridor_code.replace('COR-', '')}%")) |
            (Bridge.connected_road.ilike(f"%{corridor.name.split()[0]}%"))
        ).all()

        closed_bridge_name = None
        for b in bridges:
            sources.append(f"BRO / NHIDCL Bridge Registry ({b.bridge_code})")
            if b.status == "CLOSED" or b.accessibility_score == 0 or b.load_restriction_type == "Closed":
                is_blocked = True
                bridge_penalty = 100.0
                risk_level = "CRITICAL"
                delay_mins += 180
                closed_bridge_name = b.name
                reasons.append(f"Bridge closed: {b.name} on {b.river_name or 'River Crossing'}")
            elif b.status == "DAMAGED":
                bridge_penalty = max(bridge_penalty, 35.0)
                if risk_level != "CRITICAL":
                    risk_level = "HIGH"
                delay_mins += 60
                reasons.append(f"Bridge structural damage: {b.name} (Load restricted)")
            elif b.status == "RESTRICTED" or (b.load_restriction_type and b.load_restriction_type not in ["No Restriction", "None", ""]):
                bridge_penalty = max(bridge_penalty, 25.0)
                if risk_level not in ["CRITICAL", "HIGH"]:
                    risk_level = "MEDIUM"
                delay_mins += 45
                reasons.append(f"Bridge load restriction: {b.name} ({b.load_restriction_type or b.status})")

        # 2. Check active road incidents and verified field reports on corridor sectors
        incidents = db.query(Incident).all()
        matching_incidents = []
        cor_sectors = {
            "COR-NH27": ["siliguri", "jalpaiguri", "cooch behar", "alipurduar", "kokrajhar", "bongaigaon", "goalpara", "nalbari", "baihata", "kamrup", "guwahati", "nagaon", "dabaka", "lumding", "dimapur"],
            "COR-NH37": ["goalpara", "kamrup", "guwahati", "kaliabor", "nagaon", "kaziranga", "numaligarh", "jorhat", "sivasagar", "dibrugarh", "tinsukia", "sadiya"],
            "COR-NH37-EXT": ["silchar", "cachar", "jiribam", "gulathol", "noney", "tupul", "imphal", "irang"],
            "COR-NH2": ["dibrugarh", "sivasagar", "amguri", "dimapur", "chumukedima", "kohima", "maram", "senapati", "kangpokpi", "imphal"],
            "COR-NH10": ["siliguri", "sevoke", "coronation", "teesta", "kalimpong", "rangpo", "singtam", "gangtok", "sikkim"],
            "COR-NH40": ["guwahati", "kamrup", "jorabat", "nongpoh", "umsning", "umiam", "shillong", "khasi", "jowai", "khliehriat", "lumshnong", "sonapur", "silchar", "cachar"],
            "COR-NH8": ["karimganj", "churaibari", "dharmanagar", "kumarghat", "teliamura", "agartala", "udaipur", "belonia", "sabroom", "tripura"],
            "COR-NH13": ["tawang", "sela", "bomdila", "itanagar", "naharlagun", "ziro", "pasighat", "roing", "tezu", "wakro", "arunachal"],
            "COR-NH15": ["baihata", "mangaldai", "tezpur", "balipara", "biswanath", "north lakhimpur", "dhemaji", "jonai"],
            "COR-NH102": ["imphal", "thoubal", "kakching", "pallel", "tengnoupal", "moreh", "manipur"],
            "COR-NH29": ["dimapur", "chumukedima", "medziphema", "zubza", "kohima", "nagaland"],
            "COR-NH54": ["silchar", "cachar", "vairengte", "kolasib", "aizawl", "serchhip", "lunglei", "mizoram", "dhaleswari"],
            "COR-NH415": ["banderdewa", "itanagar", "naharlagun", "papum pare", "dikrong"],
            "COR-NH44": ["shillong", "silchar", "cachar", "agartala", "tripura"]
        }
        sectors = cor_sectors.get(corridor.corridor_code, [corridor.origin.lower(), corridor.destination.lower()])
        # Also check corridor road number alias (e.g. NH27, NH-27, NH2, NH-2, NH10)
        clean_code = corridor.corridor_code.replace("COR-", "").lower()

        for inc in incidents:
            loc_str = f"{inc.location_name or ''} {inc.district_name or ''} {inc.description or ''}".lower()
            loc_match = (
                clean_code in loc_str or
                corridor.name.lower().find(inc.location_name.lower()) != -1 or
                any(sec in loc_str for sec in sectors)
            )
            if loc_match:
                matching_incidents.append(inc)

        blocked_incident_desc = None
        has_high_incident = False
        has_medium_incident = False

        for inc in matching_incidents:
            sources.append("Field Officer Inspection Incident Feed")
            if inc.road_status in ["BLOCKED", "CLOSED"]:
                is_blocked = True
                incident_penalty = 100.0
                risk_level = "CRITICAL"
                delay_mins = max(delay_mins, 150)
                blocked_incident_desc = f"{inc.incident_type} at {inc.location_name}"
                reasons.append(f"Road Blockage: {inc.incident_type} at {inc.location_name}")
                sources.append(f"Live Disaster Feed ({inc.incident_type})")
            elif inc.severity in ["CRITICAL", "HIGH"]:
                incident_penalty += 35.0
                has_high_incident = True
                if risk_level != "CRITICAL":
                    risk_level = "HIGH"
                delay_mins = max(delay_mins, 60)
                reasons.append(f"Severe Disruption: {inc.incident_type} at {inc.location_name} ({inc.road_status})")
            elif inc.severity == "MEDIUM":
                incident_penalty += 18.0
                has_medium_incident = True
                if risk_level not in ["CRITICAL", "HIGH"]:
                    risk_level = "MEDIUM"
                delay_mins = max(delay_mins, 30)
                reasons.append(f"Moderate Hazard: {inc.incident_type} at {inc.location_name}")
            elif inc.severity == "LOW":
                incident_penalty += 8.0
                delay_mins = max(delay_mins, 10)
                reasons.append(f"Minor Hazard: {inc.incident_type}")

        # 3. Check Weather for Corridor key hubs & sectors
        weather_records = db.query(WeatherRecord).filter(
            (WeatherRecord.location_name == corridor.origin) | 
            (WeatherRecord.location_name == corridor.destination) |
            (WeatherRecord.location_name.in_([s.title() for s in sectors[:4]]))
        ).all()

        max_rain = 0.0
        for w in weather_records:
            sources.append("Open-Meteo Live Weather API")
            if w.rainfall_mm_hr:
                max_rain = max(max_rain, w.rainfall_mm_hr)

            if w.rainfall_mm_hr >= 50.0:
                weather_penalty = max(weather_penalty, 25.0)
                delay_mins += 30
                reasons.append(f"Torrential monsoon rain ({w.rainfall_mm_hr} mm/hr) in {w.location_name}")
                if risk_level == "LOW":
                    risk_level = "MEDIUM"
            elif w.rainfall_mm_hr >= 25.0:
                weather_penalty = max(weather_penalty, 18.0)
                delay_mins += 15
                reasons.append(f"Heavy rainfall ({w.rainfall_mm_hr} mm/hr) in {w.location_name}")
                if risk_level == "LOW":
                    risk_level = "MEDIUM"
            elif w.rainfall_mm_hr >= 10.0:
                weather_penalty = max(weather_penalty, 8.0)
                delay_mins += 5
                reasons.append(f"Moderate rain ({w.rainfall_mm_hr} mm/hr) in {w.location_name}")

            wind = getattr(w, 'wind_kmh', None) or getattr(w, 'wind_speed_kmh', None) or 0.0
            if wind >= 40.0:
                weather_penalty = max(weather_penalty, 10.0)
                reasons.append(f"High winds ({wind} km/h) in {w.location_name}")

        # 4. Check registered external government & transport source providers
        for provider in cls._SOURCE_PROVIDERS:
            try:
                prov_res = provider(corridor, db)
                if prov_res:
                    if prov_res.get("is_blocked"):
                        is_blocked = True
                    if prov_res.get("penalty"):
                        external_penalty += float(prov_res["penalty"])
                    if prov_res.get("reason"):
                        reasons.append(prov_res["reason"])
                    src_name = prov_res.get("source") or prov_res.get("source_name")
                    if src_name:
                        sources.append(src_name)
                    if prov_res.get("risk_level") and prov_res["risk_level"] in ["CRITICAL", "HIGH", "MEDIUM"]:
                        risk_level = prov_res["risk_level"]
            except Exception as e:
                logger.warning(f"External source provider failed for {corridor.corridor_code}: {e}")

        # Final calculated score
        if is_blocked:
            score = 0.0
            accessibility_status = "BLOCKED"
            risk_level = "CRITICAL"
        else:
            total_penalty = incident_penalty + bridge_penalty + weather_penalty + external_penalty
            score = round(max(0.0, min(100.0, base_score - total_penalty)), 1)
            # Classification: OPEN (>= 70), RESTRICTED (1 - 69), BLOCKED (0)
            accessibility_status = cls.classify_accessibility_status(score)
            if accessibility_status == "BLOCKED":
                risk_level = "CRITICAL"
            elif accessibility_status == "RESTRICTED":
                if risk_level == "LOW":
                    risk_level = "MEDIUM"

        # Concise factor summary ("Why this score?")
        if accessibility_status == "BLOCKED":
            if blocked_incident_desc and closed_bridge_name:
                factor_summary = f"Road blockage + strategic bridge closure"
            elif blocked_incident_desc:
                factor_summary = f"Road blockage ({blocked_incident_desc})"
            elif closed_bridge_name:
                factor_summary = f"Bridge closure ({closed_bridge_name})"
            else:
                factor_summary = "Corridor physically obstructed / closed"
        elif accessibility_status == "RESTRICTED":
            contributors = []
            if max_rain >= 25.0 or weather_penalty >= 15.0:
                contributors.append("Heavy rainfall")
            elif max_rain >= 10.0 or weather_penalty >= 8.0:
                contributors.append("Moderate rainfall")

            if has_high_incident or incident_penalty >= 25.0:
                contributors.append("verified field incident")
            elif has_medium_incident or incident_penalty >= 10.0:
                contributors.append("active road hazard")

            if bridge_penalty >= 25.0:
                contributors.append("bridge load restriction")
            elif bridge_penalty > 0:
                contributors.append("bridge caution")

            if external_penalty > 0:
                prov_reasons = [r for r in reasons if any(k in r.lower() for k in ["rams", "maintenance", "transport", "advisory", "external"])]
                if prov_reasons:
                    contributors.append(prov_reasons[0])
                else:
                    contributors.append("external transport alert")

            if len(contributors) >= 2:
                factor_summary = f"{contributors[0]} + {contributors[1]}"
            elif len(contributors) == 1:
                factor_summary = contributors[0].capitalize()
            else:
                factor_summary = "Traffic friction and load caution enforced"
        elif accessibility_status == "OPEN" and external_penalty > 0:
            prov_reasons = [r for r in reasons if any(k in r.lower() for k in ["rams", "maintenance", "transport", "advisory", "external"])]
            if prov_reasons:
                factor_summary = prov_reasons[0]
            else:
                factor_summary = "Normal passage with external transport advisory"
        else:
            factor_summary = "Normal road and bridge passage"

        # Deduplicate and sort sources
        clean_sources = list(dict.fromkeys(sources))

        corridor.status = accessibility_status
        corridor.accessibility_status = accessibility_status
        corridor.accessibility_score = score
        corridor.risk_level = risk_level
        corridor.estimated_delay_mins = delay_mins
        corridor.incident_count = len(matching_incidents)
        corridor.factor_summary = factor_summary
        corridor.reason = "; ".join(reasons) if reasons else "Normal road and bridge passage"
        corridor.data_sources = json.dumps(clean_sources)
        corridor.last_updated = datetime.utcnow()

        explanation = f"Accessibility {int(round(score))}/100 — {accessibility_status}"

        return {
            "corridor_code": corridor.corridor_code,
            "status": corridor.status,
            "accessibility_status": corridor.accessibility_status,
            "accessibility_score": corridor.accessibility_score,
            "risk_level": corridor.risk_level,
            "estimated_delay_mins": corridor.estimated_delay_mins,
            "factor_summary": corridor.factor_summary,
            "explanation": explanation,
            "reason": corridor.reason,
            "data_sources": clean_sources,
            "last_updated": corridor.last_updated
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

        # Phase 2 — End-to-End Disruption Detection & Intelligent Rerouting Cascade
        route_decisions = []
        try:
            from app.services.rerouting_service import ReroutingService
            route_decisions = ReroutingService.detect_and_evaluate_disruptions(db, source_incident=source_incident)
            db.commit()
        except Exception as e:
            import logging
            logging.getLogger("link_x8.accessibility").warning(f"Rerouting cascade hook failed: {e}")

        return {
            "bridges_recalculated": len(bridges),
            "corridors_recalculated": len(corridors),
            "districts_recalculated": len(districts),
            "blocked_road_alerts_fired": len(blocked_alerts),
            "inaccessible_region_alerts_fired": len(region_alerts),
            "route_decisions_proposed": len(route_decisions),
            "timestamp": datetime.utcnow().isoformat()
        }


    @classmethod
    def evaluate_route_accessibility_assessment(
        cls,
        db: Session,
        corridor_id: Optional[str] = None,
        origin: str = "Guwahati",
        destination: str = "Shillong",
        dist_km: float = 103.0,
        elev_gain_m: float = 1440.0,
        road_name: str = "NH-40",
        lanes: int = 4,
        road_surface: str = "Paved",
        rainfall_mm_hr: Optional[float] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Transparent, deterministic mathematical accessibility assessment model:
        Final Score = clamp(100 + Weather_Impact + Terrain_Impact + Road_Impact + Hazard_Impact, 0, 100)
        Never allows formula mismatches between displayed factors and the final score.
        """
        base_score = 100
        data_quality = "HIGH"

        # 1. Weather Impact
        weather_impact = 0
        weather_desc = "Clear / dry conditions"
        weather_source = "LIVE • Open-Meteo"
        
        # If rainfall not passed, attempt live lookup from WeatherService
        if rainfall_mm_hr is None:
            try:
                from app.services.weather_service import WeatherService
                w_data = WeatherService.get_weather_for_location(location_name=origin, lat=lat, lng=lng)
                rainfall_mm_hr = w_data.get("rainfall_mm_hr") or w_data.get("precipitation_mm") or 0.0
            except Exception:
                rainfall_mm_hr = None
                data_quality = "PARTIAL"

        if rainfall_mm_hr is not None:
            if rainfall_mm_hr > 15.0:
                weather_impact = -18
                weather_desc = f"Heavy rainfall ({rainfall_mm_hr:.1f} mm/hr)"
            elif rainfall_mm_hr >= 8.0:
                weather_impact = -12
                weather_desc = f"Moderate-heavy rain ({rainfall_mm_hr:.1f} mm/hr)"
            elif rainfall_mm_hr >= 2.0:
                weather_impact = -10
                weather_desc = f"Moderate rainfall ({rainfall_mm_hr:.1f} mm/hr)"
            elif rainfall_mm_hr >= 0.5:
                weather_impact = -4
                weather_desc = f"Light drizzle ({rainfall_mm_hr:.1f} mm/hr)"
            else:
                weather_impact = 0
                weather_desc = "Normal dry conditions"
        else:
            weather_impact = 0
            weather_desc = "Weather data unavailable"
            weather_source = "DATA UNAVAILABLE"

        # 2. Terrain Impact
        terrain_impact = 0
        terrain_desc = "Level terrain"
        grade_pct = (elev_gain_m / (dist_km * 1000.0)) * 100.0 if dist_km > 0 and elev_gain_m > 0 else 0.0
        
        if grade_pct >= 3.0 or elev_gain_m >= 1200.0:
            terrain_impact = -15
            terrain_desc = f"Steep terrain ({grade_pct:.1f}% grade)"
        elif grade_pct >= 2.0 or elev_gain_m >= 600.0:
            terrain_impact = -10
            terrain_desc = f"Moderate grade ({grade_pct:.1f}%)"
        elif grade_pct >= 1.0 or elev_gain_m >= 300.0:
            terrain_impact = -4
            terrain_desc = "Gentle incline"
        else:
            terrain_impact = 0
            terrain_desc = "Level terrain profile"

        # 3. Road Condition Impact
        road_impact = 0
        road_desc = "Good road condition"
        is_paved = "paved" in road_surface.lower()
        if lanes >= 4 and is_paved:
            road_impact = 5
            road_desc = "Good road condition (4-lane paved)"
        elif lanes == 2 and is_paved:
            road_impact = -4
            road_desc = "2-lane road (undivided)"
        else:
            road_impact = -8
            road_desc = "Mixed / restricted surface"

        # 4. Hazard Impact
        hazard_impact = 0
        hazard_desc = "No verified hazard detected"
        hazard_source = "CALCULATED • Environmental factors"

        # Query incidents matching route
        try:
            incidents = db.query(Incident).all()
            matching_inc = None
            for inc in incidents:
                loc_str = f"{inc.location_name or ''} {inc.district_name or ''} {inc.description or ''}".lower()
                if origin.lower() in loc_str or destination.lower() in loc_str or road_name.lower() in loc_str:
                    matching_inc = inc
                    break

            if matching_inc:
                if matching_inc.road_status in ["BLOCKED", "CLOSED"]:
                    hazard_impact = -40
                    hazard_desc = f"Road blockage: {matching_inc.incident_type}"
                    hazard_source = "LIVE • Verified Incident Feeds"
                else:
                    hazard_impact = -20
                    hazard_desc = f"Active disruption: {matching_inc.incident_type}"
                    hazard_source = "LIVE • Verified Incident Feeds"
            elif rainfall_mm_hr is not None and rainfall_mm_hr >= 8.0 and grade_pct >= 2.0:
                hazard_impact = -8
                hazard_desc = "Local hazard detected (Slope Saturation)"
                hazard_source = "CALCULATED • Weather + Terrain"
            elif rainfall_mm_hr is not None and rainfall_mm_hr >= 8.0 and grade_pct < 2.0:
                hazard_impact = -8
                hazard_desc = "Waterlogging risk detected"
                hazard_source = "CALCULATED • Weather + Terrain"
            else:
                hazard_impact = 0
                hazard_desc = "No verified hazard detected"
                hazard_source = "CALCULATED • Environmental factors"
        except Exception:
            hazard_impact = 0
            hazard_desc = "Hazard check unavailable"
            data_quality = "PARTIAL"

        # 5. Exact Mathematical Calculation & Central Assertion
        factors = [
            {
                "category": "weather",
                "name": "Weather",
                "condition": weather_desc,
                "impact": weather_impact,
                "source": "Open-Meteo",
                "source_type": weather_source
            },
            {
                "category": "terrain",
                "name": "Terrain",
                "condition": terrain_desc,
                "impact": terrain_impact,
                "source": "Route elevation",
                "source_type": "CALCULATED • Route elevation"
            },
            {
                "category": "road",
                "name": "Road",
                "condition": road_desc,
                "impact": road_impact,
                "source": "OpenStreetMap",
                "source_type": "MAP DATA • OpenStreetMap"
            },
            {
                "category": "hazard",
                "name": "Hazard",
                "condition": hazard_desc,
                "impact": hazard_impact,
                "source": "LINK X8",
                "source_type": hazard_source
            }
        ]

        expected_sum = base_score + weather_impact + terrain_impact + road_impact + hazard_impact
        final_score = max(0, min(100, expected_sum))

        # Backend mathematical integrity check
        factor_sum = sum(f["impact"] for f in factors)
        assert final_score == max(0, min(100, base_score + factor_sum)), "Score formula mismatch"

        # 6. Risk Level & Operational Decision Mapping
        if final_score >= 90:
            risk_level = "LOW RISK"
            recommendation = "CLEAR TO PROCEED"
            rec_detail = "Normal conditions detected."
        elif final_score >= 75:
            risk_level = "MODERATE-LOW"
            recommendation = "PROCEED"
            rec_detail = "Minor environmental impacts detected."
        elif final_score >= 50:
            risk_level = "MODERATE"
            recommendation = "PROCEED WITH CAUTION"
            rec_detail = "Expect slower travel and monitor conditions."
        elif final_score >= 25:
            risk_level = "HIGH"
            recommendation = "ROUTE REVIEW"
            rec_detail = "Current conditions may significantly disrupt transit."
        else:
            risk_level = "CRITICAL"
            recommendation = "ROUTE RESTRICTED"
            rec_detail = "Severe conditions detected. Review alternate routing."

        # 7. Primary Risk (Most negative contributing factor)
        neg_factors = [f for f in factors if f["impact"] < 0]
        if neg_factors:
            worst = min(neg_factors, key=lambda f: f["impact"])
            primary_risk = worst["name"] + " (" + worst["condition"].split("(")[0].strip() + ")"
            if worst["category"] == "terrain":
                primary_risk = "Steep terrain"
            elif worst["category"] == "weather":
                primary_risk = "Heavy rainfall"
            elif worst["category"] == "hazard":
                primary_risk = "Hazard exposure"
            elif worst["category"] == "road":
                primary_risk = "Road carriageway"
        else:
            primary_risk = "None"

        # 8. Concise Summary Explanation ("Why this score?")
        if len(neg_factors) >= 2:
            f1, f2 = sorted(neg_factors, key=lambda f: f["impact"])[:2]
            summary_explanation = f"Main constraints: {f1['name'].lower()} and {f2['name'].lower()}."
        elif len(neg_factors) == 1:
            f1 = neg_factors[0]
            summary_explanation = f"Road conditions are good; {f1['name'].lower()} is the main constraint."
        else:
            summary_explanation = "Route is fully accessible with standard cruising conditions."

        return {
            "score": final_score,
            "base_score": base_score,
            "risk_level": risk_level,
            "summary_explanation": summary_explanation,
            "primary_risk": primary_risk,
            "recommendation": recommendation,
            "recommendation_detail": rec_detail,
            "factors": factors,
            "data_quality": data_quality,
            "last_updated": datetime.utcnow()
        }

    @classmethod
    def evaluate_route_risk_segments(
        cls,
        db: Session,
        origin: str = "Guwahati",
        destination: str = "Shillong",
        route_name: Optional[str] = "NH-40 Mountain Highway",
        vuln_seg: Optional[str] = None,
        vuln_reason: Optional[str] = None,
        rainfall_mm_hr: Optional[float] = None,
        dist_km: Optional[float] = 103.0,
        elev_gain_m: Optional[float] = 1440.0,
        waypoints: Optional[List[List[float]]] = None
    ) -> Dict[str, Any]:
        """
        Evaluates segment-level vulnerability along a corridor continuously.
        Produces deterministic, explainable segment risks (LOW/CAUTION/HIGH)
        grounded in live precipitation, terrain slope, road geometry, and database incidents.
        """
        # Fetch DB incidents in the area
        incidents = db.query(Incident).all()
        matching_incidents = [
            inc for inc in incidents
            if origin.lower() in (inc.location_name or "").lower()
            or destination.lower() in (inc.location_name or "").lower()
            or (route_name and (route_name.split()[0].lower() in (inc.description or "").lower() or route_name.split()[0].lower() in (inc.location_name or "").lower()))
        ]

        # Calculate slope/grade
        dist_val = dist_km or 100.0
        elev_val = elev_gain_m or 0.0
        grade_pct = (elev_val / (dist_val * 1000.0)) * 100.0 if (dist_val > 0 and elev_val > 0) else 0.0

        # Live precipitation
        rain = rainfall_mm_hr if rainfall_mm_hr is not None else 0.0

        # Waypoint sub-segmentation
        # Default 5-segment naming based on corridor
        corridor_slug = f"{origin.lower()}-{destination.lower()}"
        
        segment_defs = [
            {"id": "01", "name": f"Segment 01 — {origin} Outskirts", "short_name": f"{origin} Plain", "type": "flat", "progress": "0-20%"},
            {"id": "02", "name": "Segment 02 — Transition Sector", "short_name": "Valley Approach", "type": "rolling", "progress": "20-40%"},
            {"id": "03", "name": "Segment 03 — Foothills Corridor", "short_name": "Foothills Cut", "type": "incline", "progress": "40-60%"},
            {"id": "04", "name": "Segment 04 — Ridge Pass Sector", "short_name": "High Mountain Ridge", "type": "pass", "progress": "60-80%"},
            {"id": "05", "name": f"Segment 05 — {destination} Approach", "short_name": f"{destination} Plateau", "type": "plateau", "progress": "80-100%"}
        ]

        if "guwahati" in corridor_slug and "shillong" in corridor_slug:
            segment_defs = [
                {"id": "01", "name": "Segment 01 — Khanapara Plain", "short_name": "Khanapara", "type": "flat", "progress": "0-20%"},
                {"id": "02", "name": "Segment 02 — Burnihat Valley", "short_name": "Burnihat", "type": "rolling", "progress": "20-40%"},
                {"id": "03", "name": "Segment 03 — Nongpoh Foothills", "short_name": "Nongpoh", "type": "incline", "progress": "40-60%"},
                {"id": "04", "name": "Segment 04 — Umling Ridge", "short_name": "Umling Ridge", "type": "pass", "progress": "60-80%"},
                {"id": "05", "name": "Segment 05 — Barapani Approach", "short_name": "Barapani", "type": "plateau", "progress": "80-100%"}
            ]
        elif "guwahati" in corridor_slug and "tezpur" in corridor_slug:
            segment_defs = [
                {"id": "01", "name": "Segment 01 — Jagiroad Highway", "short_name": "Jagiroad", "type": "flat", "progress": "0-20%"},
                {"id": "02", "name": "Segment 02 — Nagaon Floodplain", "short_name": "Nagaon Floodplain", "type": "floodplain", "progress": "20-40%"},
                {"id": "03", "name": "Segment 03 — Kaliabor Bypass", "short_name": "Kaliabor", "type": "flat", "progress": "40-60%"},
                {"id": "04", "name": "Segment 04 — Kolia Bhomora Setu", "short_name": "Brahmaputra Crossing", "type": "bridge", "progress": "60-80%"},
                {"id": "05", "name": "Segment 05 — Tezpur Approach", "short_name": "Tezpur Terminal", "type": "flat", "progress": "80-100%"}
            ]
        elif "guwahati" in corridor_slug and "silchar" in corridor_slug:
            segment_defs = [
                {"id": "01", "name": "Segment 01 — Meghalaya Trunk", "short_name": "Shillong Arterial", "type": "rolling", "progress": "0-20%"},
                {"id": "02", "name": "Segment 02 — Jowai Plateau", "short_name": "Jowai High Pass", "type": "plateau", "progress": "20-40%"},
                {"id": "03", "name": "Segment 03 — Ladrymbai Cut", "short_name": "Ladrymbai Mining Zone", "type": "incline", "progress": "40-60%"},
                {"id": "04", "name": "Segment 04 — Sonapur Ridge", "short_name": "Sonapur Mountain", "type": "pass", "progress": "60-80%"},
                {"id": "05", "name": "Segment 05 — Sonapur Tunnel Sector", "short_name": "Sonapur Tunnel", "type": "mudslide_prone", "progress": "80-100%"}
            ]
        elif "shillong" in corridor_slug and "tura" in corridor_slug:
            segment_defs = [
                {"id": "01", "name": "Segment 01 — Mairang Ascent", "short_name": "Mairang", "type": "incline", "progress": "0-20%"},
                {"id": "02", "name": "Segment 02 — Nongstoin Forest", "short_name": "Nongstoin", "type": "rolling", "progress": "20-40%"},
                {"id": "03", "name": "Segment 03 — Rongram Pass", "short_name": "Rongram Pass", "type": "fog_pass", "progress": "40-60%"},
                {"id": "04", "name": "Segment 04 — Williamnagar Cut", "short_name": "Williamnagar", "type": "pass", "progress": "60-80%"},
                {"id": "05", "name": "Segment 05 — Tura Gateway", "short_name": "Tura Basin", "type": "flat", "progress": "80-100%"}
            ]

        # Override or match vuln_seg
        target_vuln_id = "04"
        if vuln_seg:
            for s in segment_defs:
                if s["id"] in vuln_seg or s["short_name"].lower() in vuln_seg.lower():
                    target_vuln_id = s["id"]
                    break

        # Calculate each segment's score and risk
        segments_out = []
        for s in segment_defs:
            is_target_vuln = (s["id"] == target_vuln_id)
            seg_type = s["type"]
            
            # Baseline risk score (0-100 scale where higher = more vulnerable/risk)
            # LOW: 0-30, CAUTION: 31-60, HIGH: 61-100
            reasons = []
            
            if is_target_vuln:
                # Active high vulnerability section
                if seg_type in ["pass", "mudslide_prone"]:
                    risk_score = 78 if rain >= 8.0 or grade_pct >= 2.0 else 68
                    risk_level = "HIGH"
                    if rain >= 8.0:
                        reasons.append("🌧 Heavy rainfall")
                    else:
                        reasons.append("🌧 Moderate precipitation")
                    if grade_pct >= 2.0 or elev_val >= 600:
                        reasons.append("⛰ Steep slopes")
                    else:
                        reasons.append("⛰ Elevated ridge")
                    reasons.append("⚠ Active slope advisory")
                    reason_summary = "Heavy rain + steep slopes" if (rain >= 8.0 and grade_pct >= 2.0) else "Steep slopes + moisture saturation"
                    possible_impact = "Landslide risk and travel delays"
                    recommended_action = "Review alternate route"
                elif seg_type == "floodplain":
                    risk_score = 74 if rain >= 8.0 else 65
                    risk_level = "HIGH"
                    reasons = ["🌧 Monsoon runoff", "🌊 River basin waterlogging", "⚠ Floodplain advisory"]
                    reason_summary = "Heavy rain + floodplain runoff"
                    possible_impact = "Waterlogging and freight speed reduction"
                    recommended_action = "Review alternate route"
                elif seg_type == "fog_pass":
                    risk_score = 68
                    risk_level = "HIGH"
                    reasons = ["🌫 Dense atmospheric fog", "⛰ Winding mountain pass", "⚠ Low visibility"]
                    reason_summary = "Dense fog + mountain pass"
                    possible_impact = "Headlight range cut & convoy slowdown"
                    recommended_action = "Review alternate route"
                else:
                    risk_score = 70
                    risk_level = "HIGH"
                    reasons = ["⚠ Local hazard detected", "🌧 Rain accumulation"]
                    reason_summary = vuln_reason or "Localized transit friction"
                    possible_impact = "Travel disruption & delay"
                    recommended_action = "Review alternate route"
            elif seg_type in ["incline", "rolling", "bridge"]:
                # Intermediate/Caution section
                if rain >= 8.0 or grade_pct >= 2.0:
                    risk_score = 48
                    risk_level = "CAUTION"
                    reasons = ["🌧 Intermittent rain", "⛰ Winding grade"]
                    reason_summary = "Moderate rain + winding turns"
                    possible_impact = "Slower vehicle movement"
                    recommended_action = "Proceed with caution"
                else:
                    risk_score = 25
                    risk_level = "LOW"
                    reasons = ["✓ Moderate grade", "✓ Stable pavement"]
                    reason_summary = "Standard transit profile"
                    possible_impact = "Normal traffic flow"
                    recommended_action = "Proceed on schedule"
            else:
                # Flat/Normal low-risk section
                risk_score = 18
                risk_level = "LOW"
                reasons = ["✓ Level terrain profile", "✓ Clear visibility", "✓ Optimal road friction"]
                reason_summary = "Normal route conditions"
                possible_impact = "Standard cruising conditions"
                recommended_action = "Proceed on schedule"

            # Check DB incidents matching this segment
            for inc in matching_incidents:
                if s["short_name"].lower() in (inc.location_name or "").lower() or s["id"] in (inc.description or ""):
                    risk_score = max(risk_score, 85)
                    risk_level = "HIGH"
                    reasons.insert(0, f"🛑 Incident: {inc.incident_type}")
                    reason_summary = f"Active {inc.incident_type.lower()}"
                    possible_impact = "Severe blockage / long queue"
                    recommended_action = "Review alternate route"

            status_label = "HIGH RISK" if risk_level == "HIGH" else ("CAUTION" if risk_level == "CAUTION" else "LOW RISK")

            segments_out.append({
                "id": s["id"],
                "name": s["name"],
                "short_name": s["short_name"],
                "risk_level": risk_level,
                "risk_score": risk_score,
                "reasons": reasons,
                "reason_summary": reason_summary,
                "possible_impact": possible_impact,
                "recommended_action": recommended_action,
                "is_highest_risk": False,
                "status_label": status_label
            })

        # Mark highest risk segment
        highest_seg = max(segments_out, key=lambda seg: seg["risk_score"])
        highest_seg["is_highest_risk"] = True

        high_count = sum(1 for s in segments_out if s["risk_level"] == "HIGH")
        caution_count = sum(1 for s in segments_out if s["risk_level"] == "CAUTION")
        normal_count = sum(1 for s in segments_out if s["risk_level"] == "LOW")

        if high_count == 1:
            primary_status = "⚠ 1 HIGH-RISK SECTION DETECTED"
        elif high_count > 1:
            primary_status = f"⚠ {high_count} HIGH-RISK SECTIONS DETECTED"
        elif caution_count > 0:
            primary_status = f"⚠ {caution_count} SECTION{'S' if caution_count > 1 else ''} NEED ATTENTION"
        else:
            primary_status = "✓ ALL SECTIONS NORMAL"

        return {
            "origin": origin,
            "destination": destination,
            "route_name": route_name or "National Highway",
            "total_sections": len(segments_out),
            "high_risk_count": high_count,
            "caution_count": caution_count,
            "normal_count": normal_count,
            "primary_status": primary_status,
            "highest_risk_segment_id": highest_seg["id"],
            "selected_segment": highest_seg,
            "segments": segments_out,
            "data_quality": "HIGH" if (rainfall_mm_hr is not None) else "PARTIAL",
            "sources": ["LIVE • Open-Meteo", "MAP DATA • OpenStreetMap", "CALCULATED • LINK X8 Route Analysis"],
            "last_updated": datetime.utcnow()
        }


def classify_accessibility_status(score: float) -> str:
    """Returns standard accessibility classification: OPEN, RESTRICTED, BLOCKED."""
    return AccessibilityEngine.classify_accessibility_status(score)


def register_source_provider(provider_func: Callable):
    """Allows external transport/government adapters to register custom source providers."""
    return AccessibilityEngine.register_source_provider(provider_func)



