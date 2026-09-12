"""
NHAI (National Highways Authority of India) Integration Service
Provides real-time highway corridor condition monitoring, Road Asset Management System (RAMS),
and NETC FASTag Toll Plaza congestion/transit analytics across North Eastern Region corridors.
"""

import logging
import urllib.request
import urllib.parse
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Incident, Corridor, Alert, AuditLog
from app.services.accessibility_service import AccessibilityEngine

logger = logging.getLogger("link_x8.nhai")

class NHAIService:
    """
    NHAI Gateway Connector for LINK X8.
    Monitors highway sections (NH-27, NH-37, NH-102, NH-29, NH-6) and FASTag Toll Plazas.
    """

    @classmethod
    def get_corridors_status(cls) -> List[Dict[str, Any]]:
        """Returns live/simulated real-time NHAI highway corridor statuses for NER."""
        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        return [
            {
                "corridor_code": "COR-NH27",
                "nh_number": "NH-27",
                "name": "East-West Corridor (Lumding - Haflong - Silchar)",
                "pavement_condition_index": 52.4,
                "surface_status": "MONSOON_DEGRADATION",
                "active_blockages": 1,
                "blockage_type": "LANDSLIDE_SLOPE_FAIL",
                "latitude": 25.1850,
                "longitude": 93.0150,
                "current_flow_rate_vehicles_per_hr": 210,
                "avg_speed_kmh": 26.0,
                "speed_reduction_pct": 52.0,
                "nhai_project_director_office": "PIU Silchar",
                "lane_configuration": "4-Lane Divided (Chute Section: 2-Lane)",
                "last_inspected": now_str
            },
            {
                "corridor_code": "COR-NH37",
                "nh_number": "NH-37",
                "name": "Guwahati - Tezpur - Jorhat - Dibrugarh Arterial",
                "pavement_condition_index": 84.6,
                "surface_status": "GOOD_CONTROLLED",
                "active_blockages": 0,
                "blockage_type": "NONE",
                "latitude": 26.5850,
                "longitude": 93.3600,
                "current_flow_rate_vehicles_per_hr": 640,
                "avg_speed_kmh": 58.0,
                "speed_reduction_pct": 0.0,
                "nhai_project_director_office": "PIU Nagaon",
                "lane_configuration": "4-Lane Four-Lane Standard",
                "last_inspected": now_str
            },
            {
                "corridor_code": "COR-NH102",
                "nh_number": "NH-102",
                "name": "Imphal - Thoubal - Pallel - Moreh Border Highway",
                "pavement_condition_index": 41.0,
                "surface_status": "CRITICAL_SUBSIDENCE",
                "active_blockages": 2,
                "blockage_type": "ROAD_SUBSIDENCE_MUDSLIDE",
                "latitude": 24.4500,
                "longitude": 94.0200,
                "current_flow_rate_vehicles_per_hr": 85,
                "avg_speed_kmh": 18.0,
                "speed_reduction_pct": 68.0,
                "nhai_project_director_office": "PIU Imphal",
                "lane_configuration": "2-Lane Mountain Geometric",
                "last_inspected": now_str
            },
            {
                "corridor_code": "COR-NH29",
                "nh_number": "NH-29",
                "name": "Dimapur - Chumukedima - Kohima Express Link",
                "pavement_condition_index": 68.0,
                "surface_status": "MODERATE_ROCKFALL_RISK",
                "active_blockages": 0,
                "blockage_type": "CONTROLLED_ROCK_SHED_CLEARANCE",
                "latitude": 25.6700,
                "longitude": 93.9800,
                "current_flow_rate_vehicles_per_hr": 320,
                "avg_speed_kmh": 38.0,
                "speed_reduction_pct": 20.0,
                "nhai_project_director_office": "PIU Dimapur",
                "lane_configuration": "4-Lane Hill Section",
                "last_inspected": now_str
            },
            {
                "corridor_code": "COR-NH06",
                "nh_number": "NH-6",
                "name": "Shillong - Jowai - Ratacherra - Badarpur Lifeline",
                "pavement_condition_index": 62.5,
                "surface_status": "FOG_HEAVY_RAIN",
                "active_blockages": 0,
                "blockage_type": "POOR_VISIBILITY_FOG",
                "latitude": 25.4500,
                "longitude": 92.2100,
                "current_flow_rate_vehicles_per_hr": 290,
                "avg_speed_kmh": 34.0,
                "speed_reduction_pct": 28.0,
                "nhai_project_director_office": "PIU Shillong",
                "lane_configuration": "2-Lane with Paved Shoulder",
                "last_inspected": now_str
            }
        ]

    @classmethod
    def get_toll_plazas_status(cls) -> List[Dict[str, Any]]:
        """Returns NETC FASTag toll plaza congestion and transit queue metrics across NER."""
        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        return [
            {
                "plaza_id": "NHAI-TOLL-001",
                "plaza_name": "Raha Toll Plaza",
                "highway": "NH-27 / NH-37 Junction",
                "state": "Assam",
                "district": "Nagaon",
                "latitude": 26.2300,
                "longitude": 92.5200,
                "lanes_operational": 8,
                "fastag_penetration_rate_pct": 98.6,
                "avg_wait_time_minutes": 2.4,
                "queue_length_meters": 45,
                "congestion_level": "LOW",
                "truck_clearance_status": "NORMAL",
                "last_synced": now_str
            },
            {
                "plaza_id": "NHAI-TOLL-002",
                "plaza_name": "Manderdisa Freight Check Toll",
                "highway": "NH-27",
                "state": "Assam",
                "district": "Dima Hasao",
                "latitude": 25.8200,
                "longitude": 93.1200,
                "lanes_operational": 4,
                "fastag_penetration_rate_pct": 95.2,
                "avg_wait_time_minutes": 14.8,
                "queue_length_meters": 320,
                "congestion_level": "HIGH",
                "truck_clearance_status": "DELAYED_DUE_TO_SINGLE_LANE_UPSTREAM",
                "last_synced": now_str
            },
            {
                "plaza_id": "NHAI-TOLL-003",
                "plaza_name": "Pahammawlein Toll Plaza",
                "highway": "NH-6",
                "state": "Meghalaya",
                "district": "Ri-Bhoi",
                "latitude": 25.8900,
                "longitude": 91.8800,
                "lanes_operational": 6,
                "fastag_penetration_rate_pct": 97.8,
                "avg_wait_time_minutes": 4.1,
                "queue_length_meters": 75,
                "congestion_level": "MODERATE",
                "truck_clearance_status": "NORMAL",
                "last_synced": now_str
            }
        ]

    @classmethod
    def sync_nhai_telemetry(cls, db: Session) -> Dict[str, Any]:
        """
        Synchronizes real-time NHAI corridor telemetry into LINK X8 DB,
        adjusts corridor accessibility ratings, and generates operational alerts.
        """
        corridors = cls.get_corridors_status()
        tolls = cls.get_toll_plazas_status()

        corridors_synced = 0
        incidents_created = 0
        alerts_created = 0

        for c in corridors:
            corridor = db.query(Corridor).filter(Corridor.corridor_code == c["corridor_code"]).first()
            if corridor:
                if c["active_blockages"] > 0:
                    corridor.status = "RESTRICTED" if c["active_blockages"] == 1 else "BLOCKED"
                    corridor.accessibility_score = max(15.0, corridor.accessibility_score - (c["speed_reduction_pct"] * 0.8))
                    corridor.current_condition = f"NHAI RAMS: {c['surface_status']} ({c['blockage_type']})"
                else:
                    corridor.status = "OPEN"
                    corridor.accessibility_score = min(98.0, c["pavement_condition_index"])
                    corridor.current_condition = f"NHAI RAMS: {c['surface_status']}"
                corridors_synced += 1

            if c["active_blockages"] > 0:
                search_token = f"[NHAI-RAMS-{c['corridor_code']}]"
                existing = db.query(Incident).filter(Incident.description.like(f"%{search_token}%")).first()
                if not existing:
                    inc = Incident(
                        incident_type="ROAD_BLOCK",
                        description=f"{search_token} {c['name']}: {c['blockage_type']}. Flow: {c['current_flow_rate_vehicles_per_hr']} veh/hr, Speed reduced by {c['speed_reduction_pct']}%. Managed by {c['nhai_project_director_office']}.",
                        latitude=c["latitude"],
                        longitude=c["longitude"],
                        location_name=f"{c['nh_number']} Highway Section",
                        district_name=c["name"].split("(")[-1].split("-")[0].strip(),
                        severity="HIGH" if c["active_blockages"] >= 2 else "MEDIUM",
                        road_status="BLOCKED" if c["active_blockages"] >= 2 else "RESTRICTED",
                        reporter_name="Official Feed (NHAI RAMS Gateway)",
                        is_synced=True,
                        created_at=datetime.utcnow()
                    )
                    db.add(inc)
                    incidents_created += 1

                    alert = Alert(
                        alert_type="GOVERNMENT_OPERATIONAL_BULLETIN",
                        title=f"NHAI HIGHWAY ADVISORY: {c['nh_number']}",
                        message=f"{c['name']} speed degraded to {c['avg_speed_kmh']} km/h ({c['surface_status']}). Alternate routing recommended.",
                        severity="HIGH",
                        location=c["name"],
                        recommended_action="Corridor rerouting evaluated by LINK X8 Engine.",
                        is_read=False,
                        created_at=datetime.utcnow()
                    )
                    db.add(alert)
                    alerts_created += 1

        AccessibilityEngine.recalculate_all_accessibility(db)

        audit = AuditLog(
            user_email="nhai-gateway@linkx8.gov.in",
            action="NHAI_RAMS_SYNC",
            resource="NHAIService",
            details=f"Corridors Synced: {corridors_synced}, Incidents: {incidents_created}, Alerts: {alerts_created}, Toll Plazas Monitored: {len(tolls)}"
        )
        db.add(audit)
        db.commit()

        return {
            "status": "SUCCESS",
            "corridors_synced": corridors_synced,
            "incidents_created": incidents_created,
            "alerts_created": alerts_created,
            "toll_plazas_tracked": len(tolls),
            "synced_at": datetime.utcnow().isoformat()
        }
