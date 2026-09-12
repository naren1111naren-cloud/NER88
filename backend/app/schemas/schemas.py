from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field

# Standard Response Wrapper Helper
class APIResponse(BaseModel):
    success: bool = True
    data: Any
    message: str = "Operation completed successfully"

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "Viewer"

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Vehicle Schemas
class VehicleOut(BaseModel):
    id: int
    vehicle_code: str
    device_id: Optional[str] = None
    driver_name: str
    driver_phone: Optional[str] = None
    vehicle_type: str
    status: str
    current_lat: float
    current_lng: float
    destination_city: str
    risk_level: str
    speed_kmh: float
    heading_deg: float = 90.0
    odometer_km: float = 12450.0
    ignition_status: str = "ON"
    connectivity_status: str = "ONLINE"
    telemetry_health: str = "LIVE"
    tracking_mode: str = "SIMULATION"
    altitude_m: float = 150.0
    battery_level_pct: float = 98.0
    satellites_connected: int = 12
    telemetry_source: str = "SIMULATED GPS TELEMETRY"
    last_telemetry_at: Optional[datetime] = None
    last_updated: datetime

    class Config:
        from_attributes = True

class VehicleCreate(BaseModel):
    vehicle_code: str
    device_id: Optional[str] = None
    driver_name: str
    driver_phone: Optional[str] = None
    vehicle_type: str = "Heavy Truck (10T)"
    current_lat: float
    current_lng: float
    destination_city: str

# Telemetry Schemas (SIH Gap 4)
class TelemetryPacketIn(BaseModel):
    vehicle_code: str
    device_id: Optional[str] = None
    device_api_key: Optional[str] = None
    timestamp: Optional[datetime] = None
    latitude: float
    longitude: float
    speed_kmh: float = 0.0
    heading_deg: Optional[float] = 0.0
    altitude_m: Optional[float] = 150.0
    odometer_km: Optional[float] = None
    ignition_status: Optional[str] = "ON"
    battery_level_pct: Optional[float] = 100.0
    satellites_connected: Optional[int] = 12
    telemetry_source: Optional[str] = "HARDWARE_GPS_DEVICE"

class TelemetryBatchIn(BaseModel):
    packets: List[TelemetryPacketIn]

class TelemetryIngestResponseOut(BaseModel):
    status: str
    vehicle_code: str
    device_id: Optional[str] = None
    latitude: float
    longitude: float
    speed_kmh: float
    heading_deg: float
    telemetry_health: str # LIVE, RECENT, STALE, OFFLINE
    tracking_mode: str
    telemetry_source: str
    latency_ms: float
    message: str

class TelemetryLogOut(BaseModel):
    id: int
    vehicle_code: str
    device_id: Optional[str] = None
    latitude: float
    longitude: float
    speed_kmh: float
    heading_deg: float
    altitude_m: float
    odometer_km: float
    ignition_status: str
    telemetry_source: str
    recorded_at: datetime

    class Config:
        from_attributes = True

class TelemetryHealthDeviceItem(BaseModel):
    vehicle_code: str
    device_id: Optional[str] = None
    status: str
    health: str
    last_telemetry_at: Optional[datetime] = None
    minutes_since_last_ping: float
    speed_kmh: float
    heading_deg: float = 0.0
    latitude: float
    longitude: float
    tracking_mode: str

class TelemetryBatchResponseOut(BaseModel):
    total_received: int
    ingested_count: int
    results: List[Dict[str, Any]]

class TelemetryHealthSummaryOut(BaseModel):
    total_vehicles: int
    live_count: int
    recent_count: int
    stale_count: int
    offline_count: int
    active_hardware_count: int
    active_simulation_count: int
    devices: List[TelemetryHealthDeviceItem]
    generated_at: datetime

class DeviceRegisterIn(BaseModel):
    device_id: str
    vehicle_code: str
    device_type: str = "OBD2_GPS_TRACKER"
    manufacturer: Optional[str] = "Generic Teltonika/Concox/AIS140"
    imei_number: Optional[str] = None

class DeviceRegisterOut(BaseModel):
    device_id: str
    vehicle_code: str
    device_api_key: str
    ingest_endpoint: str
    sample_curl: str
    registered_at: datetime

class SimulationStepRequest(BaseModel):
    vehicle_code: str = "NER-V001"
    step_increment: int = 1 # Advance to next waypoint

class SimulationStepResponseOut(BaseModel):
    vehicle_code: str
    waypoint_index: int
    total_waypoints: int
    telemetry_response: Dict[str, Any]
    message: str

# Delivery Schemas
class DeliveryCreate(BaseModel):
    cargo_name: str
    cargo_type: str = "Medical Supplies"
    cargo_category: str = "Medicines" # Medicines, Food supplies, Construction materials, Agricultural produce, Emergency supplies
    priority: str = "URGENT"
    origin_city: str
    destination_city: str
    assigned_vehicle_id: Optional[int] = None
    driver_name: Optional[str] = None
    quantity_description: Optional[str] = "Standard Pallet Load (500 units)"
    temperature_controlled: Optional[bool] = False

class DeliveryOut(BaseModel):
    id: int
    delivery_code: str
    cargo_name: str
    cargo_type: str
    cargo_category: str = "Medicines"
    priority: str = "URGENT"
    origin_city: str
    destination_city: str
    assigned_vehicle_id: Optional[int] = None
    driver_name: Optional[str] = None
    status: str
    original_eta: datetime
    revised_eta: datetime
    estimated_delay_mins: int
    delay_reason: Optional[str] = "Normal Transit Clearance"
    route_risk_score: float
    route_risk_category: str
    quantity_description: Optional[str] = "Standard Pallet Load (500 units)"
    temperature_controlled: Optional[bool] = False
    active_route_path: Optional[str] = None
    alternate_route_path: Optional[str] = None
    completed_at: Optional[datetime] = None
    actual_delivery_duration_hours: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Corridor, Bridge & District Schemas
