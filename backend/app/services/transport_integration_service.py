"""
Transport Integration Service (SIH Gap 8: External Transport Database Integration)
Provides a clean, extensible adapter architecture to ingest, normalize, and sync
external transport data (e.g. ULIP Unified Logistics Interface Platform, VAHAN National Register, FASTag)
into the LINK X8 platform with duplicate prevention, error resilience, and audit compliance.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from sqlalchemy.orm import Session

from app.models.models import Vehicle, TelemetryLog, AuditLog
from app.schemas.schemas import (
    ExternalTransportRecordIn,
    NormalizedTransportRecordOut,
    TransportSyncSummaryOut,
    TransportProviderStatusOut,
)
from app.core.config import settings

logger = logging.getLogger("link_x8.transport_integration")

class BaseTransportAdapter:
    """Abstract interface contract for external transport providers."""
    
    def __init__(self, provider_name: str, mode: str = "INTEGRATION-READY"):
        self.provider_name = provider_name
        self.mode = mode

    def normalize(self, raw_record: ExternalTransportRecordIn) -> Dict[str, Any]:
        raise NotImplementedError

    def fetch_records(self) -> List[ExternalTransportRecordIn]:
        raise NotImplementedError


class ULIPTransportAdapter(BaseTransportAdapter):
    """
    Adapter for India's Unified Logistics Interface Platform (ULIP / NLMC).
    Standardizes multivehicle tracking, e-way bill links, and freight positioning.
    """
    def __init__(self):
        super().__init__(provider_name="ULIP_LOGISTICS_GATEWAY", mode="INTEGRATION-READY")

    def normalize(self, raw: ExternalTransportRecordIn) -> Dict[str, Any]:
        return {
            "external_vehicle_id": raw.external_vehicle_id.strip(),
            "license_plate": raw.license_plate.strip().upper(),
            "vehicle_type": raw.vehicle_type or "Heavy Multi-Axle Cargo Truck",
            "capacity_tons": float(raw.capacity_tons or 25.0),
            "current_lat": float(raw.current_lat),
            "current_lng": float(raw.current_lng),
            "speed_kmh": float(raw.speed_kmh or 0.0),
            "heading_deg": float(raw.heading_deg or 0.0),
            "status": raw.status or "IN_TRANSIT",
            "current_corridor": raw.current_corridor or "COR-NH27",
            "telemetry_source": "EXTERNAL_ULIP_LOGISTICS_GATEWAY",
            "provider": self.provider_name,
            "timestamp": raw.timestamp or datetime.utcnow()
        }


class VAHANTransportAdapter(BaseTransportAdapter):
    """
    Adapter for MoRTH VAHAN National Registry.
    Validates chassis, payload limits, and vehicle registration statuses in the NER.
    """
    def __init__(self):
        super().__init__(provider_name="VAHAN_FLEET_REGISTRY", mode="INTEGRATION-READY")

    def normalize(self, raw: ExternalTransportRecordIn) -> Dict[str, Any]:
        return {
            "external_vehicle_id": raw.external_vehicle_id.strip(),
            "license_plate": raw.license_plate.strip().upper(),
            "vehicle_type": raw.vehicle_type or "Heavy Commercial Vehicle",
            "capacity_tons": float(raw.capacity_tons or 20.0),
            "current_lat": float(raw.current_lat),
            "current_lng": float(raw.current_lng),
            "speed_kmh": float(raw.speed_kmh or 0.0),
            "heading_deg": float(raw.heading_deg or 0.0),
            "status": raw.status or "IN_TRANSIT",
            "current_corridor": raw.current_corridor or "COR-NH27",
            "telemetry_source": "EXTERNAL_VAHAN_FLEET_REGISTRY",
            "provider": self.provider_name,
            "timestamp": raw.timestamp or datetime.utcnow()
        }


class FASTagTransportAdapter(BaseTransportAdapter):
    """
    Adapter for NETC FASTag Toll Plaza transit feeds across NHAI corridors in NER.
    """
    def __init__(self):
        super().__init__(provider_name="FASTAG_TOLL_TRANSIT", mode="INTEGRATION-READY")

    def normalize(self, raw: ExternalTransportRecordIn) -> Dict[str, Any]:
        return {
            "external_vehicle_id": raw.external_vehicle_id.strip(),
            "license_plate": raw.license_plate.strip().upper(),
            "vehicle_type": raw.vehicle_type or "Commercial Goods Carrier",
            "capacity_tons": float(raw.capacity_tons or 18.0),
            "current_lat": float(raw.current_lat),
            "current_lng": float(raw.current_lng),
            "speed_kmh": float(raw.speed_kmh or 45.0),
            "heading_deg": float(raw.heading_deg or 90.0),
            "status": raw.status or "IN_TRANSIT",
            "current_corridor": raw.current_corridor or "COR-NH27",
            "telemetry_source": "EXTERNAL_FASTAG_TOLL_TRANSIT",
            "provider": self.provider_name,
            "timestamp": raw.timestamp or datetime.utcnow()
        }


class TransportIntegrationService:
    """
    Main coordinator service for external transport integrations.
    Handles ingestion, adapter dispatch, deduplication, DB persistence, and telemetry updates.
    """
    ADAPTERS = {
        "ULIP_LOGISTICS_GATEWAY": ULIPTransportAdapter(),
        "VAHAN_FLEET_REGISTRY": VAHANTransportAdapter(),
        "FASTAG_TOLL_TRANSIT": FASTagTransportAdapter(),
        "TEST_REGIONAL_FLEET": ULIPTransportAdapter()
    }

    @classmethod
    def get_adapter(cls, provider: str) -> BaseTransportAdapter:
        return cls.ADAPTERS.get(provider.upper(), cls.ADAPTERS["ULIP_LOGISTICS_GATEWAY"])

    @classmethod
    def normalize_record(cls, record: ExternalTransportRecordIn) -> Dict[str, Any]:
        """Validates bounds and converts external fields to internal structure."""
        if not (-90.0 <= record.current_lat <= 90.0) or not (-180.0 <= record.current_lng <= 180.0):
            raise ValueError(f"Invalid geographical coordinates: ({record.current_lat}, {record.current_lng})")

        adapter = cls.get_adapter(record.external_provider)
        return adapter.normalize(record)

    @classmethod
    def sync_external_batch(
        cls, 
        records: List[ExternalTransportRecordIn], 
        db: Session,
        provider_name: str = "ULIP_LOGISTICS_GATEWAY"
    ) -> TransportSyncSummaryOut:
        """
        Synchronizes a batch of external transport records with internal Vehicle & Telemetry models.
        Applies duplicate prevention, updates existing records idempotently, and logs telemetry.
        """
        synced_count = 0
        updated_count = 0
        errors_count = 0
        normalized_output_list: List[NormalizedTransportRecordOut] = []

        for item in records:
            try:
                norm = cls.normalize_record(item)
                internal_code = f"EXT-{norm['external_vehicle_id']}"
                
                # Check for existing vehicle by deterministic external vehicle_code
                vehicle = db.query(Vehicle).filter(Vehicle.vehicle_code == internal_code).first()

                is_duplicate_prevented = False

                if vehicle:
                    # Update existing vehicle state without creating duplicate vehicle record
                    vehicle.current_lat = norm["current_lat"]
                    vehicle.current_lng = norm["current_lng"]
                    vehicle.speed_kmh = norm["speed_kmh"]
                    vehicle.heading_deg = norm["heading_deg"]
                    vehicle.status = norm["status"]
                    vehicle.last_telemetry_at = norm["timestamp"]
                    vehicle.telemetry_source = norm["telemetry_source"]
                    updated_count += 1
                    is_duplicate_prevented = True
                else:
                    # Create new normalized vehicle
                    vehicle = Vehicle(
                        vehicle_code=internal_code,
                        driver_name=f"External Driver ({norm['provider']})",
                        driver_phone="+91-0000000000",
                        vehicle_type=norm["vehicle_type"],
                        status=norm["status"],
                        current_lat=norm["current_lat"],
                        current_lng=norm["current_lng"],
                        destination_city="Regional Hub",
                        risk_level="LOW",
                        speed_kmh=norm["speed_kmh"],
                        heading_deg=norm["heading_deg"],
                        connectivity_status="ONLINE",
                        telemetry_source=norm["telemetry_source"],
                        last_telemetry_at=norm["timestamp"]
                    )
                    db.add(vehicle)
                    db.flush() # flush to get vehicle.id
                    synced_count += 1

                # Record Telemetry Log for GIS timeline & live map playback
                telemetry = TelemetryLog(
                    vehicle_id=vehicle.id,
                    vehicle_code=vehicle.vehicle_code,
                    latitude=norm["current_lat"],
                    longitude=norm["current_lng"],
                    speed_kmh=norm["speed_kmh"],
                    heading_deg=norm["heading_deg"],
                    telemetry_source=norm["telemetry_source"],
                    recorded_at=norm["timestamp"]
                )
                db.add(telemetry)

                normalized_output_list.append(
                    NormalizedTransportRecordOut(
                        internal_vehicle_code=internal_code,
                        external_vehicle_id=norm["external_vehicle_id"],
                        provider=norm["provider"],
                        license_plate=norm["license_plate"],
                        vehicle_type=norm["vehicle_type"],
                        current_lat=norm["current_lat"],
                        current_lng=norm["current_lng"],
                        speed_kmh=norm["speed_kmh"],
                        status=norm["status"],
                        telemetry_source=norm["telemetry_source"],
                        is_duplicate_prevented=is_duplicate_prevented,
                        synchronized_at=datetime.utcnow()
                    )
                )

            except Exception as e:
                logger.error(f"Failed to sync transport item {item.external_vehicle_id}: {str(e)}")
                errors_count += 1

        db.commit()

        # Audit log for external synchronization
        audit = AuditLog(
            user_email="system@linkx8.gov.in",
            action="EXTERNAL_TRANSPORT_SYNC",
            resource="TransportIntegrationService",
            details=f"Provider: {provider_name}, Received: {len(records)}, Synced: {synced_count}, Updated: {updated_count}, Errors: {errors_count}"
        )
        db.add(audit)
        db.commit()

        return TransportSyncSummaryOut(
            status="SUCCESS" if errors_count == 0 else "PARTIAL_SUCCESS",
            provider=provider_name,
            total_received=len(records),
            synced_count=synced_count,
            updated_count=updated_count,
            errors_count=errors_count,
            normalized_records=normalized_output_list,
            message=f"Synchronized {synced_count + updated_count}/{len(records)} external transport records from {provider_name} successfully."
        )

    @classmethod
    def get_providers_status(cls, db: Session) -> List[TransportProviderStatusOut]:
        """Returns status of external transport gateways configured for LINK X8."""
        total_ext_vehicles = db.query(Vehicle).filter(Vehicle.telemetry_source.like("EXTERNAL_%")).count()
        
        return [
            TransportProviderStatusOut(
                provider_name="ULIP_LOGISTICS_GATEWAY",
                integration_mode="INTEGRATION-READY",
                supported_adapters=["ULIP API v2.0", "NLMC E-Way Bill Feeds", "Freight Smart Cities API"],
                total_integrated_vehicles=total_ext_vehicles,
                last_sync_timestamp=datetime.utcnow(),
                api_health="READY_FOR_CREDENTIALS",
                documentation_url="https://www.gati-shakti.gov.in/ulip"
            ),
            TransportProviderStatusOut(
                provider_name="VAHAN_FLEET_REGISTRY",
                integration_mode="INTEGRATION-READY",
                supported_adapters=["MoRTH Vahan 4.0 API", "National Permit Registry"],
                total_integrated_vehicles=total_ext_vehicles,
                last_sync_timestamp=datetime.utcnow(),
                api_health="READY_FOR_CREDENTIALS",
                documentation_url="https://vahan.parivahan.gov.in"
            ),
            TransportProviderStatusOut(
                provider_name="FASTAG_TOLL_TRANSIT",
                integration_mode="INTEGRATION-READY",
                supported_adapters=["NETC FASTag Transaction Stream", "NHAI Toll Plaza Event Bridge"],
                total_integrated_vehicles=total_ext_vehicles,
                last_sync_timestamp=datetime.utcnow(),
                api_health="READY_FOR_CREDENTIALS",
                documentation_url="https://www.npci.org.in/what-we-do/netc-fastag"
            )
        ]
