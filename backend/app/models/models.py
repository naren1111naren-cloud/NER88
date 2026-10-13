from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="Viewer") # Admin, Dispatcher, Field Officer, Viewer
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_code = Column(String, unique=True, index=True, nullable=False) # e.g. NER-V001
    device_id = Column(String, nullable=True, index=True) # e.g. OBD-NER-001, GPS-TRACKER-102
    device_api_key = Column(String, nullable=True) # For hardware authentication
    driver_name = Column(String, nullable=False)
    driver_phone = Column(String, nullable=True)
    vehicle_type = Column(String, default="Heavy Truck (10T)")
    status = Column(String, default="IN_TRANSIT") # IN_TRANSIT, IDLE, MAINTENANCE, DELAYED, REROUTED, OFFLINE
    current_lat = Column(Float, nullable=False)
    current_lng = Column(Float, nullable=False)
    destination_city = Column(String, nullable=False)
    risk_level = Column(String, default="LOW") # LOW, MEDIUM, HIGH, CRITICAL
    speed_kmh = Column(Float, default=45.0)
    heading_deg = Column(Float, default=90.0)
    odometer_km = Column(Float, default=12450.0)
    ignition_status = Column(String, default="ON") # ON, OFF
    connectivity_status = Column(String, default="ONLINE") # ONLINE, OFFLINE
    telemetry_health = Column(String, default="LIVE") # LIVE, RECENT, STALE, OFFLINE
    tracking_mode = Column(String, default="SIMULATION") # SIMULATION, LIVE_HARDWARE
    altitude_m = Column(Float, default=150.0)
    battery_level_pct = Column(Float, default=98.0)
    satellites_connected = Column(Integer, default=12)
    telemetry_source = Column(String, default="SIMULATED GPS TELEMETRY")
    last_telemetry_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    deliveries = relationship("Delivery", back_populates="vehicle")
    telemetry_logs = relationship("TelemetryLog", back_populates="vehicle")

class TelemetryLog(Base):
    __tablename__ = "telemetry_logs"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    vehicle_code = Column(String, nullable=False, index=True)
    device_id = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed_kmh = Column(Float, default=0.0)
    heading_deg = Column(Float, default=0.0)
    altitude_m = Column(Float, default=150.0)
    odometer_km = Column(Float, default=0.0)
    ignition_status = Column(String, default="ON")
    battery_level_pct = Column(Float, default=100.0)
    satellites_connected = Column(Integer, default=8)
    telemetry_source = Column(String, default="SIMULATED GPS TELEMETRY")
    raw_payload = Column(Text, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)

    vehicle = relationship("Vehicle", back_populates="telemetry_logs")

class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    delivery_code = Column(String, unique=True, index=True, nullable=False) # e.g. DEL-2026-001
    cargo_name = Column(String, nullable=False)
    cargo_type = Column(String, default="Medical Supplies")
    cargo_category = Column(String, default="Medicines") # Medicines, Food supplies, Construction materials, Agricultural produce, Emergency supplies
    priority = Column(String, default="URGENT") # EMERGENCY, URGENT, HIGH, NORMAL
    origin_city = Column(String, nullable=False)
    destination_city = Column(String, nullable=False)
    assigned_vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    driver_name = Column(String, nullable=True)
    status = Column(String, default="IN_TRANSIT") # CREATED, ASSIGNED, LOADED, DISPATCHED, IN_TRANSIT, DELAYED_AT_RISK, ARRIVED, DELIVERED, Completed
    original_eta = Column(DateTime, nullable=False)
    revised_eta = Column(DateTime, nullable=False)
    estimated_delay_mins = Column(Integer, default=0)
    delay_reason = Column(String, default="Normal Transit Clearance") # TRAFFIC, WEATHER, INCIDENT, BRIDGE, NORMAL
    route_risk_score = Column(Float, default=15.0)
    route_risk_category = Column(String, default="LOW")
    quantity_description = Column(String, default="Standard Pallet Load (500 units)")
    temperature_controlled = Column(Boolean, default=False)
    active_route_path = Column(Text, nullable=True) # JSON list of lat/lng pairs
    alternate_route_path = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    actual_delivery_duration_hours = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vehicle = relationship("Vehicle", back_populates="deliveries")