class CorridorOut(BaseModel):
    id: int
    corridor_code: str
    name: str
    origin: str
    destination: str
    states_covered: str
    status: str
    accessibility_score: float = 90.0
    risk_level: str
    current_condition: str
    weather_condition: str
    reason: Optional[str] = "Normal road and bridge passage"
    estimated_delay_mins: int
    incident_count: int
    data_source: Optional[str] = "INTEGRATED_ACCESSIBILITY_ENGINE"
    data_confidence: Optional[str] = "HIGH"
    polyline_coords: Optional[str] = None
    last_updated: datetime

    class Config:
        from_attributes = True

class BridgeCreate(BaseModel):
    bridge_code: str
    name: str
    river_name: Optional[str] = None
    latitude: float
    longitude: float
    connected_road: Optional[str] = None
    corridor_code: Optional[str] = None
    district_name: Optional[str] = None
    state: str
    status: str = "OPERATIONAL"
    condition_description: str = "Normal structural clearance"
    load_capacity_tons: float = 40.0
    load_restriction_type: str = "No Restriction"
    accessibility_score: float = 95.0
    risk_level: str = "LOW"
    restriction_details: Optional[str] = None

class BridgeStatusUpdate(BaseModel):
    status: str
    condition_description: Optional[str] = None
    load_restriction_type: Optional[str] = None
    load_capacity_tons: Optional[float] = None
    accessibility_score: Optional[float] = None
    risk_level: Optional[str] = None
    restriction_details: Optional[str] = None

class BridgeOut(BaseModel):
    id: int
    bridge_code: str
    name: str
    river_name: Optional[str] = None
    latitude: float
    longitude: float
    connected_road: Optional[str] = None
    corridor_code: Optional[str] = None
    district_name: Optional[str] = None
    state: str
    status: str
    condition_description: str
    load_capacity_tons: float
    load_restriction_type: str = "No Restriction"
    accessibility_score: float
    risk_level: str
    restriction_details: Optional[str] = None
    active_incident_id: Optional[int] = None
    is_verified: bool = True
    data_source: str
    data_confidence: str
    last_updated: datetime

    class Config:
        from_attributes = True

class BridgeImpactOut(BaseModel):
    bridge_id: int
    bridge_code: str
    bridge_name: str
    status: str
    accessibility_score: float
    connected_corridor: Optional[str] = None
    corridor_status: Optional[str] = None
    affected_vehicles_count: int
    affected_deliveries_count: int
    affected_deliveries: List[Dict[str, Any]]
    recommended_action: str

class BridgeLoadValidationRequest(BaseModel):
    bridge_id: Optional[int] = None
    bridge_code: Optional[str] = None
    vehicle_weight_tons: float
    vehicle_type: Optional[str] = None
    cargo_type: Optional[str] = None

class BridgeLoadValidationOut(BaseModel):
    bridge_id: int
    bridge_code: str
    bridge_name: str
    connected_corridor: Optional[str] = None
    bridge_capacity_tons: float
    vehicle_weight_tons: float
    is_compatible: bool
    status: str # PASSABLE, PASSABLE_WITH_CAUTION, RESTRICTED, BLOCKED, EXCEEDS_CAPACITY
    reason: str
    restriction_details: Optional[str] = None
    recommended_action: str

class DistrictOut(BaseModel):
    id: int
    name: str
    state: str
    accessibility_index: float
    status: str
    active_incidents_count: int
    bridge_count: int = 0
    accessible_corridor_count: int = 0
    critical_supply_status: str
    last_recalculated: Optional[datetime] = None

    class Config:
        from_attributes = True

class AssetAccessibilityDetailOut(BaseModel):
    asset_id: str
    asset_type: str # corridor, bridge, district, vehicle
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    district: Optional[str] = None
    state: Optional[str] = None
    corridor: Optional[str] = None
    status: str
    accessibility_score: float
    risk_level: str
    current_condition: str
    active_incidents: int
    weather_condition: Optional[str] = None
    traffic_condition: Optional[str] = None
    estimated_delay_mins: int
    affected_vehicles_count: int = 0
    reason: str
    data_source: str
    data_confidence: str
    last_updated: datetime

class AccessibilitySummaryOut(BaseModel):
    total_corridors: int
    accessible_corridors: int
    restricted_corridors: int
    blocked_corridors: int
    total_bridges: int
    operational_bridges: int
    restricted_bridges: int
    closed_bridges: int
    total_districts: int
    accessible_districts: int
    at_risk_districts: int
    critical_districts: int
    average_regional_accessibility: float
    active_incidents_count: int
    impacted_vehicles_count: int
    last_updated: datetime

class IncidentCreate(BaseModel):
    incident_type: str
    description: str
    latitude: float
    longitude: float
    location_name: str
    district_name: Optional[str] = None
    affected_bridge_id: Optional[int] = None
    affected_bridge_code: Optional[str] = None
    load_restriction_type: Optional[str] = "No Restriction"
    severity: str = "MEDIUM"
    road_status: str = "PASSABLE"
    photo_url: Optional[str] = None

class IncidentOut(BaseModel):
    id: int
    incident_type: str
    description: str
    latitude: float
    longitude: float
    location_name: str
    district_name: Optional[str] = None
    affected_bridge_id: Optional[int] = None
    affected_bridge_code: Optional[str] = None
    severity: str
    road_status: str
    reporter_name: str
    is_synced: bool
    photo_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Field Report Schemas
