import json
import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

NER_NODES = {
    "Guwahati": [26.1445, 91.7362],
    "Shillong": [25.5788, 91.8933],
    "Nagaon": [26.3467, 92.6840],
    "Jorhat": [26.7509, 94.2037],
    "Dimapur": [25.9060, 93.7273],
    "Kohima": [25.6751, 94.1086],
    "Senapati": [25.2676, 94.0210],
    "Imphal": [24.8170, 93.9368],
    "Silchar": [24.8333, 92.7789],
    "Jiribam": [24.8030, 93.1180],
    "Aizawl": [23.7271, 92.7176],
    "Agartala": [23.8315, 91.2868],
    "Itanagar": [27.0844, 93.6053],
    "Gangtok": [27.3389, 88.6065]
}

# Standard Strategic Trunk Waypoints
PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS = [
    [26.1445, 91.7362], # Guwahati
    [26.1850, 92.1500], # Jagiroad
    [26.3467, 92.6840], # Nagaon
    [26.1500, 93.2000], # Dabaka
    [25.9060, 93.7273], # Dimapur
    [25.6751, 94.1086], # Kohima
    [25.2676, 94.0210], # Senapati (Landslide blockage pass)
    [24.9500, 93.9800], # Kangpokpi
    [24.8170, 93.9368]  # Imphal
]

ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS = [
    [26.1445, 91.7362], # Guwahati
    [25.5788, 91.8933], # Shillong
    [25.1800, 92.3000], # Jowai
    [24.8333, 92.7789], # Silchar
    [24.8030, 93.1180], # Jiribam (NH37 Western Corridor)
    [24.7500, 93.5000], # Noney
    [24.8170, 93.9368]  # Imphal
]

ROUTE_C_NORTHERN_WAYPOINTS = [
    [26.1445, 91.7362], # Guwahati
    [26.7509, 94.2037], # Jorhat
    [26.5000, 94.5000], # Golaghat
    [25.9060, 93.7273], # Dimapur
    [25.5000, 94.3000], # Ukhrul Bypass (NH102A)
    [24.8170, 93.9368]  # Imphal
]

# Master SIH Demonstration Corridor Waypoints: Guwahati -> Shillong (GS Road & Bypass)
PRIMARY_GUWAHATI_SHILLONG_WAYPOINTS = [
    [26.1445, 91.7362], # Guwahati (Khanapara / Basistha Interchange)
    [26.1050, 91.8200], # Jorabat Gateway
    [25.9000, 91.8800], # Nongpoh (Mid-corridor checkpoint)
    [25.7500, 91.9000], # Umsning Bypass
    [25.6600, 91.9100], # Umiam / Barapani Lake
    [25.5788, 91.8933]  # Shillong (Civil Hospital Hub / Police Bazar)
]

ALTERNATE_GUWAHATI_SHILLONG_WAYPOINTS = [
    [26.1445, 91.7362], # Guwahati
    [26.1850, 92.1500], # Jagiroad (NH27 East Link)
    [25.9200, 92.2100], # Karbi Hills Bypass / Baithalangso
    [25.6800, 92.0200], # Bhoirymbong Link (Shillong Eastern Bypass)
    [25.6100, 91.9500], # NEIGRIHMS Junction
    [25.5788, 91.8933]  # Shillong
]