class TrafficRecord(Base):
    __tablename__ = "traffic_records"

    id = Column(Integer, primary_key=True, index=True)
    corridor_code = Column(String, index=True, nullable=False) # e.g. COR-NH27
    segment_name = Column(String, nullable=False) # e.g. Guwahati - Nagaon Expressway
    congestion_level = Column(String, default="LOW") # LOW, MODERATE, HIGH, SEVERE
    congestion_index = Column(Float, default=0.25) # 0.0 to 1.0
    average_speed_kmh = Column(Float, default=45.0)
    free_flow_speed_kmh = Column(Float, default=60.0)
    traffic_delay_mins = Column(Integer, default=10)
    travel_time_multiplier = Column(Float, default=1.15)
    data_source = Column(String, default="SIMULATED_HIGHWAY_SENSORS") # SIMULATED_HIGHWAY_SENSORS, LIVE_ATMS_INTEGRATION
    is_live = Column(Boolean, default=False)
    recorded_at = Column(DateTime, default=datetime.utcnow)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_type = Column(String, nullable=False) # LANDSLIDE, FLOOD, BRIDGE_DAMAGE, ROAD_DAMAGE, TRAFFIC, WEATHER, OTHER
    description = Column(Text, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String, nullable=False)
    district_name = Column(String, nullable=True)
    severity = Column(String, default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    road_status = Column(String, default="PASSABLE") # OPEN, PASSABLE, PARTIAL, RESTRICTED, BLOCKED, CLOSED
    reporter_name = Column(String, default="Field Officer")
    affected_bridge_id = Column(Integer, nullable=True)
    affected_bridge_code = Column(String, nullable=True)
    is_synced = Column(Boolean, default=True)
    photo_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Corridor(Base):
    __tablename__ = "corridors"

    id = Column(Integer, primary_key=True, index=True)
    corridor_code = Column(String, unique=True, index=True, nullable=False) # e.g. COR-NH27
    name = Column(String, nullable=False) # e.g. NH27 Guwahati - Imphal Transport Corridor
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    states_covered = Column(String, nullable=False) # e.g. Assam, Nagaland, Manipur
    status = Column(String, default="OPEN") # OPEN, PASSABLE, PARTIAL, RESTRICTED, BLOCKED, CLOSED
    accessibility_status = Column(String, default="OPEN") # OPEN, RESTRICTED, BLOCKED
    accessibility_score = Column(Float, default=90.0) # 0 to 100
    risk_level = Column(String, default="LOW") # LOW, MEDIUM, HIGH, CRITICAL
    current_condition = Column(String, default="Normal traffic flow")
    weather_condition = Column(String, default="Clear")
    reason = Column(Text, default="Normal road and bridge passage")
    factor_summary = Column(String, default="Normal road and bridge passage")
    estimated_delay_mins = Column(Integer, default=0)
    incident_count = Column(Integer, default=0)
    data_source = Column(String, default="INTEGRATED_ACCESSIBILITY_ENGINE")
    data_sources = Column(Text, default='["Open-Meteo Live API", "Field Officer Inspection Incident Feed", "BRO Bridge Clearance Registry"]')
    data_confidence = Column(String, default="HIGH") # HIGH, MEDIUM, LOW, ESTIMATED
    polyline_coords = Column(Text, nullable=True) # JSON array of coordinates
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Bridge(Base):
    __tablename__ = "bridges"

    id = Column(Integer, primary_key=True, index=True)
    bridge_code = Column(String, unique=True, index=True, nullable=False) # e.g. BRG-NH37-IRANG
    name = Column(String, nullable=False) # e.g. Irang River Bailey Bridge
    river_name = Column(String, nullable=True) # e.g. Irang River
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    connected_road = Column(String, nullable=True) # e.g. NH37, NH27, NH10
    corridor_code = Column(String, nullable=True, index=True) # e.g. COR-NH37
    district_name = Column(String, nullable=True, index=True)
    state = Column(String, nullable=False)
    status = Column(String, default="OPERATIONAL") # OPERATIONAL, RESTRICTED, DAMAGED, CLOSED, UNKNOWN
    condition_description = Column(String, default="Normal structural clearance")
    load_capacity_tons = Column(Float, default=40.0)
    load_restriction_type = Column(String, default="No Restriction") # No Restriction, Light Vehicles Only, Reduced Load (Max 20T), Heavy Vehicles Restricted, Closed, Unknown
    accessibility_score = Column(Float, default=95.0) # 0 to 100
    risk_level = Column(String, default="LOW") # LOW, MEDIUM, HIGH, CRITICAL
    restriction_details = Column(Text, nullable=True)
    active_incident_id = Column(Integer, nullable=True)
    is_verified = Column(Boolean, default=True)
    data_source = Column(String, default="FIELD_INSPECTION_RECORD") # FIELD_INSPECTION_RECORD, ADMIN_UPDATE, SYSTEM_PREDICTION, SIMULATED, UNKNOWN
    data_confidence = Column(String, default="HIGH") # HIGH, MEDIUM, LOW
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class District(Base):
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # e.g. Senapati, Kamrup Metropolitan, Imphal West
    state = Column(String, nullable=False) # e.g. Manipur, Assam
    accessibility_index = Column(Float, default=85.0) # 0 to 100
    status = Column(String, default="Good") # Highly Accessible (90+), Good (75-89), Moderate (50-74), Poor (25-49), Severely Inaccessible (0-24)
    active_incidents_count = Column(Integer, default=0)
    bridge_count = Column(Integer, default=0)
    accessible_corridor_count = Column(Integer, default=0)
    critical_supply_status = Column(String, default="STABLE") # STABLE, AT_RISK, CRITICAL_DELAY
    last_recalculated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class FieldReport(Base):
    __tablename__ = "field_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_code = Column(String, unique=True, index=True, nullable=False)
    incident_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String, nullable=False)
    district_name = Column(String, nullable=True)
    affected_bridge_id = Column(Integer, nullable=True)
    affected_bridge_code = Column(String, nullable=True)
    severity = Column(String, default="HIGH")
    road_status = Column(String, default="BLOCKED")
    photo_url = Column(String, nullable=True)
    sync_status = Column(String, default="SYNCED") # PENDING_SYNC, SYNCED, SYNC_FAILED
    reported_at = Column(DateTime, default=datetime.utcnow)

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String, nullable=False) # ROUTE_BLOCKED, HIGH_RISK_ROUTE, INCIDENT_REPORTED, VEHICLE_DELAY, EMERGENCY_SHIPMENT, GOVERNMENT_OPERATIONAL_BULLETIN, BLOCKED_ROAD, INACCESSIBLE_REGION, DELIVERY_DELAY_WARNING
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String, default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    location = Column(String, nullable=True)
    recommended_action = Column(Text, nullable=True)
    delivery_id = Column(Integer, nullable=True)
    vehicle_id = Column(Integer, nullable=True)
    # Gap 18-20: source linkage for deduplication and display
    source_incident_id = Column(Integer, nullable=True, index=True)   # Incident that triggered this alert
    corridor_code = Column(String, nullable=True, index=True)          # Affected corridor (Gap 18)
    district_name = Column(String, nullable=True, index=True)          # Affected district (Gap 19)
    is_read = Column(Boolean, default=False)
    status = Column(String, default="NEW") # NEW, DELIVERED, SEEN, ACKNOWLEDGED, RESOLVED
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)                       # Gap 18-20: alert resolution
    created_at = Column(DateTime, default=datetime.utcnow)

