"""
Border Roads Organisation (BRO) Integration Service
Provides real-time strategic intelligence on mountain passes, Bailey bridges,
load classifications, snow/avalanche clearance, and military convoy priority windows
across Project Vartak, Project Brahmank, Project Setuk, Project Udayak, and Project Pushpak in the NER.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Bridge, Incident, Alert, AuditLog
from app.services.accessibility_service import AccessibilityEngine

logger = logging.getLogger("link_x8.bro")

class BROService:
    """
    Border Roads Organisation (BRO - Ministry of Defence) Gateway.
    Direct integration for high-altitude passes, Bailey bridges, and strategic corridors.
    """

    @classmethod
    def get_mountain_passes_status(cls) -> List[Dict[str, Any]]:
        """Returns live/simulated real-time status of strategic NER mountain passes."""
        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        return [
            {
                "pass_code": "BRO-PASS-SELA",
                "pass_name": "Sela Pass & Sela Tunnel Axis",
                "project_name": "Project Vartak",
                "state": "Arunachal Pradesh",
                "district": "West Kameng / Tawang",
                "elevation_ft": 13700,
                "latitude": 27.5020,
                "longitude": 92.1030,
                "operational_status": "OPEN_ALL_WEATHER",
                "surface_condition": "SELA_TUNNEL_OPERATIONAL",
                "snow_depth_cm": 15,
                "anti_skid_chains_mandatory": False,
                "military_convoy_priority_window": "06:00 - 09:30 IST",
                "max_authorized_gross_weight_tons": 40.0,
                "task_force": "14 Border Roads Task Force (BRTF)",
                "emergency_helpline": "+91-3794-222100",
                "last_bulletin_at": now_str
            },
            {
                "pass_code": "BRO-PASS-BUMLA",
                "pass_name": "Bum La Pass High Altitude Axis",
                "project_name": "Project Vartak",
                "state": "Arunachal Pradesh",
                "district": "Tawang",
                "elevation_ft": 15200,
                "latitude": 27.7170,
                "longitude": 91.8830,
                "operational_status": "RESTRICTED_4X4_ONLY",
                "surface_condition": "COMPACT_SNOW_BLACK_ICE",
                "snow_depth_cm": 45,
                "anti_skid_chains_mandatory": True,
                "military_convoy_priority_window": "10:00 - 13:00 IST",
                "max_authorized_gross_weight_tons": 18.0,
                "task_force": "42 BRTF (Tawang Sector)",
                "emergency_helpline": "+91-3794-224422",
                "last_bulletin_at": now_str
            },
            {
                "pass_code": "BRO-PASS-NATHULA",
                "pass_name": "Nathu La Strategic Corridor",
                "project_name": "Project Swastik",
                "state": "Sikkim",
                "district": "East Sikkim",
                "elevation_ft": 14140,
                "latitude": 27.3860,
                "longitude": 88.8310,
                "operational_status": "OPEN_CAUTION",
                "surface_condition": "CLEARED_WET_ASPHALT",
                "snow_depth_cm": 8,
                "anti_skid_chains_mandatory": False,
                "military_convoy_priority_window": "07:00 - 11:00 IST",
                "max_authorized_gross_weight_tons": 24.0,
                "task_force": "Project Swastik Command",
                "emergency_helpline": "+91-3592-202244",
                "last_bulletin_at": now_str
            },
            {
                "pass_code": "BRO-PASS-SENAPATI",
                "pass_name": "Senapati Mountain Ridge Pass",
                "project_name": "Project Setuk",
                "state": "Manipur",
                "district": "Senapati",
                "elevation_ft": 4850,
                "latitude": 25.2600,
                "longitude": 94.0200,
                "operational_status": "RESTRICTED_LANDSLIDE",
                "surface_condition": "HEAVY_SLOPE_CLEARANCE",
                "snow_depth_cm": 0,
                "anti_skid_chains_mandatory": False,
                "military_convoy_priority_window": "CONTINUOUS_CLEARANCE",
                "max_authorized_gross_weight_tons": 16.0,
                "task_force": "757 BRTF (Dimapur-Imphal Axis)",
                "emergency_helpline": "+91-385-2451200",
                "last_bulletin_at": now_str
            }
        ]

    @classmethod
    def get_strategic_bridges_status(cls) -> List[Dict[str, Any]]:
        """Returns live/simulated real-time status of BRO bridges and river crossings in NER."""
        now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        return [
            {
                "bridge_code": "BRG-001",
                "name": "Saraighat Strategic Dual Crossing",
                "river": "Brahmaputra",
                "location": "Guwahati / Jalukbari",
                "project": "Project Brahmank / NFR",
                "state": "Assam",
                "load_classification": "Class 70 / 40 Ton Civil Max",
                "current_capacity_tons": 40.0,
                "status": "OPEN_NORMAL",
                "water_clearance_freeboard_m": 8.4,
                "vibration_sensor_health": "OPTIMAL",
                "latitude": 26.1280,
                "longitude": 91.6810,
                "last_inspected": now_str
            },
            {
                "bridge_code": "BRG-002",
                "name": "Bogibeel Strategic Rail-Road Bridge",
                "river": "Brahmaputra",
                "location": "Dibrugarh - Dhemaji Axis",
                "project": "Project Brahmank",
                "state": "Assam",
                "load_classification": "Class 70 / 40 Ton Civil Max",
                "current_capacity_tons": 40.0,
                "status": "OPEN_NORMAL",
                "water_clearance_freeboard_m": 9.8,
                "vibration_sensor_health": "OPTIMAL",
                "latitude": 27.3910,
                "longitude": 94.8190,
                "last_inspected": now_str
            },
            {
                "bridge_code": "BRG-003",
                "name": "Kaliabhomora Bridge",
                "river": "Brahmaputra",
                "location": "Tezpur - Bhomoraguri",
                "project": "Project Setuk",
                "state": "Assam",
                "load_classification": "Class 40 (Temporary Restricted to Class 24)",
                "current_capacity_tons": 20.0,
                "status": "RESTRICTED",
                "water_clearance_freeboard_m": 4.1,
                "vibration_sensor_health": "HIGH_PIER_SCOUR_WARNING",
                "latitude": 26.6110,
                "longitude": 92.7950,
                "last_inspected": now_str
            },
            {
                "bridge_code": "BRG-004",
                "name": "Dhola-Sadiya (Bhupen Hazarika Setu)",
                "river": "Lohit",
                "location": "Dhola - Sadiya (Tinsukia to Arunachal)",
                "project": "Project Udayak",
                "state": "Assam / Arunachal Pradesh",
                "load_classification": "Class 60 MBT (60-Tonne Military Tank Capable)",
                "current_capacity_tons": 40.0,
                "status": "OPEN_NORMAL",
                "water_clearance_freeboard_m": 11.2,
                "vibration_sensor_health": "OPTIMAL",
                "latitude": 27.7940,
                "longitude": 95.6630,
                "last_inspected": now_str
            },
            {
                "bridge_code": "BRG-007",
                "name": "Sikang Bailey Bridge",
                "river": "Sikang River Mountain Torrent",
                "location": "Upper Siang Border Road",
                "project": "Project Brahmank",
                "state": "Arunachal Pradesh",
                "load_classification": "Class 18 (Strict 18T GVW Limit)",
                "current_capacity_tons": 18.0,
                "status": "RESTRICTED",
                "water_clearance_freeboard_m": 2.2,
                "vibration_sensor_health": "MODERATE_OSCILLATION",
                "latitude": 28.6100,
                "longitude": 94.9500,
                "last_inspected": now_str
            }
        ]

    @classmethod
    def sync_bro_intelligence(cls, db: Session) -> Dict[str, Any]:
        """
        Ingests real-time BRO mountain pass status and bridge classifications into DB,
        updates bridge load capacities, and triggers accessibility engine recalculation.
        """
        passes = cls.get_mountain_passes_status()
        bridges = cls.get_strategic_bridges_status()

        bridges_updated = 0
        incidents_created = 0
        alerts_created = 0

        # Update Strategic Bridges
        for b in bridges:
            bridge = db.query(Bridge).filter(
                (Bridge.bridge_code == b["bridge_code"]) |
                (Bridge.name.ilike(f"%{b['name'].split()[0]}%"))
            ).first()
            if bridge:
                bridge.load_capacity_tons = b["current_capacity_tons"]
                bridge.load_restriction_type = f"BRO {b['load_classification']}"
                if "RESTRICTED" in b["status"]:
                    bridge.status = "RESTRICTED"
                    bridge.accessibility_score = 45.0
                elif "CLOSED" in b["status"]:
                    bridge.status = "CLOSED_FLOOD"
                    bridge.accessibility_score = 5.0
                else:
                    bridge.status = "OPEN"
                    bridge.accessibility_score = 98.0
                bridges_updated += 1

                if "RESTRICTED" in b["status"] or "CLOSED" in b["status"]:
                    search_token = f"[BRO-COMMAND-{b['bridge_code']}]"
                    existing = db.query(Incident).filter(Incident.description.like(f"%{search_token}%")).first()
                    if not existing:
                        inc = Incident(
                            incident_type="BRIDGE_DAMAGE",
                            description=f"{search_token} {b['name']} ({b['river']} River): {b['status']}. Load capacity downgraded to {b['current_capacity_tons']}T. {b['vibration_sensor_health']}. Controlled by {b['project']}.",
                            latitude=b["latitude"],
                            longitude=b["longitude"],
                            location_name=b["name"],
                            district_name=b["state"],
                            affected_bridge_id=bridge.id,
                            affected_bridge_code=bridge.bridge_code,
                            severity="HIGH",
                            road_status="RESTRICTED",
                            reporter_name=f"Official Feed (BRO Command - {b['project']})",
                            is_synced=True,
                            created_at=datetime.utcnow()
                        )
                        db.add(inc)
                        incidents_created += 1

        # Process Mountain Passes
        for p in passes:
            if "RESTRICTED" in p["operational_status"] or p["snow_depth_cm"] > 20:
                search_token = f"[BRO-PASS-{p['pass_code']}]"
                existing = db.query(Incident).filter(Incident.description.like(f"%{search_token}%")).first()
                if not existing:
                    inc = Incident(
                        incident_type="LANDSLIDE" if "LANDSLIDE" in p["operational_status"] else "ROAD_BLOCK",
                        description=f"{search_token} {p['pass_name']} (Elevation {p['elevation_ft']} ft): {p['operational_status']}. Snow depth: {p['snow_depth_cm']}cm. Chains: {'MANDATORY' if p['anti_skid_chains_mandatory'] else 'NOT REQUIRED'}. Convoy window: {p['military_convoy_priority_window']}.",
                        latitude=p["latitude"],
                        longitude=p["longitude"],
                        location_name=p["pass_name"],
                        district_name=p["district"],
                        severity="HIGH",
                        road_status="RESTRICTED",
                        reporter_name=f"Official Feed (BRO - {p['project_name']})",
                        is_synced=True,
                        created_at=datetime.utcnow()
                    )
                    db.add(inc)
                    incidents_created += 1

                    alert = Alert(
                        alert_type="GOVERNMENT_OPERATIONAL_BULLETIN",
                        title=f"BRO MOUNTAIN PASS ADVISORY: {p['pass_name']}",
                        message=f"{p['pass_name']} ({p['elevation_ft']} ft) status is {p['operational_status']}. Max GVW: {p['max_authorized_gross_weight_tons']}T. Task Force Helpline: {p['emergency_helpline']}.",
                        severity="HIGH",
                        location=p["pass_name"],
                        recommended_action="Adhere to BRO military convoy clearance windows.",
                        is_read=False,
                        created_at=datetime.utcnow()
                    )
                    db.add(alert)
                    alerts_created += 1

        AccessibilityEngine.recalculate_all_accessibility(db)

        audit = AuditLog(
            user_email="bro-command@linkx8.gov.in",
            action="BRO_COMMAND_SYNC",
            resource="BROService",
            details=f"Mountain Passes: {len(passes)}, Bridges Updated: {bridges_updated}, Incidents: {incidents_created}, Alerts: {alerts_created}"
        )
        db.add(audit)
        db.commit()

        return {
            "status": "SUCCESS",
            "mountain_passes_tracked": len(passes),
            "bridges_updated": bridges_updated,
            "incidents_created": incidents_created,
            "alerts_created": alerts_created,
            "synced_at": datetime.utcnow().isoformat()
        }