OPTIMIZATION_OBJECTIVES = {
    "BALANCED": {
        "title": "Balanced Multi-Factor Optimization",
        "description": "Optimizes a harmonic balance between travel time, physical distance, weather hazards, and route risk.",
        "weights": {
            "risk": 0.30,
            "time": 0.25,
            "weather": 0.15,
            "resilience": 0.15,
            "distance": 0.15
        }
    },
    "SAFEST": {
        "title": "Maximum Safety & Low Hazard",
        "description": "Prioritizes minimal landslide, flood, and weather hazard risks, even if route length increases.",
        "weights": {
            "risk": 0.45,
            "weather": 0.25,
            "resilience": 0.20,
            "time": 0.05,
            "distance": 0.05
        }
    },
    "FASTEST": {
        "title": "Fastest Transit Time",
        "description": "Prioritizes shortest travel duration and lowest transit delays for urgent emergency consignments.",
        "weights": {
            "time": 0.50,
            "distance": 0.25,
            "risk": 0.15,
            "weather": 0.05,
            "resilience": 0.05
        }
    },
    "MOST_RESILIENT": {
        "title": "Corridor Resilience & Bridge Integrity",
        "description": "Prioritizes strategic highway corridors with verified bridge load capacities and high district accessibility scores.",
        "weights": {
            "resilience": 0.35,
            "accessibility": 0.25,
            "risk": 0.20,
            "weather": 0.10,
            "time": 0.10
        }
    }
}