class FieldReportCreate(BaseModel):
    report_code: str
    incident_type: str
    description: str
    latitude: float
    longitude: float
    location_name: str
    district_name: Optional[str] = None
    affected_bridge_id: Optional[int] = None
    affected_bridge_code: Optional[str] = None
    load_restriction_type: Optional[str] = "No Restriction"
    severity: str = "HIGH"
    road_status: str = "BLOCKED"
    photo_url: Optional[str] = None
    sync_status: str = "PENDING_SYNC"

class SyncBatchRequest(BaseModel):
    reports: List[FieldReportCreate]

# Alert Schemas
class AlertOut(BaseModel):
    id: int
    alert_type: str
    title: str
    message: str
    severity: str
    location: Optional[str] = None
    recommended_action: Optional[str] = None
    delivery_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    # Gap 18-20 linkage fields
    source_incident_id: Optional[int] = None
    corridor_code: Optional[str] = None
    district_name: Optional[str] = None
    is_read: bool = False
    status: str = "NEW" # NEW, DELIVERED, SEEN, ACKNOWLEDGED, RESOLVED
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AlertAcknowledgeIn(BaseModel):
    acknowledged_by: Optional[str] = Field(default="Regional Dispatcher", description="Identity or role acknowledging the alert")
    notes: Optional[str] = Field(default=None, description="Operational notes or action taken")

class AlertCreateIn(BaseModel):
    alert_type: str = Field(..., description="Alert category e.g. BRIDGE_CLOSURE, ROUTE_BLOCKED, VEHICLE_DELAY")
    title: str = Field(..., description="Alert title")
    message: str = Field(..., description="Alert descriptive message")
    severity: str = Field(default="HIGH", description="Severity: LOW, MEDIUM, HIGH, CRITICAL")
    location: Optional[str] = Field(default=None, description="Location of the alert")
    recommended_action: Optional[str] = Field(default=None, description="Recommended operational response")
    delivery_id: Optional[int] = Field(default=None, description="Linked delivery ID")
    vehicle_id: Optional[int] = Field(default=None, description="Linked vehicle ID")

class AlertStreamEventOut(BaseModel):
    event_id: str
    event_type: str # NEW_ALERT, ALERT_ACKNOWLEDGED, ALERT_RESOLVED, HEARTBEAT
    alert: Optional[AlertOut] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Route Risk Predict Request Schema
class RouteAnalysisRequest(BaseModel):
    origin_city: str
    destination_city: str
    distance_km: float = 280.0
    terrain_elevation_gain_m: float = 1800.0
    rainfall_mm_hr: float = 35.0
    active_incidents_count: int = 1
    highest_severity_numeric: int = 2
    road_blocked_status: int = 0
    historical_landslide_freq: float = 0.4
    traffic_congestion_index: float = 0.35
    cargo_priority: str = "URGENT"

# Audit Log Out
class AuditLogOut(BaseModel):
    id: int
    user_email: str
    action: str
    resource: str
    details: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

# Weather Intelligence Schemas (SIH Gap 3)
class GeocodingResultItem(BaseModel):
    id: Optional[int] = None
    name: str
    latitude: float
    longitude: float
    elevation: Optional[float] = None
    feature_code: Optional[str] = None
    country_code: Optional[str] = None
    admin1: Optional[str] = None # State / Region
    admin2: Optional[str] = None # District
    country: Optional[str] = None
    timezone: Optional[str] = None

class WeatherRiskBreakdownOut(BaseModel):
    precipitation_risk: float
    probability_risk: float
    wind_risk: float
    severe_weather_risk: float
    temperature_risk: float
    persistence_risk: float
    total_score: float
    category: str # VERY_LOW, LOW, MODERATE, HIGH, CRITICAL, SEVERE
    logistics_impact: str
    primary_threat: str

class WeatherCurrentOut(BaseModel):
    location_name: str
    state: Optional[str] = None
    latitude: float
    longitude: float
    temperature_c: float
    apparent_temperature_c: Optional[float] = None
    feels_like_c: Optional[float] = None
    relative_humidity_percent: float
    precipitation_mm: float
    rain_mm: float
    showers_mm: Optional[float] = None
    snowfall_cm: Optional[float] = None
    weather_code: int
    weather_condition: str
    cloud_cover_percent: Optional[float] = None
    pressure_msl_hpa: Optional[float] = None
    wind_speed_kmh: float
    wind_direction_deg: float
    wind_gusts_kmh: Optional[float] = None
    visibility_km: Optional[float] = None
    weather_risk: WeatherRiskBreakdownOut
    data_source: str
    data_confidence: str
    is_live: bool = True
    is_cached: bool = False
    is_stale: bool = False
    timezone: Optional[str] = "Asia/Kolkata"
    rainfall_mm_hr: Optional[float] = None
    precipitation_probability: Optional[float] = None
    condition: Optional[str] = None
    wind_kmh: Optional[float] = None
    humidity_percent: Optional[float] = None
    updated_at: Optional[str] = None
    observed_at: datetime
    fetched_at: datetime

class HourlyForecastItem(BaseModel):
    time: str
    temperature_c: float
    precipitation_mm: float
    precipitation_probability: float
    weather_code: int
    weather_condition: str
    wind_speed_kmh: float
    wind_gusts_kmh: Optional[float] = None
    visibility_km: Optional[float] = None
    cloud_cover_percent: Optional[float] = None
    hourly_risk_score: float
    hourly_risk_category: str
    rain_mm: Optional[float] = None
    condition: Optional[str] = None
    wind_kmh: Optional[float] = None

