"""
ETA & Estimated Travel Delay Intelligence Service (SIH Gap 12)
Provides explicit, multi-factor ETA calculation:
Predicted Travel Time = Base Travel Time + (Traffic Delay + Weather Delay + Incident Delay + Bridge Delay)
Calculates live remaining travel time from GPS telematics and dispatches high-delay alerts.
"""

import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging
from sqlalchemy.orm import Session

from app.models.models import Delivery, Vehicle, Incident, Bridge, Alert, AuditLog
from app.schemas.schemas import ETABreakdownOut, DeliveryETAUpdateOut
from app.services.traffic_service import TrafficService
from app.services.weather_service import WeatherService
from app.services.routing_service import RoutingService, NER_NODES

logger = logging.getLogger("link_x8.eta_service")

# Configurable threshold for triggering proactive delay alerts
DELAY_ALERT_THRESHOLD_MINS = 45

class ETAService:
    """
    Coordinates multi-hazard ETA forecasting, contributing factor decomposition,
    and telematics-driven dynamic delivery time revisions.
    """

    @classmethod
    def calculate_eta_breakdown(
        cls,
        origin: str,
        destination: str,
        corridor_code: Optional[str] = "COR-NH27",
        departure_time: Optional[datetime] = None,
        db: Session = None,
        vehicle_lat: Optional[float] = None,
        vehicle_lng: Optional[float] = None
    ) -> ETABreakdownOut:
        """
        Computes explicit baseline and predicted travel times with full delay factor breakdown.
        """
        dep_time = departure_time or datetime.utcnow()
        norm_orig = origin.strip().title()
        norm_dest = destination.strip().title()

        # 1. Base Distance and Travel Time
        if vehicle_lat is not None and vehicle_lng is not None:
            dest_pt = NER_NODES.get(norm_dest, [24.8170, 93.9368])
            distance_km = RoutingService.calculate_distance_km([vehicle_lat, vehicle_lng], dest_pt) * 1.2
        else:
            orig_pt = NER_NODES.get(norm_orig, [26.1445, 91.7362])
            dest_pt = NER_NODES.get(norm_dest, [24.8170, 93.9368])
            distance_km = RoutingService.calculate_distance_km(orig_pt, dest_pt) * 1.25

        distance_km = max(15.0, round(distance_km, 1))
        free_flow_speed = 48.0 # Standard mountainous highway average speed
        base_travel_time_hours = round(distance_km / free_flow_speed, 2)
        base_eta = dep_time + timedelta(hours=base_travel_time_hours)

        # 2. Factor 1: Traffic Congestion Delay
        traffic_delay_mins = 0
        if db:
            traffic_eval = TrafficService.evaluate_route_traffic(corridor_code or "COR-NH27", db)
            traffic_delay_mins = traffic_eval.get("traffic_delay_mins", 10)
        else:
            traffic_delay_mins = 15

        # 3. Factor 2: Weather Hazards Delay
        weather_delay_mins = 0
        try:
            weather_eval = WeatherService.evaluate_route_weather_risk(norm_orig, norm_dest, corridor_code)
            w_score = weather_eval.get("aggregate_weather_risk_score", 15.0)
            if w_score >= 70.0:
                weather_delay_mins = 50 # Severe downpour / storm speed reduction
            elif w_score >= 45.0:
                weather_delay_mins = 25 # Moderate rain
            elif w_score >= 25.0:
                weather_delay_mins = 10
        except Exception:
            weather_delay_mins = 5

        # 4. Factor 3: Road Incidents Delay
        incident_delay_mins = 0
        if db:
            active_incs = db.query(Incident).filter(
                Incident.road_status.in_(["RESTRICTED", "BLOCKED", "CLOSED"])
            ).all()
            for inc in active_incs:
                if inc.road_status in ["BLOCKED", "CLOSED"]:
                    incident_delay_mins += 90
                elif inc.severity in ["HIGH", "CRITICAL"]:
                    incident_delay_mins += 35
                else:
                    incident_delay_mins += 15

        # 5. Factor 4: Bridge Load Restrictions Delay
        bridge_delay_mins = 0
        if db and corridor_code:
            restricted_bridges = db.query(Bridge).filter(
                (Bridge.corridor_code == corridor_code) &
                (Bridge.status.in_(["RESTRICTED", "DAMAGED"]))
            ).all()
            for brg in restricted_bridges:
                bridge_delay_mins += 20 # Single-lane spacing & structural speed limit

        total_delay_mins = traffic_delay_mins + weather_delay_mins + incident_delay_mins + bridge_delay_mins
        predicted_travel_time_hours = round(base_travel_time_hours + (total_delay_mins / 60.0), 2)
        predicted_eta = dep_time + timedelta(hours=predicted_travel_time_hours)

        # Primary Delay Reason & Contributor list
        contributors = []
        if traffic_delay_mins > 0:
            contributors.append(f"Traffic Congestion: +{traffic_delay_mins}m")
        if weather_delay_mins > 0:
            contributors.append(f"Weather Hazard / Rain: +{weather_delay_mins}m")
        if incident_delay_mins > 0:
            contributors.append(f"Active Road Obstruction: +{incident_delay_mins}m")
        if bridge_delay_mins > 0:
            contributors.append(f"Bridge Speed/Load Restriction: +{bridge_delay_mins}m")

        if not contributors:
            contributors.append("Normal operational transit clearance")
            primary_reason = "NORMAL"
        else:
            # Determine maximum factor
            factors = {
                "TRAFFIC": traffic_delay_mins,
                "WEATHER": weather_delay_mins,
                "INCIDENT": incident_delay_mins,
                "BRIDGE": bridge_delay_mins
            }
            primary_reason = max(factors, key=factors.get)

        is_alert = total_delay_mins >= DELAY_ALERT_THRESHOLD_MINS

        return ETABreakdownOut(
            origin=norm_orig,
            destination=norm_dest,
            corridor_code=corridor_code,
            departure_time=dep_time,
            base_travel_time_hours=base_travel_time_hours,
            base_eta=base_eta,
            traffic_delay_mins=traffic_delay_mins,
            weather_delay_mins=weather_delay_mins,
            incident_delay_mins=incident_delay_mins,
            bridge_delay_mins=bridge_delay_mins,
            total_estimated_delay_mins=total_delay_mins,
            predicted_travel_time_hours=predicted_travel_time_hours,
            predicted_eta=predicted_eta,
            primary_delay_reason=primary_reason,
            delay_contributors=contributors,
            is_delay_alert_triggered=is_alert,
            evaluated_at=datetime.utcnow()
        )

    @classmethod
    def update_delivery_live_eta(
        cls,
        delivery: Delivery,
        current_lat: Optional[float],
        current_lng: Optional[float],
        db: Session
    ) -> DeliveryETAUpdateOut:
        """
        Recalculates delivery ETA and remaining distance as vehicle location advances.
        Dispatches proactive delay alert if threshold is exceeded.
        """
        eta_breakdown = cls.calculate_eta_breakdown(
            origin=delivery.origin_city,
            destination=delivery.destination_city,
            corridor_code="COR-NH27",
            departure_time=delivery.created_at,
            db=db,
            vehicle_lat=current_lat,
            vehicle_lng=current_lng
        )

        delivery.revised_eta = eta_breakdown.predicted_eta
        delivery.estimated_delay_mins = eta_breakdown.total_estimated_delay_mins
        delivery.delay_reason = eta_breakdown.primary_delay_reason

        # GAP 20: Dispatch Delay Alert via DelayedDeliveryAlertService (includes SSE broadcast)
        delay_alert_active = False
        if eta_breakdown.is_delay_alert_triggered:
            delay_alert_active = True
            try:
                from app.services.operational_alerts_service import DelayedDeliveryAlertService
                DelayedDeliveryAlertService.evaluate_and_alert(delivery, db)
            except Exception as e:
                logger.warning(f"[GAP20] Delay alert service failed for delivery #{delivery.id}: {e}")

        db.commit()

        v_code = delivery.vehicle.vehicle_code if delivery.vehicle else "UNASSIGNED"

        return DeliveryETAUpdateOut(
            delivery_id=delivery.id,
            delivery_code=delivery.delivery_code,
            cargo_name=delivery.cargo_name,
            cargo_category=delivery.cargo_category,
            vehicle_code=v_code,
            current_lat=current_lat,
            current_lng=current_lng,
            remaining_distance_km=eta_breakdown.base_travel_time_hours * 48.0,
            base_eta=delivery.original_eta,
            revised_eta=delivery.revised_eta,
            estimated_delay_mins=delivery.estimated_delay_mins,
            delay_reason=delivery.delay_reason,
            delay_alert_active=delay_alert_active,
            status=delivery.status,
            updated_at=datetime.utcnow()
        )