class RoutingService:
    @staticmethod
    def calculate_distance_km(coord1: List[float], coord2: List[float]) -> float:
        """Great-circle distance in kilometers."""
        lat1, lon1 = coord1
        lat2, lon2 = coord2
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)

    @staticmethod
    def calculate_path_length_km(waypoints: List[List[float]]) -> float:
        """Calculates cumulative route distance along a sequence of waypoints."""
        total = 0.0
        for i in range(len(waypoints) - 1):
            total += RoutingService.calculate_distance_km(waypoints[i], waypoints[i+1])
        return round(total, 1)

    @staticmethod
    def generate_candidate_paths(origin: str, destination: str) -> List[Dict[str, Any]]:
        """
        Generates topologically feasible candidate routes between NER origin and destination hubs.
        Returns a list of candidate route definitions with distinct corridor codes and waypoints.
        """
        norm_orig = origin.strip().title()
        norm_dest = destination.strip().title()

        # Primary Trunk: Guwahati -> Imphal
        if ("Guwahati" in norm_orig or "Imphal" in norm_orig) and ("Imphal" in norm_dest or "Guwahati" in norm_dest):
            return [
                {
                    "id": "ROUTE_A",
                    "name": "Route A (via Kohima - NH27/NH2)",
                    "corridor_code": "COR-NH27",
                    "distance_km": 480.0,
                    "estimated_travel_time_hours": 11.0,
                    "estimated_delay_mins": 0,
                    "base_risk_score": 18.0,
                    "accessibility_score": 92.0,
                    "resilience_score": 85.0,
                    "bridge_clearance_status": "OPERATIONAL (Max 40T)",
                    "traffic_congestion_index": 0.35,
                    "waypoints": PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS
                },
                {
                    "id": "ROUTE_B",
                    "name": "Route B (via Silchar / Jiribam - NH37)",
                    "corridor_code": "COR-NH37",
                    "distance_km": 535.0,
                    "estimated_travel_time_hours": 13.5,
                    "estimated_delay_mins": 35,
                    "base_risk_score": 38.0,
                    "accessibility_score": 84.0,
                    "resilience_score": 78.0,
                    "bridge_clearance_status": "OPERATIONAL (Irang Bailey Bridge 24T)",
                    "traffic_congestion_index": 0.25,
                    "waypoints": ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS
                },
                {
                    "id": "ROUTE_C",
                    "name": "Route C (via Upper Assam / Ukhrul - NH102A)",
                    "corridor_code": "COR-NH102A",
                    "distance_km": 590.0,
                    "estimated_travel_time_hours": 15.0,
                    "estimated_delay_mins": 90,
                    "base_risk_score": 55.0,
                    "accessibility_score": 68.0,
                    "resilience_score": 60.0,
                    "bridge_clearance_status": "RESTRICTED (Single-lane span)",
                    "traffic_congestion_index": 0.20,
                    "waypoints": ROUTE_C_NORTHERN_WAYPOINTS
                }
            ]

        # Master Scenario: Guwahati -> Shillong Corridor (NH40 vs NH106 Eastern Bypass)
        if ("Guwahati" in norm_orig or "Shillong" in norm_orig) and ("Shillong" in norm_dest or "Guwahati" in norm_dest):
            return [
                {
                    "id": "ROUTE_A",
                    "name": "Route A (Direct GS Road - NH40)",
                    "corridor_code": "COR-NH40",
                    "distance_km": 98.0,
                    "estimated_travel_time_hours": 2.5,
                    "estimated_delay_mins": 0,
                    "base_risk_score": 18.0,
                    "accessibility_score": 94.0,
                    "resilience_score": 86.0,
                    "bridge_clearance_status": "OPERATIONAL (Umiam Bridge Verified)",
                    "traffic_congestion_index": 0.35,
                    "waypoints": PRIMARY_GUWAHATI_SHILLONG_WAYPOINTS
                },
                {
                    "id": "ROUTE_B",
                    "name": "Route B (Eastern Bypass via Jagiroad - Bhoirymbong / NH106)",
                    "corridor_code": "COR-NH106-BYPASS",
                    "distance_km": 134.0,
                    "estimated_travel_time_hours": 3.8,
                    "estimated_delay_mins": 78,
                    "base_risk_score": 28.0,
                    "accessibility_score": 88.0,
                    "resilience_score": 80.0,
                    "bridge_clearance_status": "OPERATIONAL (Dual Lane Verified)",
                    "traffic_congestion_index": 0.20,
                    "waypoints": ALTERNATE_GUWAHATI_SHILLONG_WAYPOINTS
                },
                {
                    "id": "ROUTE_C",
                    "name": "Route C (Western Hill Trunk via Rani / Byrnihat Rural Link)",
                    "corridor_code": "COR-WEST-RURAL",
                    "distance_km": 148.0,
                    "estimated_travel_time_hours": 4.5,
                    "estimated_delay_mins": 120,
                    "base_risk_score": 46.0,
                    "accessibility_score": 72.0,
                    "resilience_score": 65.0,
                    "bridge_clearance_status": "RESTRICTED (Single-lane hill culverts)",
                    "traffic_congestion_index": 0.15,
                    "waypoints": [
                        [26.1445, 91.7362], # Guwahati
                        [26.0400, 91.6200], # Rani Reserve
                        [25.8500, 91.7000], # Nongkhyllem Link
                        [25.5788, 91.8933]  # Shillong
                    ]
                }
            ]

        # Inter-state pairs (e.g. Silchar -> Agartala, etc.)
        orig_pt = NER_NODES.get(norm_orig, [26.1445, 91.7362])
        dest_pt = NER_NODES.get(norm_dest, [24.8170, 93.9368])
        base_dist = RoutingService.calculate_distance_km(orig_pt, dest_pt)

        # Build Candidate 1 (Direct primary)
        direct_wpts = [orig_pt, [round((orig_pt[0]+dest_pt[0])/2, 4), round((orig_pt[1]+dest_pt[1])/2, 4)], dest_pt]
        direct_dist = round(base_dist * 1.25, 1)

        # Build Candidate 2 (Regional Bypass)
        mid_lat = (orig_pt[0] + dest_pt[0]) / 2 + 0.25
        mid_lng = (orig_pt[1] + dest_pt[1]) / 2 - 0.20
        alt_wpts = [orig_pt, [round(mid_lat, 4), round(mid_lng, 4)], dest_pt]
        alt_dist = round(base_dist * 1.45, 1)

        # Build Candidate 3 (State Highway detour)
        mid_lat_3 = (orig_pt[0] + dest_pt[0]) / 2 - 0.30
        mid_lng_3 = (orig_pt[1] + dest_pt[1]) / 2 + 0.35
        detour_wpts = [orig_pt, [round(mid_lat_3, 4), round(mid_lng_3, 4)], dest_pt]
        detour_dist = round(base_dist * 1.65, 1)

        return [
            {
                "id": "ROUTE_A",
                "name": f"Route A (Primary Corridor {norm_orig} -> {norm_dest})",
                "corridor_code": "COR-PRIMARY",
                "distance_km": direct_dist,
                "estimated_travel_time_hours": round(direct_dist / 40.0, 1),
                "estimated_delay_mins": 0,
                "base_risk_score": 22.0,
                "accessibility_score": 90.0,
                "resilience_score": 82.0,
                "bridge_clearance_status": "OPERATIONAL",
                "traffic_congestion_index": 0.30,
                "waypoints": direct_wpts
            },
            {
                "id": "ROUTE_B",
                "name": f"Route B (Western Bypass via Regional State Highway)",
                "corridor_code": "COR-BYPASS-WEST",
                "distance_km": alt_dist,
                "estimated_travel_time_hours": round(alt_dist / 38.0, 1),
                "estimated_delay_mins": 25,
                "base_risk_score": 35.0,
                "accessibility_score": 82.0,
                "resilience_score": 75.0,
                "bridge_clearance_status": "OPERATIONAL",
                "traffic_congestion_index": 0.20,
                "waypoints": alt_wpts
            },
            {
                "id": "ROUTE_C",
                "name": f"Route C (Southern Alternate via Valley Pass)",
                "corridor_code": "COR-VALLEY-PASS",
                "distance_km": detour_dist,
                "estimated_travel_time_hours": round(detour_dist / 35.0, 1),
                "estimated_delay_mins": 55,
                "base_risk_score": 48.0,
                "accessibility_score": 72.0,
                "resilience_score": 65.0,
                "bridge_clearance_status": "RESTRICTED",
                "traffic_congestion_index": 0.15,
                "waypoints": detour_wpts
            }
        ]

    @staticmethod
    def optimize_routes(
        origin: str,
        destination: str,
        optimization_objective: str = "BALANCED",
        cargo_priority: str = "URGENT",
        vehicle_weight_tons: float = 20.0,
        active_blockages: List[Dict[str, Any]] = None,
        avoid_closed_bridges: bool = True,
        consider_live_weather: bool = True
    ) -> Dict[str, Any]:
        """
        AI Route Optimization Engine:
        Evaluates multiple candidate routes using multi-factor normalized scoring,
        incorporating live weather intelligence, bridge weight capacities, and terrain risks.
        """
        from app.services.weather_service import WeatherService

        raw_candidates = RoutingService.generate_candidate_paths(origin, destination)
        objective_key = optimization_objective.upper() if optimization_objective.upper() in OPTIMIZATION_OBJECTIVES else "BALANCED"
        weights_config = OPTIMIZATION_OBJECTIVES[objective_key]["weights"]

        # Check for active blockages impacting primary routes
        is_primary_blocked = False
        blockage_reason = ""
        if active_blockages:
            for blk in active_blockages:
                if blk.get("road_status") in ["BLOCKED", "CLOSED"]:
                    is_primary_blocked = True
                    blockage_reason = f"Blocked: {blk.get('incident_type', 'Landslide')} at {blk.get('location_name', 'Mountain Pass')}"
                    break

        evaluated_candidates = []

        for cand in raw_candidates:
            cid = cand["id"]
            corridor = cand["corridor_code"]
            waypoints = cand["waypoints"]

            # Weather Risk Evaluation
            if consider_live_weather:
                weather_eval = WeatherService.evaluate_route_weather_risk(
                    origin, destination, corridor_code=corridor, waypoints=waypoints
                )
                weather_risk = weather_eval["aggregate_weather_risk_score"]
                weather_cat = weather_eval["aggregate_weather_risk_category"]
                weather_advisory = weather_eval["logistics_advisory"]
                weather_summary = {
                    "peak_precipitation_mm_hr": weather_eval["peak_precipitation_mm_hr"],
                    "peak_wind_speed_kmh": weather_eval["peak_wind_speed_kmh"],
                    "severe_weather_count": weather_eval["severe_weather_count"],
                    "data_source": weather_eval["data_source"]
                }
            else:
                weather_risk = 15.0
                weather_cat = "LOW"
                weather_advisory = "Standard atmospheric clearance"
                weather_summary = {"data_source": "DEFAULT"}

            # Blockage check
            cand_blocked = False
            cand_blockage_reason = ""
            if cid == "ROUTE_A" or corridor in ["COR-NH27", "COR-PRIMARY", "COR-NH40"]:
                if is_primary_blocked:
                    cand_blocked = True
                    cand_blockage_reason = blockage_reason or "Pass impassable due to active incident"

            # Traffic Congestion Evaluation (Gap 11)
            try:
                from app.services.traffic_service import TrafficService
                from app.database.database import SessionLocal
                _db = SessionLocal()
                traffic_eval = TrafficService.evaluate_route_traffic(corridor, _db)
                _db.close()
                traffic_index = traffic_eval.get("congestion_index", cand.get("traffic_congestion_index", 0.25))
                traffic_delay = traffic_eval.get("traffic_delay_mins", 10)
                traffic_level = traffic_eval.get("congestion_level", "LOW")
            except Exception:
                traffic_index = cand.get("traffic_congestion_index", 0.25)
                traffic_delay = 10
                traffic_level = "LOW"

            # Base & Combined Risk Calculation
            base_risk = cand["base_risk_score"]
            if cand_blocked:
                adj_risk = 92.0
                delay_mins = cand["estimated_delay_mins"] + 360
            else:
                adj_risk = round((0.60 * base_risk) + (0.40 * weather_risk), 1)
                delay_mins = cand["estimated_delay_mins"] + traffic_delay

            risk_cat = "LOW" if adj_risk < 25 else ("MEDIUM" if adj_risk < 50 else ("HIGH" if adj_risk < 75 else "CRITICAL"))

            # Bridge load check
            bridge_status = cand["bridge_clearance_status"]
            if vehicle_weight_tons > 25.0 and "24T" in bridge_status:
                bridge_status = "RESTRICTED (Overweight for 24T bridge)"

            # Trade-offs formulation
            tradeoffs = []
            if cand_blocked:
                tradeoffs.append(f"⛔ Impassable: {cand_blockage_reason}")
            else:
                if cand["distance_km"] <= 500:
                    tradeoffs.append("✓ Shortest transit distance")
                else:
                    tradeoffs.append(f"⚠️ +{round(cand['distance_km'] - raw_candidates[0]['distance_km'], 1)} km detour penalty")

                if adj_risk < 30:
                    tradeoffs.append("✓ Low environmental hazard risk")
                elif adj_risk > 60:
                    tradeoffs.append(f"⚠️ Elevated hazard risk ({adj_risk}/100)")

                if weather_cat in ["HIGH", "SEVERE"]:
                    tradeoffs.append(f"⚠️ Severe precipitation along corridor ({weather_summary['peak_precipitation_mm_hr']} mm/hr)")
                else:
                    tradeoffs.append("✓ Favorable weather forecast")

                if traffic_level in ["HIGH", "SEVERE"]:
                    tradeoffs.append(f"⚠️ Heavy Traffic Congestion (+{traffic_delay}m delay)")
                else:
                    tradeoffs.append("✓ Free-flow highway transit")

            evaluated_candidates.append({
                "id": cid,
                "name": cand["name"],
                "corridor_code": corridor,
                "distance_km": cand["distance_km"],
                "estimated_travel_time_hours": round(cand["estimated_travel_time_hours"] + (traffic_delay / 60.0), 1),
                "estimated_delay_mins": delay_mins,
                "base_risk_score": base_risk,
                "risk_score": adj_risk,
                "risk_category": risk_cat,
                "weather_risk_score": weather_risk,
                "weather_risk_category": weather_cat,
                "weather_advisory": weather_advisory,
                "accessibility_score": cand["accessibility_score"] if not cand_blocked else 0.0,
                "resilience_score": cand["resilience_score"],
                "bridge_clearance_status": bridge_status,
                "traffic_congestion_index": round(traffic_index, 2),
                "is_blocked": cand_blocked,
                "blockage_reason": cand_blockage_reason,
                "waypoints": waypoints,
                "key_tradeoffs": tradeoffs,
                "weather_summary": weather_summary
            })

        # --- Normalized Multi-Attribute Scoring ---
        max_dist = max(c["distance_km"] for c in evaluated_candidates) or 1.0
        max_time = max(c["estimated_travel_time_hours"] for c in evaluated_candidates) or 1.0

        w_risk = weights_config.get("risk", 0.30)
        w_time = weights_config.get("time", 0.25)
        w_weather = weights_config.get("weather", 0.15)
        w_resilience = weights_config.get("resilience", 0.15)
        w_dist = weights_config.get("distance", 0.15)
        w_access = weights_config.get("accessibility", 0.0)

        for c in evaluated_candidates:
            if c["is_blocked"]:
                c["cost_score"] = 9999.0
                c["suitability_score"] = 0.0
            else:
                norm_dist = c["distance_km"] / max_dist
                norm_time = c["estimated_travel_time_hours"] / max_time
                norm_risk = c["risk_score"] / 100.0
                norm_weather = c["weather_risk_score"] / 100.0
                norm_resil_penalty = (100.0 - c["resilience_score"]) / 100.0
                norm_access_penalty = (100.0 - c["accessibility_score"]) / 100.0

                cost = (
                    (w_risk * norm_risk) +
                    (w_time * norm_time) +
                    (w_weather * norm_weather) +
                    (w_resilience * norm_resil_penalty) +
                    (w_dist * norm_dist) +
                    (w_access * norm_access_penalty)
                )

                c["cost_score"] = round(cost * 100.0, 2)
                # Suitability score is inverse of normalized cost
                suitability = max(5.0, min(98.0, 100.0 - c["cost_score"]))
                c["suitability_score"] = round(suitability, 1)

        # Rank candidates by lowest cost_score
        ranked_candidates = sorted(evaluated_candidates, key=lambda x: x["cost_score"])
        for rank_idx, c in enumerate(ranked_candidates):
            c["rank"] = rank_idx + 1

        best_route = ranked_candidates[0]
        runner_up = ranked_candidates[1] if len(ranked_candidates) > 1 else None

        # Formulate Explainable AI Reasoning Points
        why_points = []
        if best_route["is_blocked"]:
            why_points.append(f"All routes are experiencing severe blockages. Selected {best_route['name']} as best contingency.")
        else:
            why_points.append(f"Highest overall suitability score ({best_route['suitability_score']}/100) under {OPTIMIZATION_OBJECTIVES[objective_key]['title']} policy.")
            if is_primary_blocked and best_route["id"] != "ROUTE_A":
                why_points.append(f"Primary Route A is disqualified due to active blockage ({blockage_reason}).")
            if best_route["risk_score"] < 40:
                why_points.append(f"Maintains low combined route risk ({best_route['risk_score']}/100) with favorable terrain stability.")
            if runner_up:
                time_diff = round(runner_up["estimated_travel_time_hours"] - best_route["estimated_travel_time_hours"], 1)
                if time_diff > 0:
                    why_points.append(f"Saves ~{time_diff} hours travel time compared to {runner_up['name']}.")
                elif time_diff < 0:
                    why_points.append(f"Trades {abs(time_diff)} hours extra time for significant hazard reduction ({best_route['risk_score']} vs {runner_up['risk_score']} risk).")

        tradeoff_summary = []
        for c in ranked_candidates:
            status_tag = "RECOMMENDED" if c["id"] == best_route["id"] else f"RANK #{c['rank']}"
            tradeoff_summary.append(
                f"{c['name']} ({status_tag}): {c['distance_km']} km | {c['estimated_travel_time_hours']}h | Risk: {c['risk_score']}/100 | Weather: {c['weather_risk_category']} | Suitability: {c['suitability_score']}/100"
            )

        # Build comparison table
        comp_table = []
        for c in ranked_candidates:
            comp_table.append({
                "route_id": c["id"],
                "route_name": c["name"],
                "corridor_code": c["corridor_code"],
                "rank": c["rank"],
                "distance_km": c["distance_km"],
                "travel_time_hrs": c["estimated_travel_time_hours"],
                "delay_mins": c["estimated_delay_mins"],
                "risk_score": c["risk_score"],
                "risk_category": c["risk_category"],
                "weather_category": c["weather_risk_category"],
                "accessibility_score": c["accessibility_score"],
                "resilience_score": c["resilience_score"],
                "suitability_score": c["suitability_score"],
                "status": "BLOCKED" if c["is_blocked"] else "PASSABLE",
                "is_recommended": c["id"] == best_route["id"]
            })

        summary_text = (
            f"AI Route Optimizer recommends {best_route['name']} ({best_route['distance_km']} km, {best_route['estimated_travel_time_hours']}h) "
            f"for {cargo_priority} cargo under '{objective_key}' objective. "
            f"Composite suitability score: {best_route['suitability_score']}/100."
        )

        return {
            "origin": origin,
            "destination": destination,
            "optimization_objective": objective_key,
            "applied_weights": weights_config,
            "total_candidates_evaluated": len(ranked_candidates),
            "recommended_route_id": best_route["id"],
            "recommended_route_name": best_route["name"],
            "recommendation_summary": summary_text,
            "why_this_route": why_points,
            "tradeoff_analysis": tradeoff_summary,
            "comparison_table": comp_table,
            "candidate_routes": ranked_candidates,
            "primary_waypoints": PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS,
            "alternate_waypoints": ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS,
            "is_single_route": len(ranked_candidates) <= 1,
            "single_route_note": None if len(ranked_candidates) > 1 else "Only one physical road connection exists between these mountain nodes.",
            "evaluated_at": datetime.now(timezone.utc)
        }

    @staticmethod
    def get_candidate_routes(origin: str, destination: str, active_blockages: List[Dict[str, Any]] = None, cargo_priority: str = "URGENT") -> Dict[str, Any]:
        """Backward-compatible helper invoking optimize_routes."""
        return RoutingService.optimize_routes(
            origin=origin,
            destination=destination,
            optimization_objective="BALANCED",
            cargo_priority=cargo_priority,
            active_blockages=active_blockages
        )

    @staticmethod
    def get_route(origin: str, destination: str, force_alternate: bool = False, active_blockages: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Returns single selected route geometry."""
        eval_res = RoutingService.optimize_routes(origin, destination, active_blockages=active_blockages)
        candidates = eval_res["candidate_routes"]
        if force_alternate and len(candidates) > 1:
            rec = candidates[1]
        else:
            rec = [r for r in candidates if r["id"] == eval_res["recommended_route_id"]][0]

        return {
            "origin": origin,
            "destination": destination,
            "route_name": rec["name"],
            "is_blocked": rec["is_blocked"],
            "blockage_reason": rec.get("blockage_reason", ""),
            "distance_km": rec["distance_km"],
            "estimated_travel_time_hours": rec["estimated_travel_time_hours"],
            "estimated_delay_mins": rec["estimated_delay_mins"],
            "risk_category": rec["risk_category"],
            "risk_score": rec["risk_score"],
            "waypoints": rec["waypoints"],
            "primary_waypoints": PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS,
            "alternate_waypoints": ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS,
            "recommendation_reason": eval_res["recommendation_summary"]
        }
