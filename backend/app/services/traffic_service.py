"""
Traffic Congestion Intelligence Service (SIH Gap 11)
Provides real-time and simulated traffic congestion tracking across strategic NER corridors,
segment-level speed analysis, travel time multipliers, and congestion penalty integration.
Explicitly distinguishes SIMULATED traffic sensors from LIVE highway ATMS telemetry.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from sqlalchemy.orm import Session

from app.models.models import TrafficRecord, Corridor, AuditLog
from app.schemas.schemas import (
    TrafficRecordOut,
    TrafficUpdateIn,
    CorridorTrafficSummaryOut,
    TrafficProviderStatusOut
)

logger = logging.getLogger("link_x8.traffic")

# Default baseline profiles for NER corridors when DB is empty
DEFAULT_CORRIDOR_TRAFFIC_PROFILES = {
    "COR-NH27": {
        "corridor_name": "NH27 Guwahati - Kohima - Imphal Corridor",
        "overall_congestion_level": "MODERATE",
        "overall_congestion_index": 0.35,
        "total_traffic_delay_mins": 35,
        "average_speed_kmh": 42.0,
        "segments": [
            {
                "segment_name": "Guwahati - Nagaon Bypass (NH27)",
                "congestion_level": "MODERATE",
                "congestion_index": 0.40,
                "free_flow_speed_kmh": 60.0,
                "current_speed_kmh": 36.0,
                "estimated_delay_mins": 18,
                "is_incident_affected": False,
                "source": "NHAI_RAMS_SENSOR_GHY"
            },
            {
                "segment_name": "Nagaon - Dimapur Sector",
                "congestion_level": "LOW",
                "congestion_index": 0.20,
                "free_flow_speed_kmh": 50.0,
                "current_speed_kmh": 45.0,
                "estimated_delay_mins": 5,
                "is_incident_affected": False,
                "source": "NHAI_RAMS_SENSOR_DMP"
            },
            {
                "segment_name": "Dimapur - Kohima Hill Climb",
                "congestion_level": "HIGH",
                "congestion_index": 0.70,
                "free_flow_speed_kmh": 35.0,
                "current_speed_kmh": 15.0,
                "estimated_delay_mins": 45,
                "is_incident_affected": True,
                "source": "BRO_PROJECT_SEWAK_POST"
            }
        ]
    },
    "COR-NH10": {
        "corridor_name": "NH10 Siliguri - Gangtok Corridor",
        "overall_congestion_level": "HIGH",
        "overall_congestion_index": 0.65,
        "total_traffic_delay_mins": 50,
        "average_speed_kmh": 28.0,
        "segments": [
            {
                "segment_name": "Sevoke - Teesta Bazaar Canyon",
                "congestion_level": "HIGH",
                "congestion_index": 0.75,
                "free_flow_speed_kmh": 40.0,
                "current_speed_kmh": 14.0,
                "estimated_delay_mins": 35,
                "is_incident_affected": True,
                "source": "BRO_SWASTIK_SEVOKE"
            },
            {
                "segment_name": "Teesta Bazaar - Rangpo Checkpost",
                "congestion_level": "MODERATE",
                "congestion_index": 0.50,
                "free_flow_speed_kmh": 35.0,
                "current_speed_kmh": 22.0,
                "estimated_delay_mins": 15,
                "is_incident_affected": False,
                "source": "SIKKIM_POLICE_RANGPO"
            }
        ]
    }
}

class TrafficService:
    """
    Coordinates highway traffic congestion monitoring, corridor speed indexing,
    and route optimization penalty calculations for LINK X8.
    """

    @classmethod
    def get_corridor_traffic(cls, corridor_code: str, db: Session) -> CorridorTrafficSummaryOut:
        """
        Retrieves live or simulated segment-level traffic congestion for a given corridor.
        """
        records = db.query(TrafficRecord).filter(TrafficRecord.corridor_code == corridor_code).all()
        corridor = db.query(Corridor).filter(Corridor.corridor_code == corridor_code).first()
        corridor_name = corridor.name if corridor else f"Corridor {corridor_code}"

        if not records:
            # Fallback to default static profile
            default_profile = DEFAULT_CORRIDOR_TRAFFIC_PROFILES.get(corridor_code, {
                "corridor_name": corridor_name,
                "overall_congestion_level": "LOW",
                "overall_congestion_index": 0.15,
                "total_traffic_delay_mins": 10,
                "average_speed_kmh": 45.0,
                "segments": []
            })
            return CorridorTrafficSummaryOut(
                corridor_code=corridor_code,
                corridor_name=default_profile["corridor_name"],
                overall_congestion_level=default_profile["overall_congestion_level"],
                overall_congestion_index=default_profile["overall_congestion_index"],
                total_traffic_delay_mins=default_profile["total_traffic_delay_mins"],
                average_speed_kmh=default_profile["average_speed_kmh"],
                data_source="SIMULATED_HIGHWAY_SENSORS",
                is_live=False,
                segments=[],
                last_updated=datetime.utcnow()
            )

        avg_speed = sum(r.average_speed_kmh for r in records) / len(records)
        avg_index = sum(r.congestion_index for r in records) / len(records)
        total_delay = sum(r.traffic_delay_mins for r in records)
        
        # Categorize overall level
        if avg_index >= 0.70:
            level = "SEVERE"
        elif avg_index >= 0.50:
            level = "HIGH"
        elif avg_index >= 0.30:
            level = "MODERATE"
        else:
            level = "LOW"

        is_live = any(r.is_live for r in records)
        data_src = "LIVE_ATMS_INTEGRATION" if is_live else "SIMULATED_HIGHWAY_SENSORS"

        return CorridorTrafficSummaryOut(
            corridor_code=corridor_code,
            corridor_name=corridor_name,
            overall_congestion_level=level,
            overall_congestion_index=round(avg_index, 2),
            total_traffic_delay_mins=total_delay,
            average_speed_kmh=round(avg_speed, 1),
            data_source=data_src,
            is_live=is_live,
            segments=records,
            last_updated=records[0].recorded_at if records else datetime.utcnow()
        )

    @classmethod
    def get_all_corridors_traffic(cls, db: Session) -> List[CorridorTrafficSummaryOut]:
        """Returns traffic summary across all major NER corridors."""
        corridors = db.query(Corridor).all()
        results = []
        for c in corridors:
            results.append(cls.get_corridor_traffic(c.corridor_code, db))
        return results

    @classmethod
    def update_traffic(cls, payload: TrafficUpdateIn, db: Session) -> TrafficRecordOut:
        """
        Updates or creates a traffic observation for a specific corridor segment.
        """
        multiplier = round(payload.free_flow_speed_kmh / max(10.0, payload.average_speed_kmh), 2)
        rec = db.query(TrafficRecord).filter(
            (TrafficRecord.corridor_code == payload.corridor_code) &
            (TrafficRecord.segment_name == payload.segment_name)
        ).first()

        if rec:
            rec.congestion_level = payload.congestion_level.upper()
            rec.congestion_index = payload.congestion_index
            rec.average_speed_kmh = payload.average_speed_kmh
            rec.free_flow_speed_kmh = payload.free_flow_speed_kmh
            rec.traffic_delay_mins = payload.traffic_delay_mins
            rec.travel_time_multiplier = multiplier
            rec.data_source = payload.data_source or "SIMULATED_HIGHWAY_SENSORS"
            rec.recorded_at = datetime.utcnow()
        else:
            rec = TrafficRecord(
                corridor_code=payload.corridor_code,
                segment_name=payload.segment_name,
                congestion_level=payload.congestion_level.upper(),
                congestion_index=payload.congestion_index,
                average_speed_kmh=payload.average_speed_kmh,
                free_flow_speed_kmh=payload.free_flow_speed_kmh,
                traffic_delay_mins=payload.traffic_delay_mins,
                travel_time_multiplier=multiplier,
                data_source=payload.data_source or "SIMULATED_HIGHWAY_SENSORS",
                is_live=False,
                recorded_at=datetime.utcnow()
            )
            db.add(rec)

        db.commit()
        db.refresh(rec)
        return rec

    @classmethod
    def evaluate_route_traffic(cls, corridor_code: str, db: Session) -> Dict[str, Any]:
        """
        Calculates traffic congestion index (0.0 to 1.0) and delay minutes for route cost evaluation.
        """
        traffic_sum = cls.get_corridor_traffic(corridor_code, db)
        return {
            "congestion_level": traffic_sum.overall_congestion_level,
            "congestion_index": traffic_sum.overall_congestion_index,
            "traffic_delay_mins": traffic_sum.total_traffic_delay_mins,
            "average_speed_kmh": traffic_sum.average_speed_kmh,
            "data_source": traffic_sum.data_source,
            "is_live": traffic_sum.is_live
        }

    @classmethod
    def get_provider_status(cls, db: Session) -> TrafficProviderStatusOut:
        """Reports the live vs simulated status of traffic sensor integrations."""
        total_segments = db.query(TrafficRecord).count()
        total_corridors = db.query(Corridor).count()
        return TrafficProviderStatusOut(
            provider_name="NER Regional ATMS & Highway Telematics Feed",
            mode="SIMULATED_HIGHWAY_SENSORS",
            monitored_corridors_count=total_corridors,
            active_segments_count=total_segments,
            api_health="OPERATIONAL_STANDBY",
            documentation_url="https://morth.nic.in/atms-guidelines"
        )