class DailyForecastItem(BaseModel):
    date: str
    temperature_max_c: float
    temperature_min_c: float
    precipitation_sum_mm: float
    precipitation_probability_max: float
    max_wind_speed_kmh: float
    wind_gusts_max_kmh: Optional[float] = None
    sunrise: Optional[str] = None
    sunset: Optional[str] = None
    weather_code: int
    weather_condition: str
    daily_risk_category: str

class WeatherForecastResponseOut(BaseModel):
    location_name: str
    state: Optional[str] = None
    latitude: float
    longitude: float
    current: WeatherCurrentOut
    hourly: List[HourlyForecastItem]
    daily: List[DailyForecastItem]
    data_source: str
    is_live: bool = True
    timezone: Optional[str] = "Asia/Kolkata"
    last_updated: datetime

class RouteWaypointWeather(BaseModel):
    waypoint_index: int
    latitude: float
    longitude: float
    nearest_hub: str
    temperature_c: float
    precipitation_mm: float
    precipitation_probability: float
    weather_condition: str
    wind_speed_kmh: float
    weather_risk_score: float
    weather_risk_category: str
    primary_threat: str

class RouteWeatherAnalysisRequest(BaseModel):
    origin: str
    destination: str
    corridor_code: Optional[str] = None
    waypoints: Optional[List[List[float]]] = None

class RouteWeatherAnalysisOut(BaseModel):
    origin: str
    destination: str
    corridor_code: Optional[str] = None
    aggregate_weather_risk_score: float
    aggregate_weather_risk_category: str
    peak_precipitation_mm_hr: float
    peak_wind_speed_kmh: float
    severe_weather_count: int
    logistics_advisory: str
    waypoint_assessments: List[RouteWaypointWeather]
    data_source: str
    evaluated_at: datetime

# AI-Based Route Optimization Schemas (SIH Gap 5)
class RouteOptimizationRequest(BaseModel):
    origin_city: str
    destination_city: str
    optimization_objective: str = "BALANCED" # BALANCED, SAFEST, FASTEST, MOST_RESILIENT
    cargo_priority: str = "URGENT" # NORMAL, HIGH, URGENT, EMERGENCY
    vehicle_weight_tons: Optional[float] = 20.0
    avoid_closed_bridges: bool = True
    consider_live_weather: bool = True
    active_blockages: Optional[List[Dict[str, Any]]] = None

class CandidateRouteOut(BaseModel):
    id: str # ROUTE_A, ROUTE_B, ROUTE_C
    name: str
    corridor_code: str
    distance_km: float
    estimated_travel_time_hours: float
    estimated_delay_mins: int
    base_risk_score: float
    risk_score: float
    risk_category: str
    weather_risk_score: float
    weather_risk_category: str
    weather_advisory: Optional[str] = None
    accessibility_score: float
    resilience_score: float
    bridge_clearance_status: str
    traffic_congestion_index: float
    suitability_score: float # 0 to 100
    rank: int
    is_blocked: bool
    blockage_reason: Optional[str] = ""
    cost_score: float
    waypoints: List[List[float]]
    key_tradeoffs: List[str]
    weather_summary: Optional[Dict[str, Any]] = None

class RouteComparisonItemOut(BaseModel):
    route_id: str
    route_name: str
    corridor_code: str
    rank: int
    distance_km: float
    travel_time_hrs: float
    delay_mins: int
    risk_score: float
    risk_category: str
    weather_category: str
    accessibility_score: float
    resilience_score: float
    suitability_score: float
    status: str
    is_recommended: bool

class RouteOptimizationObjectiveOut(BaseModel):
    objective_key: str
    title: str
    description: str
    weights: Dict[str, float]

class RouteOptimizationResponseOut(BaseModel):
    origin: str
    destination: str
    optimization_objective: str
    applied_weights: Dict[str, float]
    total_candidates_evaluated: int
    recommended_route_id: str
    recommended_route_name: str
    recommendation_summary: str
    why_this_route: List[str]
    tradeoff_analysis: List[str]
    comparison_table: List[RouteComparisonItemOut]
    candidate_routes: List[CandidateRouteOut]
    primary_waypoints: List[List[float]]
    alternate_waypoints: List[List[float]]
    is_single_route: bool = False
    single_route_note: Optional[str] = None
    evaluated_at: datetime

# =========================================================================
# GAP 8: EXTERNAL TRANSPORT DATABASE INTEGRATION SCHEMAS
# =========================================================================

class ExternalTransportRecordIn(BaseModel):
    external_provider: str = "ULIP_LOGISTICS_GATEWAY" # ULIP_LOGISTICS_GATEWAY, VAHAN_FLEET_REGISTRY, FASTAG_TOLL_TRANSIT, TEST_REGIONAL_FLEET
    external_vehicle_id: str
    license_plate: str
    vehicle_type: str = "Heavy Multi-Axle Cargo Truck"
    capacity_tons: float = 25.0
    current_lat: float
    current_lng: float
    speed_kmh: float = 40.0
    heading_deg: float = 90.0
    status: str = "IN_TRANSIT"
    current_corridor: Optional[str] = "COR-NH27"
    assigned_consignor: Optional[str] = "Northeast Civil Supplies"
    timestamp: Optional[datetime] = None
    raw_metadata: Optional[Dict[str, Any]] = None

class ExternalTransportBatchIn(BaseModel):
    provider: str = "ULIP_LOGISTICS_GATEWAY"
    records: List[ExternalTransportRecordIn]

class NormalizedTransportRecordOut(BaseModel):
    internal_vehicle_code: str
    external_vehicle_id: str
    provider: str
    license_plate: str
    vehicle_type: str
    current_lat: float
    current_lng: float
    speed_kmh: float
    status: str
    telemetry_source: str
    is_duplicate_prevented: bool
    synchronized_at: datetime

