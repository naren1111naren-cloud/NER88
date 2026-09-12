from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.schemas import (
    TelemetryPacketIn,
    TelemetryBatchIn,
    TelemetryIngestResponseOut,
    TelemetryBatchResponseOut,
    TelemetryLogOut,
    TelemetryHealthSummaryOut,
    DeviceRegisterIn,
    DeviceRegisterOut,
    SimulationStepRequest,
    SimulationStepResponseOut
)
from app.services.telemetry_service import TelemetryService

router = APIRouter(prefix="/telemetry", tags=["GPS Vehicle Tracking & Telematics Ingestion"])

@router.post("/ingest", response_model=TelemetryIngestResponseOut)
def ingest_telemetry(
    packet: TelemetryPacketIn,
    x_device_api_key: Optional[str] = Header(None, alias="X-Device-API-Key"),
    db: Session = Depends(get_db)
):
    """
    Unified Telemetry Ingestion Endpoint:
    Receives real-time GPS/OBD telemetry from physical hardware devices, phone GPS, or demonstration simulator.
    Validates packet bounding, updates live vehicle telemetry state, logs breadcrumbs, checks geofences and safety triggers.
    """
    return TelemetryService.ingest_telemetry_packet(packet, db, client_api_key=x_device_api_key)

@router.post("/phone-gps", response_model=TelemetryIngestResponseOut)
def ingest_phone_gps(
    packet: TelemetryPacketIn,
    db: Session = Depends(get_db)
):
    """
    Live Phone GPS Endpoint:
    Direct ingestion for browser / mobile navigator.geolocation streams.
    Does not require hardware API keys and automatically tags tracking_mode as LIVE_PHONE_GPS.
    """
    if not packet.telemetry_source:
        packet.telemetry_source = "PHONE_GPS_LIVE"
    return TelemetryService.ingest_telemetry_packet(packet, db)

@router.post("/batch", response_model=TelemetryBatchResponseOut)
def ingest_batch_telemetry(
    batch: TelemetryBatchIn,
    x_device_api_key: Optional[str] = Header(None, alias="X-Device-API-Key"),
    db: Session = Depends(get_db)
):
    """
    Batch Telemetry Ingestion Endpoint:
    Receives an array of buffered GPS telemetry packets for offline sync recovery or fleet gateways.
    """
    return TelemetryService.ingest_batch_telemetry(batch, db, client_api_key=x_device_api_key)

@router.post("/simulate-step", response_model=SimulationStepResponseOut)
def simulate_vehicle_step(
    req: SimulationStepRequest,
    db: Session = Depends(get_db)
):
    """
    Demonstration Simulator Controller:
    Advances the selected vehicle's position along its strategic highway corridor and feeds the generated
    packet through the exact same ingestion pipeline (/telemetry/ingest).
    """
    return TelemetryService.simulate_vehicle_step(req.vehicle_code, db, req.step_increment)

@router.get("/vehicles/{vehicle_code}/history", response_model=List[TelemetryLogOut])
def get_vehicle_telemetry_history(
    vehicle_code: str,
    limit: int = Query(50, ge=1, le=500, description="Max number of historical GPS breadcrumb records to return"),
    db: Session = Depends(get_db)
):
    """
    Retrieves historical GPS breadcrumbs and telematics timeline for route tracking and trail visualization.
    """
    return TelemetryService.get_vehicle_breadcrumbs(vehicle_code, limit, db)

@router.get("/health", response_model=TelemetryHealthSummaryOut)
def get_telemetry_fleet_health(db: Session = Depends(get_db)):
    """
    Returns real-time telemetry health summary across all fleet vehicles (LIVE, RECENT, STALE, OFFLINE).
    """
    return TelemetryService.get_fleet_telemetry_health(db)

@router.post("/devices/register", response_model=DeviceRegisterOut)
def register_tracking_device(
    payload: DeviceRegisterIn,
    db: Session = Depends(get_db)
):
    """
    Provisions a physical GPS/OBD tracking device for a vehicle, binds its ID, and returns a secure X-Device-API-Key.
    """
    return TelemetryService.register_device(payload, db)
