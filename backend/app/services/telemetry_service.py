import os
import json
import time
import math
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.models import Vehicle, TelemetryLog, Alert, Delivery, Corridor, Incident, Bridge
from app.schemas.schemas import (
    TelemetryPacketIn,
    TelemetryBatchIn,
    TelemetryIngestResponseOut,
    TelemetryLogOut,
    TelemetryHealthSummaryOut,
    DeviceRegisterIn,
    DeviceRegisterOut,
    SimulationStepResponseOut
)
from app.services.alert_delivery_service import AlertDeliveryService

# In-memory geofence alert cooldown cache: (vehicle_id, hazard_key) -> timestamp
_GEOFENCE_ALERT_COOLDOWN: Dict[Tuple[int, str], float] = {}
GEOFENCE_COOLDOWN_SECONDS = 300.0  # 5 minutes cooldown per vehicle per hazard

def _calc_dist_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

class TelemetryService:
    """
    Core Telemetry & GPS Tracking Intelligence Service for SIH26002:
    - Ingests device-agnostic GPS & OBD packets from physical hardware units, browser Phone GPS, and test simulators.
    - Validates coordinate bounds, speed, heading, and timestamp validity.
    - Classifies telemetry signal freshness (LIVE <120s, RECENT 2-10m, STALE 10-60m, OFFLINE >60m).
    - Detects geofence boundaries (proximity to active landslides, road blockages, restricted bridges).
    - Persists historical GPS breadcrumb trails for auditability and trail rendering.
    - Triggers automated safety alerts on mountain corridor overspeeding (>80 km/h), geofence entry, and signal loss.
    - Broadcasts real-time SSE updates to Mission Control and Leaflet GIS maps.
    """

    OVERSPEED_THRESHOLD_KMH = 80.0  # Himalayan mountain corridor safety limit

    @classmethod
    def calculate_telemetry_freshness(cls, timestamp: Optional[datetime]) -> Tuple[str, str]:
        """
        Classifies telemetry freshness:
        - < 120 seconds: LIVE (ONLINE)
        - 2 - 10 minutes: RECENT (ONLINE)
        - 10 - 60 minutes: STALE (STALE)
        - > 60 minutes: OFFLINE (OFFLINE)
        """
        if not timestamp:
            return "OFFLINE", "OFFLINE"
        
        now = datetime.now(timezone.utc)
        if timestamp.tzinfo is None:
            ts = timestamp.replace(tzinfo=timezone.utc)
        else:
            ts = timestamp.astimezone(timezone.utc)
            
        age_seconds = abs((now - ts).total_seconds())
        if age_seconds < 120:
            return "LIVE", "ONLINE"
        elif age_seconds < 600:
            return "RECENT", "ONLINE"
        elif age_seconds < 3600:
            return "STALE", "STALE"
        else:
            return "OFFLINE", "OFFLINE"

    @classmethod
    def validate_telemetry_packet(cls, packet: TelemetryPacketIn) -> None:
        """
        Validates GPS coordinates and physical telemetry properties.
        Rejects invalid or corrupted packets with HTTP 422.
        """
        if not (-90.0 <= packet.latitude <= 90.0):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid telemetry latitude {packet.latitude}: must be between -90.0 and +90.0 degrees."
            )

        if not (-180.0 <= packet.longitude <= 180.0):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid telemetry longitude {packet.longitude}: must be between -180.0 and +180.0 degrees."
            )

        if packet.speed_kmh < 0.0:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid vehicle speed {packet.speed_kmh} km/h: speed cannot be negative."
            )
        if packet.speed_kmh > 200.0:
            raise HTTPException(
                status_code=422,
                detail=f"Implausible vehicle speed {packet.speed_kmh} km/h: exceeds maximum limit of 200.0 km/h."
            )

        if packet.heading_deg is not None and not (0.0 <= packet.heading_deg <= 360.0):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid heading {packet.heading_deg} degrees: must be between 0.0 and 360.0."
            )

    @classmethod
    def evaluate_geofences(cls, vehicle: Vehicle, lat: float, lng: float, db: Session) -> List[Alert]:
        """
        Checks vehicle proximity to active hazards (landslides, blockages, restricted bridges).
        Applies cooldown deduplication to prevent duplicate alerts.
        """
        generated_alerts = []
        now_ts = time.time()
        now_naive = datetime.now(timezone.utc).replace(tzinfo=None)

        # 1. Active Incidents (Landslides, Road Damage, Floods) within 3.5 km
        active_incidents = db.query(Incident).filter(Incident.road_status.in_(["BLOCKED", "RESTRICTED", "HAZARD"])).all()
        for inc in active_incidents:
            if inc.latitude and inc.longitude:
                dist = _calc_dist_km(lat, lng, inc.latitude, inc.longitude)
                if dist <= 3.5:
                    hazard_key = f"inc_{inc.id}"
                    last_alert = _GEOFENCE_ALERT_COOLDOWN.get((vehicle.id, hazard_key), 0)
                    if now_ts - last_alert > GEOFENCE_COOLDOWN_SECONDS:
                        _GEOFENCE_ALERT_COOLDOWN[(vehicle.id, hazard_key)] = now_ts
                        alert = AlertDeliveryService.create_and_broadcast_alert(
                            db=db,
                            alert_type="GEOFENCE_DANGER_ENTRY",
                            title=f"⚠️ GEOFENCE ALERT: {vehicle.vehicle_code} near {inc.incident_type} Zone",
                            message=(
                                f"Vehicle {vehicle.vehicle_code} entered danger zone ({dist:.1f} km from "
                                f"{inc.incident_type} at {inc.location_name}). Road Status: {inc.road_status}."
                            ),
                            severity="CRITICAL" if inc.road_status == "BLOCKED" else "HIGH",
                            location=f"{lat:.4f}, {lng:.4f} ({inc.location_name})",
                            recommended_action="Advise driver to stop or proceed to nearest safe turnout for detour instructions.",
                            vehicle_id=vehicle.id,
                            source_incident_id=inc.id
                        )
                        generated_alerts.append(alert)

        # 2. Restricted Bridges within 2.0 km
        restricted_bridges = db.query(Bridge).filter(Bridge.status.in_(["CLOSED", "RESTRICTED", "DAMAGED"])).all()
        for brg in restricted_bridges:
            if brg.latitude and brg.longitude:
                dist = _calc_dist_km(lat, lng, brg.latitude, brg.longitude)
                if dist <= 2.0:
                    hazard_key = f"bridge_{brg.id}"
                    last_alert = _GEOFENCE_ALERT_COOLDOWN.get((vehicle.id, hazard_key), 0)
                    if now_ts - last_alert > GEOFENCE_COOLDOWN_SECONDS:
                        _GEOFENCE_ALERT_COOLDOWN[(vehicle.id, hazard_key)] = now_ts
                        alert = AlertDeliveryService.create_and_broadcast_alert(
                            db=db,
                            alert_type="BRIDGE_RESTRICTION_GEOFENCE",
                            title=f"🛑 BRIDGE PROXIMITY: {vehicle.vehicle_code} approaching {brg.name}",
                            message=(
                                f"Vehicle {vehicle.vehicle_code} is {dist:.1f} km from {brg.name} "
                                f"(Status: {brg.status}, Limit: {brg.load_capacity_tons}T). "
                                f"Verify vehicle weight before crossing."
                            ),
                            severity="HIGH" if brg.status == "CLOSED" else "MEDIUM",
                            location=f"{lat:.4f}, {lng:.4f} ({brg.name})",
                            recommended_action="Ensure vehicle gross weight does not exceed bridge capacity.",
                            vehicle_id=vehicle.id
                        )
                        generated_alerts.append(alert)

        return generated_alerts

    @classmethod
    def ingest_telemetry_packet(
        cls,
        packet: TelemetryPacketIn,
        db: Session,
        client_api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Ingests and validates a single GPS telemetry packet from physical hardware, phone GPS, or simulator.
        """
        start_time = time.time()

        # Step 0: Validate coordinate bounds and kinematics
        cls.validate_telemetry_packet(packet)

        # Step 1: Lookup vehicle
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_code == packet.vehicle_code.strip()).first()
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Vehicle '{packet.vehicle_code}' is not registered in LINK X8 fleet")

        # Step 2: Determine source mode
        source_str = (packet.telemetry_source or "").upper()
        is_phone_gps = "PHONE" in source_str or "MOBILE" in source_str or "BROWSER" in source_str
        is_hardware = "HARDWARE" in source_str or "OBD" in source_str

        # Device auth check for dedicated hardware devices
        if is_hardware and vehicle.device_api_key:
            auth_key = packet.device_api_key or client_api_key
            if not auth_key or auth_key != vehicle.device_api_key:
                raise HTTPException(status_code=401, detail="Unauthorized telemetry: Invalid or missing device API key")

        now = datetime.now(timezone.utc)
        if packet.timestamp:
            if packet.timestamp.tzinfo is None:
                packet_time = packet.timestamp.replace(tzinfo=timezone.utc)
            else:
                packet_time = packet.timestamp.astimezone(timezone.utc)
        else:
            packet_time = now

        # Step 3: Determine Telemetry Freshness & Health
        health, connectivity = cls.calculate_telemetry_freshness(packet_time)
        age_seconds = abs((now - packet_time).total_seconds())

        # Step 4: Calculate Odometer increment
        new_odometer = vehicle.odometer_km or 12450.0
        if packet.odometer_km is not None and packet.odometer_km >= new_odometer:
            new_odometer = packet.odometer_km
        elif packet.speed_kmh > 0:
            time_delta_hrs = max(0.001, min(0.1, age_seconds / 3600.0))
            new_odometer = round(new_odometer + (packet.speed_kmh * time_delta_hrs), 2)

        # Step 5: Update Vehicle State in Database
        old_health = vehicle.telemetry_health
        vehicle.current_lat = packet.latitude
        vehicle.current_lng = packet.longitude
        vehicle.speed_kmh = packet.speed_kmh
        if packet.heading_deg is not None:
            vehicle.heading_deg = packet.heading_deg
        vehicle.odometer_km = new_odometer
        if packet.ignition_status:
            vehicle.ignition_status = packet.ignition_status
        if packet.altitude_m is not None:
            vehicle.altitude_m = packet.altitude_m
        if packet.battery_level_pct is not None:
            vehicle.battery_level_pct = packet.battery_level_pct
        if packet.satellites_connected is not None:
            vehicle.satellites_connected = packet.satellites_connected
        if packet.device_id:
            vehicle.device_id = packet.device_id

        vehicle.connectivity_status = connectivity
        vehicle.telemetry_health = health

        if is_phone_gps:
            vehicle.tracking_mode = "LIVE_PHONE_GPS"
            vehicle.telemetry_source = "PHONE GPS TELEMETRY (LIVE)"
        elif is_hardware:
            vehicle.tracking_mode = "LIVE_HARDWARE"
            vehicle.telemetry_source = "HARDWARE_GPS_DEVICE"
        else:
            vehicle.tracking_mode = "SIMULATION"
            vehicle.telemetry_source = packet.telemetry_source or "SIMULATED GPS TELEMETRY"

        packet_time_naive = packet_time.astimezone(timezone.utc).replace(tzinfo=None)
        now_naive = now.replace(tzinfo=None)
        vehicle.last_telemetry_at = packet_time_naive
        vehicle.last_updated = now_naive

        if packet.speed_kmh > 5.0:
            vehicle.status = "IN_TRANSIT"
        elif packet.ignition_status == "OFF":
            vehicle.status = "IDLE"

        # Step 6: Append to Historical GPS Breadcrumbs Log
        telemetry_log = TelemetryLog(
            vehicle_id=vehicle.id,
            vehicle_code=vehicle.vehicle_code,
            device_id=packet.device_id or vehicle.device_id,
            latitude=packet.latitude,
            longitude=packet.longitude,
            speed_kmh=packet.speed_kmh,
            heading_deg=packet.heading_deg or vehicle.heading_deg,
            altitude_m=packet.altitude_m or vehicle.altitude_m,
            odometer_km=new_odometer,
            ignition_status=packet.ignition_status or vehicle.ignition_status,
            battery_level_pct=packet.battery_level_pct or vehicle.battery_level_pct,
            satellites_connected=packet.satellites_connected or vehicle.satellites_connected,
            telemetry_source=vehicle.telemetry_source,
            raw_payload=json.dumps(packet.model_dump(mode="json")),
            recorded_at=packet_time_naive
        )
        db.add(telemetry_log)

        # Step 7: Safety Trigger — Mountain Corridor Overspeeding Detection
        if packet.speed_kmh > cls.OVERSPEED_THRESHOLD_KMH:
            AlertDeliveryService.create_and_broadcast_alert(
                db=db,
                alert_type="OVERSPEEDING_WARNING",
                title=f"Overspeeding Alert: {vehicle.vehicle_code} at {packet.speed_kmh:.1f} km/h",
                message=(
                    f"Vehicle {vehicle.vehicle_code} exceeded the mountain corridor speed limit of "
                    f"{cls.OVERSPEED_THRESHOLD_KMH} km/h (recorded: {packet.speed_kmh:.1f} km/h) at "
                    f"coordinates [{packet.latitude:.4f}, {packet.longitude:.4f}]."
                ),
                severity="HIGH",
                location=f"{packet.latitude:.4f}, {packet.longitude:.4f}",
                recommended_action="Dispatch safety advisory to driver to reduce speed on steep terrain.",
                vehicle_id=vehicle.id
            )

        # Step 8: Telemetry Signal Loss Transition Trigger
        if old_health == "LIVE" and health in ["STALE", "OFFLINE"]:
            AlertDeliveryService.create_and_broadcast_alert(
                db=db,
                alert_type="TELEMETRY_SIGNAL_LOST",
                title=f"GPS Signal Lost: Vehicle {vehicle.vehicle_code}",
                message=(
                    f"Telemetry from vehicle {vehicle.vehicle_code} ({vehicle.device_id}) has ceased. "
                    f"Last reported position: [{packet.latitude:.4f}, {packet.longitude:.4f}]."
                ),
                severity="MEDIUM",
                location=f"{packet.latitude:.4f}, {packet.longitude:.4f}",
                recommended_action="Check cellular/satellite coverage in corridor sector and contact driver.",
                vehicle_id=vehicle.id
            )

        # Step 9: Dynamic Geofencing Evaluation
        cls.evaluate_geofences(vehicle, packet.latitude, packet.longitude, db)

        db.commit()
        db.refresh(vehicle)

        # Step 10: Broadcast Live Vehicle Position Update over SSE Stream
        vehicle_payload = {
            "vehicle_id": vehicle.id,
            "vehicle_code": vehicle.vehicle_code,
            "latitude": vehicle.current_lat,
            "longitude": vehicle.current_lng,
            "speed_kmh": vehicle.speed_kmh,
            "heading_deg": vehicle.heading_deg,
            "altitude_m": vehicle.altitude_m,
            "status": vehicle.status,
            "risk_level": vehicle.risk_level,
            "telemetry_health": vehicle.telemetry_health,
            "connectivity_status": vehicle.connectivity_status,
            "tracking_mode": vehicle.tracking_mode,
            "telemetry_source": vehicle.telemetry_source,
            "last_telemetry_at": vehicle.last_telemetry_at.isoformat() if vehicle.last_telemetry_at else None
        }
        AlertDeliveryService.publish_generic_event("VEHICLE_POSITION_UPDATE", vehicle_payload)
        latency_ms = round((time.time() - start_time) * 1000.0, 2)

        return {
            "status": "SUCCESS",
            "vehicle_code": vehicle.vehicle_code,
            "device_id": vehicle.device_id,
            "latitude": vehicle.current_lat,
            "longitude": vehicle.current_lng,
            "speed_kmh": vehicle.speed_kmh,
            "heading_deg": vehicle.heading_deg or 0.0,
            "telemetry_health": health,
            "tracking_mode": vehicle.tracking_mode,
            "telemetry_source": vehicle.telemetry_source,
            "latency_ms": latency_ms,
            "message": "Telemetry packet ingested successfully"
        }

    @classmethod
    def ingest_batch_telemetry(
        cls,
        batch: TelemetryBatchIn,
        db: Session,
        client_api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Ingests array of buffered telemetry packets."""
        results = []
        for p in batch.packets:
            try:
                res = cls.ingest_telemetry_packet(p, db, client_api_key)
                results.append(res)
            except Exception as e:
                results.append({"status": "FAILED", "error": str(e), "vehicle_code": p.vehicle_code})
        return {
            "total_received": len(batch.packets),
            "ingested_count": len([r for r in results if r.get("status") == "SUCCESS"]),
            "results": results
        }

    @classmethod
    def simulate_vehicle_step(cls, vehicle_code: str, db: Session, step_increment: int = 1) -> Dict[str, Any]:
        """
        Advances the vehicle position along its corridor route and feeds it through ingestion.
        """
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_code == vehicle_code).first()
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Vehicle '{vehicle_code}' not found")

        # Standard Guwahati -> Imphal corridor nodes
        route_coords = [
            [26.1445, 91.7362],  # Guwahati
            [26.1850, 92.1500],  # Jagiroad
            [26.3467, 92.6840],  # Nagaon
            [26.1500, 93.2000],  # Dabaka
            [25.9060, 93.7273],  # Dimapur
            [25.6751, 94.1086],  # Kohima
            [25.2676, 94.0210],  # Senapati Pass
            [24.9500, 93.9800],  # Kangpokpi
            [24.8170, 93.9368]   # Imphal
        ]

        curr_lat = vehicle.current_lat or route_coords[0][0]
        curr_lng = vehicle.current_lng or route_coords[0][1]

        min_idx = 0
        min_dist = float("inf")
        for idx, pt in enumerate(route_coords):
            d = (pt[0] - curr_lat)**2 + (pt[1] - curr_lng)**2
            if d < min_dist:
                min_dist = d
                min_idx = idx

        next_idx = (min_idx + step_increment) % len(route_coords)
        target_pt = route_coords[next_idx]

        packet = TelemetryPacketIn(
            vehicle_code=vehicle.vehicle_code,
            latitude=target_pt[0],
            longitude=target_pt[1],
            speed_kmh=45.0,
            heading_deg=135.0,
            altitude_m=750.0,
            ignition_status="ON",
            battery_level_pct=92.0,
            satellites_connected=14,
            telemetry_source="SIMULATED GPS STEP",
            timestamp=datetime.now(timezone.utc)
        )

        ingest_res = cls.ingest_telemetry_packet(packet, db)
        return {
            "vehicle_code": vehicle.vehicle_code,
            "waypoint_index": next_idx,
            "total_waypoints": len(route_coords),
            "telemetry_response": ingest_res,
            "message": f"Advanced {vehicle.vehicle_code} to waypoint {next_idx + 1}/{len(route_coords)}"
        }

    @classmethod
    def get_vehicle_breadcrumbs(cls, vehicle_code: str, limit: int, db: Session) -> List[TelemetryLog]:
        """Returns GPS breadcrumbs timeline."""
        return db.query(TelemetryLog).filter(
            TelemetryLog.vehicle_code == vehicle_code
        ).order_by(desc(TelemetryLog.recorded_at)).limit(limit).all()

    @classmethod
    def get_fleet_telemetry_health(cls, db: Session) -> Dict[str, Any]:
        """Summary of fleet health."""
        vehicles = db.query(Vehicle).all()
        counts = {"LIVE": 0, "RECENT": 0, "STALE": 0, "OFFLINE": 0}
        total = len(vehicles)
        now = datetime.now(timezone.utc)

        devices = []
        hardware_count = 0
        sim_count = 0

        for v in vehicles:
            h, _ = cls.calculate_telemetry_freshness(v.last_telemetry_at)
            counts[h] = counts.get(h, 0) + 1
            if (v.tracking_mode or "").startswith("LIVE_HARDWARE"):
                hardware_count += 1
            else:
                sim_count += 1

            mins_since = 0.0
            if v.last_telemetry_at:
                if v.last_telemetry_at.tzinfo is None:
                    t_utc = v.last_telemetry_at.replace(tzinfo=timezone.utc)
                else:
                    t_utc = v.last_telemetry_at
                mins_since = round(max(0.0, (now - t_utc).total_seconds() / 60.0), 1)
            else:
                mins_since = 999.0

            devices.append({
                "vehicle_code": v.vehicle_code,
                "device_id": v.device_id,
                "status": v.status,
                "health": h,
                "last_telemetry_at": v.last_telemetry_at,
                "minutes_since_last_ping": mins_since,
                "speed_kmh": v.speed_kmh or 0.0,
                "heading_deg": v.heading_deg or 0.0,
                "latitude": v.current_lat or 26.1445,
                "longitude": v.current_lng or 91.7362,
                "tracking_mode": v.tracking_mode or "SIMULATION"
            })

        return {
            "total_vehicles": total,
            "live_count": counts.get("LIVE", 0),
            "recent_count": counts.get("RECENT", 0),
            "stale_count": counts.get("STALE", 0),
            "offline_count": counts.get("OFFLINE", 0),
            "active_hardware_count": hardware_count,
            "active_simulation_count": sim_count,
            "devices": devices,
            "generated_at": now
        }

    @classmethod
    def register_device(cls, payload: DeviceRegisterIn, db: Session) -> Dict[str, Any]:
        """Provisions a tracking device."""
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_code == payload.vehicle_code).first()
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Vehicle '{payload.vehicle_code}' not found")

        api_key = f"dev_sec_{secrets.token_hex(16)}"
        vehicle.device_id = payload.device_id
        vehicle.device_api_key = api_key
        db.commit()

        return {
            "device_id": payload.device_id,
            "vehicle_code": vehicle.vehicle_code,
            "device_api_key": api_key,
            "ingest_endpoint": "/api/v1/telemetry/ingest",
            "sample_curl": f"curl -X POST http://localhost:8000/api/v1/telemetry/ingest -H 'X-Device-API-Key: {api_key}'",
            "registered_at": datetime.now(timezone.utc)
        }