class TransportSyncSummaryOut(BaseModel):
    status: str
    provider: str
    total_received: int
    synced_count: int
    updated_count: int
    errors_count: int
    normalized_records: List[NormalizedTransportRecordOut]
    message: str

class TransportProviderStatusOut(BaseModel):
    provider_name: str
    integration_mode: str # INTEGRATION-READY, MOCK/DEMO, LIVE
    supported_adapters: List[str]
    total_integrated_vehicles: int
    last_sync_timestamp: Optional[datetime] = None
    api_health: str
    documentation_url: str

# =========================================================================
# GAP 9: GOVERNMENT MONITORING-SYSTEM INTEGRATION SCHEMAS & API CONTRACTS
# =========================================================================

class GovernmentMonitoringRecord(BaseModel):
    """
    Unified, normalized contract for external government monitoring feeds.
    Supports NDMA Sachet, NHAI RAMS, BRO Command, and State PWD systems.
    """
    source: str = Field(default="NDMA_SACHET_PORTAL", description="Government agency / monitoring feed source identifier")
    source_record_id: str = Field(default="", description="Unique bulletin/record identifier issued by the source agency")
    data_type: str = Field(default="DISASTER_INCIDENT", description="Category: ROAD_STATUS, BRIDGE_STATUS, DISASTER_INCIDENT, DISTRICT_INFO, TRANSPORT_INFO, INFRASTRUCTURE_STATUS")
    timestamp: Optional[datetime] = Field(default=None, description="Event generation timestamp in UTC")
    status: str = Field(default="BLOCKED", description="Operational status: OPEN, RESTRICTED, BLOCKED, CLOSED, ACTIVE, RESOLVED, NORMAL, ALERT")
    severity: str = Field(default="HIGH", description="Severity grade: LOW, MEDIUM, HIGH, CRITICAL")
    location_name: str = Field(..., description="Human-readable location or landmark name")
    latitude: float = Field(..., description="Geographical latitude (-90.0 to 90.0)")
    longitude: float = Field(..., description="Geographical longitude (-180.0 to 180.0)")
    district_name: Optional[str] = Field(default=None, description="Affected North Eastern district")
    state: str = Field(default="Assam", description="NER State name (Assam, Meghalaya, Arunachal Pradesh, Manipur, Mizoram, Nagaland, Tripura, Sikkim)")
    description: str = Field(..., description="Detailed official bulletin advisory content")
    geometry: Optional[Dict[str, Any]] = Field(default=None, description="Optional GeoJSON geometry payload")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Optional domain-specific attributes")
    
    # Specific asset link fields
    affected_corridor_code: Optional[str] = Field(default=None, description="Corridor identifier e.g. COR-NH27")
    affected_bridge_code: Optional[str] = Field(default=None, description="Bridge identifier e.g. BRG-001")
    bridge_load_limit_tons: Optional[float] = Field(default=None, description="Temporary maximum allowable gross vehicle load (Tons)")
    transport_vehicle_code: Optional[str] = Field(default=None, description="External government vehicle / convoy ID")
    infrastructure_type: Optional[str] = Field(default=None, description="Type of infrastructure: DEPOT, HELIPAD, FUEL_STATION, WAREHOUSE, TELECOM_TOWER")
    official_reference_url: Optional[str] = Field(default=None, description="Official portal link / CAP XML reference")

    # Compatibility Aliases
    agency_name: Optional[str] = None
    bulletin_code: Optional[str] = None
    road_status: Optional[str] = None

    def model_post_init(self, __context: Any) -> None:
        if self.agency_name and not self.source:
            self.source = self.agency_name
        elif self.source and not self.agency_name:
            self.agency_name = self.source
        
        if self.bulletin_code and not self.source_record_id:
            self.source_record_id = self.bulletin_code
        elif self.source_record_id and not self.bulletin_code:
            self.bulletin_code = self.source_record_id

        if self.road_status and not self.status:
            self.status = self.road_status
        elif self.status and not self.road_status:
            self.road_status = self.status

GovMonitoringRecordIn = GovernmentMonitoringRecord

class GovRoadStatusIn(BaseModel):
    """External -> LINK X8 dedicated road status contract."""
    source: str = Field(default="NHAI_RAMS", description="Authoritative source agency")
    source_record_id: str = Field(..., description="Unique road bulletin identifier")
    road_id: str = Field(..., description="Affected corridor code (e.g. COR-NH27) or highway designation")
    status: str = Field(default="BLOCKED", description="Road state: OPEN, RESTRICTED, BLOCKED, CLOSED")
    severity: str = Field(default="HIGH", description="Severity: LOW, MEDIUM, HIGH, CRITICAL")
    district: Optional[str] = Field(default="Kamrup Metropolitan", description="District name")
    location_name: str = Field(..., description="Location description")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    timestamp: Optional[datetime] = Field(default=None, description="Observation timestamp")
    description: str = Field(..., description="Road condition details")

class GovBridgeStatusIn(BaseModel):
    """External -> LINK X8 dedicated bridge monitoring contract."""
    source: str = Field(default="BRO_BRIDGE_COMMAND", description="Authoritative bridge authority")
    source_record_id: str = Field(..., description="Unique bridge bulletin identifier")
    bridge_id: str = Field(..., description="Bridge code e.g. BRG-001 or bridge name")
    status: str = Field(default="RESTRICTED", description="Bridge operational state: OPEN, RESTRICTED, CLOSED")
    load_restriction_tons: Optional[float] = Field(default=None, description="Max gross vehicle load allowed in metric tons")
    is_closed: bool = Field(default=False, description="True if bridge is completely impassable")
    location_name: str = Field(..., description="Bridge crossing location")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    timestamp: Optional[datetime] = Field(default=None, description="Inspection timestamp")
    severity: str = Field(default="HIGH", description="Severity grade")
    reason: str = Field(..., description="Structural / operational reason for restriction")