class WeatherRecord(Base):
    __tablename__ = "weather_records"

    id = Column(Integer, primary_key=True, index=True)
    location_name = Column(String, nullable=False, index=True)
    state = Column(String, nullable=True)
    temperature_c = Column(Float, default=24.0)
    rainfall_mm_hr = Column(Float, default=0.0)
    condition = Column(String, default="Clear")
    wind_kmh = Column(Float, default=12.0)
    recorded_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, nullable=False)
    action = Column(String, nullable=False)
    resource = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String, unique=True, index=True, nullable=False)
    setting_value = Column(String, nullable=False)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RouteDecision(Base):
    __tablename__ = "route_decisions"

    id = Column(Integer, primary_key=True, index=True)
    decision_code = Column(String, unique=True, index=True, nullable=False) # e.g. RDEC-2026-001
    delivery_id = Column(Integer, ForeignKey("deliveries.id"), nullable=False, index=True)
    delivery_code = Column(String, nullable=False, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True, index=True)
    vehicle_code = Column(String, nullable=True, index=True)
    corridor_code = Column(String, nullable=False, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True, index=True)
    trigger_event = Column(String, default="CORRIDOR_BLOCKED") # CORRIDOR_BLOCKED, CORRIDOR_RESTRICTED, INCIDENT_REPORTED
    original_route_id = Column(String, default="ROUTE_A")
    original_route_name = Column(String, default="Route A (Primary Corridor)")
    original_distance_km = Column(Float, default=480.0)
    original_travel_time_hours = Column(Float, default=11.0)
    original_eta = Column(DateTime, nullable=False)
    alternative_route_id = Column(String, default="ROUTE_B")
    alternative_route_name = Column(String, default="Route B (Western Bypass via Silchar / Jiribam)")
    alternative_distance_km = Column(Float, default=535.0)
    alternative_travel_time_hours = Column(Float, default=13.5)
    new_eta = Column(DateTime, nullable=False)
    additional_distance_km = Column(Float, default=55.0)
    additional_time_minutes = Column(Integer, default=150)
    risk_score_before = Column(Float, default=82.0)
    risk_score_after = Column(Float, default=38.0)
    status = Column(String, default="PROPOSED") # PROPOSED, APPROVED, EXECUTED, REJECTED
    rationale = Column(Text, nullable=True)
    waypoints_json = Column(Text, nullable=True) # Alternate waypoints
    original_waypoints_json = Column(Text, nullable=True) # Original waypoints
    decision_metadata = Column(Text, nullable=True) # Extensible JSON
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