class GovDisasterIncidentIn(BaseModel):
    """External -> LINK X8 dedicated disaster & hazard incident contract."""
    source: str = Field(default="NDMA_SACHET_PORTAL", description="Disaster management authority")
    source_record_id: str = Field(..., description="Disaster alert ID")
    incident_type: str = Field(default="LANDSLIDE", description="Disaster type: LANDSLIDE, FLOOD, ROAD_DAMAGE, SEVERE_WEATHER, EARTHQUAKE")
    severity: str = Field(default="CRITICAL", description="Disaster severity: LOW, MEDIUM, HIGH, CRITICAL")
    location_name: str = Field(..., description="Affected hazard site")
    latitude: float = Field(..., description="Hazard latitude")
    longitude: float = Field(..., description="Hazard longitude")
    district: Optional[str] = Field(default="Dima Hasao", description="District name")
    state: str = Field(default="Assam", description="State name")
    timestamp: Optional[datetime] = Field(default=None, description="Detection timestamp")
    status: str = Field(default="ACTIVE", description="Incident state: ACTIVE, CONTAINED, RESOLVED")
    description: str = Field(..., description="Official disaster bulletin message")

class GovDistrictInfoIn(BaseModel):
    """External -> LINK X8 dedicated district accessibility info contract."""
    source: str = Field(default="STATE_DISASTER_MANAGEMENT_AUTHORITY", description="State authority")
    source_record_id: str = Field(..., description="District advisory ID")
    district_id: Optional[str] = Field(default=None, description="Official district code")
    district_name: str = Field(..., description="District name in North East Region")
    state: str = Field(default="Assam", description="State name")
    accessibility_status: str = Field(default="PARTIALLY_ISOLATED", description="Status: ACCESSIBLE, PARTIALLY_ISOLATED, SEVERELY_ISOLATED, BLOCKED")
    latitude: Optional[float] = Field(default=26.14, description="District center latitude")
    longitude: Optional[float] = Field(default=91.73, description="District center longitude")
    timestamp: Optional[datetime] = Field(default=None, description="Advisory timestamp")
    notes: Optional[str] = Field(default=None, description="Operational notes on district supplies")

class GovTransportInfoIn(BaseModel):
    """External -> LINK X8 dedicated government transport information contract."""
    source: str = Field(default="MORTH_TRANSPORT_MONITOR", description="Transport ministry or military convoy authority")
    source_record_id: str = Field(..., description="Convoy/Vehicle tracking record ID")
    transport_id: str = Field(..., description="Convoy or vehicle designation")
    transport_type: str = Field(default="RELIEF_CONVOY", description="Vehicle type: RELIEF_CONVOY, EMERGENCY_AMBULANCE, HEAVY_LOGISTICS")
    location_name: Optional[str] = Field(default="Transit Checkpoint", description="Current location description")
    latitude: float = Field(..., description="Current latitude coordinate")
    longitude: float = Field(..., description="Current longitude coordinate")
    status: str = Field(default="IN_TRANSIT", description="Movement status: IN_TRANSIT, DELAYED, AT_CHECKPOINT, ARRIVED")
    corridor_code: Optional[str] = Field(default=None, description="Current corridor code e.g. COR-NH27")
    timestamp: Optional[datetime] = Field(default=None, description="Telemetry ping timestamp")

class GovInfrastructureStatusIn(BaseModel):
    """External -> LINK X8 dedicated infrastructure status contract."""
    source: str = Field(default="STATE_PWD_NER", description="Infrastructure agency")
    source_record_id: str = Field(..., description="Infrastructure status record ID")
    infrastructure_id: str = Field(..., description="Infrastructure code or name")
    infrastructure_type: str = Field(default="DEPOT", description="Type: DEPOT, HELIPAD, FUEL_STATION, WAREHOUSE, TELECOM_TOWER")
    status: str = Field(default="OPERATIONAL", description="Condition: OPERATIONAL, DEGRADED, NON_OPERATIONAL, SUBMERGED")
    severity: str = Field(default="MEDIUM", description="Severity grade")
    location_name: str = Field(..., description="Infrastructure site location")
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    district: Optional[str] = Field(default=None, description="District name")
    timestamp: Optional[datetime] = Field(default=None, description="Assessment timestamp")
    description: str = Field(..., description="Status summary and operational constraints")

class GovMonitoringBatchIn(BaseModel):
    """Batch container for multi-record government monitoring ingestion."""
    agency_name: Optional[str] = Field(default="NDMA_SACHET_PORTAL", description="Primary reporting agency")
    source: Optional[str] = Field(default=None, description="Source agency alias")
    bulletins: Optional[List[GovernmentMonitoringRecord]] = Field(default=None, description="List of bulletins")
    records: Optional[List[GovernmentMonitoringRecord]] = Field(default=None, description="List of records alias")

    def get_records(self) -> List[GovernmentMonitoringRecord]:
        return self.records or self.bulletins or []

class GovMonitoringBatchResultOut(BaseModel):
    """Normalized response schema for government monitoring batch ingestion."""
    received: int = Field(..., description="Total records received in batch")
    accepted: int = Field(..., description="Successfully processed records")
    rejected: int = Field(..., description="Records rejected due to validation failures")
    duplicates: int = Field(..., description="Duplicate records skipped idempotently")
    stale_records: int = Field(..., description="Records flagged as stale (>72 hours old)")
    incidents_created: int = Field(..., description="New Incident entities created")
    bridges_updated: int = Field(..., description="Bridge restrictions or status updated")
    corridors_affected: int = Field(..., description="Corridors updated with road status")
    districts_affected: int = Field(..., description="Districts with accessibility updates")
    vehicles_tracked: int = Field(..., description="External transport updates logged")
    accessibility_recalculated: bool = Field(default=True, description="True if accessibility index cascaded")
    alerts_dispatched: int = Field(..., description="Operational alerts dispatched")
    status: str = Field(default="SUCCESS", description="Batch processing overall status")
    message: str = Field(..., description="Human-readable processing summary")
    rejected_items: List[Dict[str, Any]] = Field(default=[], description="Details of rejected items with error reasons")

GovSyncSummaryOut = GovMonitoringBatchResultOut

class GovIntegrationStatusOut(BaseModel):
    integration_mode: str # INTEGRATION-READY, SIMULATED, LIVE
    connected_agencies: List[Dict[str, Any]]
    total_bulletins_processed: int
    last_event_timestamp: Optional[datetime] = None
    api_health: str
    security_auth_mode: str
    supported_data_contracts: List[str] = [
        "ROAD_STATUS",
        "BRIDGE_STATUS",
        "DISASTER_INCIDENT",
        "DISTRICT_INFO",
        "TRANSPORT_INFO",
        "INFRASTRUCTURE_STATUS",
        "VAHAN_REGISTRY_COMPLIANCE",
        "BRO_MOUNTAIN_PASS_BULLETIN",
        "NHAI_RAMS_CORRIDOR_METRIC"
    ]

class VahanBridgeComplianceIn(BaseModel):
    registration_number: str = Field(..., description="Vehicle license plate (e.g. AS01EC9921)")
    bridge_code_or_name: str = Field(..., description="Target bridge code (e.g. BRG-003) or bridge name")
    actual_payload_tons: Optional[float] = Field(default=None, description="Actual cargo weight in metric tons")

class DataGovSyncIn(BaseModel):
    resource_id: str = Field(default="9ef84268-d588-465a-a308-a864a43d0070", description="Data.gov.in OGD Resource identifier")


# =========================================================================
# GAP 10: CLOUD INFRASTRUCTURE & HEALTH OBSERVABILITY SCHEMAS
# =========================================================================

class StorageHealthOut(BaseModel):
    storage_backend: str
    bucket_or_path: str
    is_ready: bool
    total_objects_stored: int

class SystemHealthResponseOut(BaseModel):
    status: str # ok, HEALTHY, DEGRADED, UNHEALTHY
    service: str = "LINK X8 Weather API"
    project: str = "LINK X8"
    sih_problem: str = "SIH26002"
    environment: str
    database_status: str
    database_dialect: str
    object_storage: StorageHealthOut
    weather_intelligence_status: str
    telemetry_engine_status: str
    transport_integrations_status: str
    government_monitoring_status: str
    active_corridors_count: int
    active_bridges_count: int
    active_vehicles_count: int
    uptime_seconds: float
    version: str
    timestamp: datetime

# =========================================================================
# GAP 11: TRAFFIC CONGESTION INTELLIGENCE SCHEMAS
# =========================================================================

class TrafficRecordOut(BaseModel):
    id: int
    corridor_code: str
    segment_name: str
    congestion_level: str # LOW, MODERATE, HIGH, SEVERE
    congestion_index: float # 0.0 to 1.0
    average_speed_kmh: float
    free_flow_speed_kmh: float
    traffic_delay_mins: int
    travel_time_multiplier: float
    data_source: str # SIMULATED_HIGHWAY_SENSORS, LIVE_ATMS_INTEGRATION
    is_live: bool
    recorded_at: datetime

    class Config:
        from_attributes = True

class TrafficUpdateIn(BaseModel):
    corridor_code: str
    segment_name: str
    congestion_level: str = "MODERATE" # LOW, MODERATE, HIGH, SEVERE
    congestion_index: float = 0.45
    average_speed_kmh: float = 35.0
    free_flow_speed_kmh: float = 60.0
    traffic_delay_mins: int = 25
    data_source: Optional[str] = "SIMULATED_HIGHWAY_SENSORS"

class CorridorTrafficSummaryOut(BaseModel):
    corridor_code: str
    corridor_name: str
    overall_congestion_level: str
    overall_congestion_index: float
    total_traffic_delay_mins: int
    average_speed_kmh: float
    data_source: str
    is_live: bool
    segments: List[TrafficRecordOut]
    last_updated: datetime

class TrafficProviderStatusOut(BaseModel):
    provider_name: str
    mode: str # SIMULATED_HIGHWAY_SENSORS, LIVE_ATMS_INTEGRATION
    monitored_corridors_count: int
    active_segments_count: int
    api_health: str
    documentation_url: str

# =========================================================================
# GAP 12: ESTIMATED TRAVEL DELAY / ETA SCHEMAS
# =========================================================================

class ETABreakdownOut(BaseModel):
    origin: str
    destination: str
    corridor_code: Optional[str] = "COR-NH27"
    departure_time: datetime
    base_travel_time_hours: float
    base_eta: datetime
    traffic_delay_mins: int
    weather_delay_mins: int
    incident_delay_mins: int
    bridge_delay_mins: int
    total_estimated_delay_mins: int
    predicted_travel_time_hours: float
    predicted_eta: datetime
    primary_delay_reason: str # TRAFFIC, WEATHER, INCIDENT, BRIDGE, NORMAL
    delay_contributors: List[str]
    is_delay_alert_triggered: bool
    evaluated_at: datetime

class ETACalculationRequest(BaseModel):
    origin: str
    destination: str
    corridor_code: Optional[str] = None
    departure_time: Optional[datetime] = None
    vehicle_lat: Optional[float] = None
    vehicle_lng: Optional[float] = None
    vehicle_weight_tons: Optional[float] = 20.0

class DeliveryETAUpdateOut(BaseModel):
    delivery_id: int
    delivery_code: str
    cargo_name: str
    cargo_category: str
    vehicle_code: Optional[str] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    remaining_distance_km: float
    base_eta: datetime
    revised_eta: datetime
    estimated_delay_mins: int
    delay_reason: str
    delay_alert_active: bool
    status: str
    updated_at: datetime

# =========================================================================
# GAP 13: ESSENTIAL COMMODITY LIFECYCLE TRACKING SCHEMAS
# =========================================================================

class CommodityConsignmentCreateIn(BaseModel):
    cargo_name: str
    cargo_category: str = "Medicines" # Medicines, Food supplies, Construction materials, Agricultural produce
    cargo_type: str = "Essential Medical Supplies"
    priority: str = "URGENT" # EMERGENCY, URGENT, HIGH, NORMAL
    origin_city: str
    destination_city: str
    assigned_vehicle_id: Optional[int] = None
    driver_name: Optional[str] = None
    quantity_description: str = "500 vials / 20 insulated cartons"
    temperature_controlled: bool = True

class CommodityStatusUpdateIn(BaseModel):
    status: str # CREATED, ASSIGNED, LOADED, DISPATCHED, IN_TRANSIT, DELAYED_AT_RISK, ARRIVED, DELIVERED
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    location_note: Optional[str] = None

class CommodityDeliveryCompleteIn(BaseModel):
    received_by: str = "District Medical Officer / PDS Consignee"
    verification_pin: Optional[str] = "9942"
    completion_notes: Optional[str] = "Delivered intact with cold-chain sensor verification"

class CommodityCategorySummaryItem(BaseModel):
    category: str
    total_consignments: int
    in_transit_count: int
    delayed_count: int
    delivered_count: int
    average_delay_mins: float
    highest_priority_active: str

class EssentialCommoditiesOverviewOut(BaseModel):
    total_active_essential_deliveries: int
    medicines_count: int
    food_supplies_count: int
    construction_materials_count: int
    agricultural_produce_count: int
    categories_summary: List[CommodityCategorySummaryItem]
    generated_at: datetime


# =========================================================================
# VAHAN / ULIP VEHICLE INTELLIGENCE SCHEMAS (ULIP v6.0 Standard)
# =========================================================================

class VahanLookupRequest(BaseModel):
    vehicle_number: str = Field(..., alias="vehiclenumber", description="Vehicle registration plate e.g. UP91L0001 or AS01EC9921")

class VahanVehicleOut(BaseModel):
    registration_number: str
    state_code: Optional[str] = None
    rto_code: Optional[str] = None
    registered_at: Optional[str] = None
    vehicle_class: Optional[str] = None
    vehicle_category: Optional[str] = None
    maker_description: Optional[str] = None
    maker_model: Optional[str] = None
    body_type: Optional[str] = None
    fuel_description: Optional[str] = None
    color: Optional[str] = None
    norms_description: Optional[str] = None
    registration_date: Optional[str] = None
    registration_upto: Optional[str] = None
    fitness_upto: Optional[str] = None
    tax_upto: Optional[str] = None
    insurance_company: Optional[str] = None
    insurance_policy_no: Optional[str] = None
    insurance_upto: Optional[str] = None
    pucc_upto: Optional[str] = None
    pucc_no: Optional[str] = None
    gross_vehicle_weight_kg: Optional[float] = None
    gvw_tons: Optional[float] = None
    unladen_weight_kg: Optional[float] = None
    seating_capacity: Optional[int] = None
    cubic_capacity: Optional[float] = None
    wheelbase: Optional[float] = None
    standing_capacity: Optional[int] = None
    sleeper_capacity: Optional[int] = None
    vehicle_status: Optional[str] = "ACTIVE"
    blacklist_status: Optional[str] = None
    non_use_status: Optional[str] = None
    source: str = "VAHAN via ULIP"
    retrieved_at: datetime
    is_live: bool = True
    is_cached: bool = False

class VahanLookupResponse(BaseModel):
    success: bool
    source: str = "VAHAN via ULIP"
    status: str # SUCCESS, NOT_FOUND, AUTH_FAILED, VAHAN_NOT_CONFIGURED, SERVICE_UNAVAILABLE, INVALID_INPUT
    message: str
    data: Optional[VahanVehicleOut] = None

class VahanStatusOut(BaseModel):
    service: str = "VAHAN via ULIP"
    environment: str # staging, production
    base_url: str
    is_configured: bool
    has_credentials: bool
    has_static_token: bool
    token_status: str # AUTHENTICATED, EXPIRED, UNAUTHENTICATED, NOT_CONFIGURED
    token_expires_at: Optional[str] = None

class VahanSuitabilityRequest(BaseModel):
    vehicle_number: str
    corridor_code: Optional[str] = None
    bridge_code: Optional[str] = None
    cargo_weight_tons: Optional[float] = None

class VahanSuitabilityResponse(BaseModel):
    vehicle_number: str
    readiness_verdict: str # "Operationally suitable", "Needs verification", "Not recommended"
    suitability_score: float # 0 to 100
    explanations: List[str]
    vehicle_profile: Optional[VahanVehicleOut] = None
    bridge_evaluation: Optional[Dict[str, Any]] = None
    route_advisory: Optional[str] = None
    disclaimer: str = "Derived by LINK X8 operational intelligence layer. MoRTH VAHAN provides vehicle registry parameters only."
