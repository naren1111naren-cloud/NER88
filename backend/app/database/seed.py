import json
from datetime import datetime, timedelta
from app.database.database import engine, Base, SessionLocal
from app.models.models import User, Vehicle, Delivery, Incident, Alert, WeatherRecord, SystemSettings, AuditLog, Corridor, District, Bridge, TrafficRecord, RouteDecision
from app.core.security import get_password_hash
from app.services.routing_service import (
    PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS,
    ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS,
    PRIMARY_GUWAHATI_SHILLONG_WAYPOINTS,
    ALTERNATE_GUWAHATI_SHILLONG_WAYPOINTS
)
from app.services.accessibility_service import AccessibilityEngine

from sqlalchemy import text

def ensure_schema_migrations(engine):
    # Ensure all tables including RouteDecision are created
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        def get_existing_columns(table_name):
            try:
                res = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
                return {row[1] for row in res}
            except Exception:
                return set()

        def add_col_if_missing(table, col, col_type, default=None):
            cols = get_existing_columns(table)
            if col not in cols:
                try:
                    def_str = f" DEFAULT {default}" if default is not None else ""
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}{def_str}"))
                    conn.commit()
                except Exception as e:
                    print(f"Migration add column {table}.{col} warning: {e}")

        # Corridors
        add_col_if_missing("corridors", "accessibility_status", "VARCHAR", "'OPEN'")
        add_col_if_missing("corridors", "factor_summary", "VARCHAR", "'Normal road and bridge passage'")
        add_col_if_missing("corridors", "data_sources", "TEXT", "'[\"Open-Meteo Live API\", \"Field Officer Inspection Incident Feed\", \"BRO Bridge Clearance Registry\"]'")

        # Bridges
        add_col_if_missing("bridges", "connected_road", "VARCHAR")
        add_col_if_missing("bridges", "load_restriction_type", "VARCHAR", "'No Restriction'")
        add_col_if_missing("bridges", "is_verified", "BOOLEAN", "1")

        # Incidents
        add_col_if_missing("incidents", "affected_bridge_id", "INTEGER")
        add_col_if_missing("incidents", "affected_bridge_code", "VARCHAR")

        # Field reports
        add_col_if_missing("field_reports", "affected_bridge_id", "INTEGER")
        add_col_if_missing("field_reports", "affected_bridge_code", "VARCHAR")

        # Vehicles
        add_col_if_missing("vehicles", "device_id", "VARCHAR")
        add_col_if_missing("vehicles", "device_api_key", "VARCHAR")
        add_col_if_missing("vehicles", "odometer_km", "FLOAT", "12450.0")
        add_col_if_missing("vehicles", "ignition_status", "VARCHAR", "'ON'")
        add_col_if_missing("vehicles", "telemetry_health", "VARCHAR", "'LIVE'")
        add_col_if_missing("vehicles", "tracking_mode", "VARCHAR", "'SIMULATION'")
        add_col_if_missing("vehicles", "altitude_m", "FLOAT", "150.0")
        add_col_if_missing("vehicles", "battery_level_pct", "FLOAT", "98.0")
        add_col_if_missing("vehicles", "satellites_connected", "INTEGER", "12")
        add_col_if_missing("vehicles", "last_telemetry_at", "DATETIME")

        # Alerts
        add_col_if_missing("alerts", "status", "VARCHAR", "'NEW'")
        add_col_if_missing("alerts", "acknowledged_at", "DATETIME")
        add_col_if_missing("alerts", "acknowledged_by", "VARCHAR")
        add_col_if_missing("alerts", "source_incident_id", "INTEGER")
        add_col_if_missing("alerts", "corridor_code", "VARCHAR")
        add_col_if_missing("alerts", "district_name", "VARCHAR")
        add_col_if_missing("alerts", "recommended_action", "TEXT")
        add_col_if_missing("alerts", "resolved_at", "DATETIME")

        # Deliveries
        add_col_if_missing("deliveries", "delay_reason", "VARCHAR", "'Normal Transit Clearance'")
        add_col_if_missing("deliveries", "quantity_description", "VARCHAR", "'Standard Pallet Load (500 units)'")
        add_col_if_missing("deliveries", "temperature_controlled", "BOOLEAN", "0")
        add_col_if_missing("deliveries", "completed_at", "DATETIME")
        add_col_if_missing("deliveries", "actual_delivery_duration_hours", "FLOAT")

def seed_traffic_data(db):
    if db.query(TrafficRecord).count() > 0:
        return
    traffic_seeds = [
        TrafficRecord(
            corridor_code="COR-NH27",
            segment_name="Guwahati - Nagaon Four-Lane Expressway",
            congestion_level="LOW",
            congestion_index=0.20,
            average_speed_kmh=55.0,
            free_flow_speed_kmh=65.0,
            traffic_delay_mins=10,
            travel_time_multiplier=1.15,
            data_source="SIMULATED_HIGHWAY_SENSORS",
            is_live=False
        ),
        TrafficRecord(
            corridor_code="COR-NH27",
            segment_name="Dimapur - Kohima - Senapati Mountain Pass",
            congestion_level="MODERATE",
            congestion_index=0.45,
            average_speed_kmh=32.0,
            free_flow_speed_kmh=50.0,
            traffic_delay_mins=35,
            travel_time_multiplier=1.35,
            data_source="SIMULATED_HIGHWAY_SENSORS",
            is_live=False
        ),
        TrafficRecord(
            corridor_code="COR-NH37",
            segment_name="Silchar - Jiribam - Noney Sector (NH37)",
            congestion_level="LOW",
            congestion_index=0.25,
            average_speed_kmh=42.0,
            free_flow_speed_kmh=50.0,
            traffic_delay_mins=15,
            travel_time_multiplier=1.20,
            data_source="SIMULATED_HIGHWAY_SENSORS",
            is_live=False
        ),
        TrafficRecord(
            corridor_code="COR-NH40",
            segment_name="Guwahati - Shillong GS Road Corridor",
            congestion_level="HIGH",
            congestion_index=0.65,
            average_speed_kmh=25.0,
            free_flow_speed_kmh=55.0,
            traffic_delay_mins=45,
            travel_time_multiplier=1.60,
            data_source="SIMULATED_HIGHWAY_SENSORS",
            is_live=False
        ),
        TrafficRecord(
            corridor_code="COR-NH10",
            segment_name="Siliguri - Teesta - Gangtok Hill Pass",
            congestion_level="MODERATE",
            congestion_index=0.40,
            average_speed_kmh=30.0,
            free_flow_speed_kmh=45.0,
            traffic_delay_mins=25,
            travel_time_multiplier=1.30,
            data_source="SIMULATED_HIGHWAY_SENSORS",
            is_live=False
        )
    ]
    db.add_all(traffic_seeds)
    db.commit()

def seed_master_scenario_data(db):
    """
    Ensures master SIH demonstration entities exist:
    - Vehicle V-102 (Cold-Chain Medical Carrier, Driver: Anil Das, Guwahati -> Shillong)
    - Delivery MED-102 (Essential Life-Saving Medicines & Pediatric Vaccines)
    """
    now = datetime.utcnow()
    v102 = db.query(Vehicle).filter(Vehicle.vehicle_code == "V-102").first()
    if not v102:
        v102 = Vehicle(
            vehicle_code="V-102",
            driver_name="Anil Das",
            driver_phone="+91 98765 88102",
            vehicle_type="Cold-Chain Medical Carrier (8T)",
            status="IN_TRANSIT",
            current_lat=26.1050,  # Jorabat Gateway on GS Road
            current_lng=91.8200,
            destination_city="Shillong",
            risk_level="LOW",
            speed_kmh=45.0,
            heading_deg=165.0,
            odometer_km=8420.0,
            ignition_status="ON",
            connectivity_status="ONLINE",
            telemetry_health="LIVE",
            tracking_mode="SIMULATION",
            altitude_m=220.0,
            battery_level_pct=96.0,
            satellites_connected=14,
            telemetry_source="SIMULATED GPS TELEMETRY",
            last_telemetry_at=now
        )
        db.add(v102)
        db.commit()
        db.refresh(v102)

    med102 = db.query(Delivery).filter(Delivery.delivery_code == "MED-102").first()
    if not med102:
        med102 = Delivery(
            delivery_code="MED-102",
            cargo_name="Essential Life-Saving Medicines & Pediatric Vaccines",
            cargo_type="Cold-Chain Medical Consignment",
            cargo_category="Medicines",
            priority="EMERGENCY",
            origin_city="Guwahati",
            destination_city="Shillong",
            assigned_vehicle_id=v102.id,
            driver_name="Anil Das",
            status="IN_TRANSIT",
            original_eta=now + timedelta(hours=2.5),
            revised_eta=now + timedelta(hours=2.5),
            estimated_delay_mins=0,
            delay_reason="Normal Mountain Transit Clearance",
            route_risk_score=14.0,
            route_risk_category="LOW",
            quantity_description="24 Cryogenic Insulated Vaccine Containers (1,200 doses)",
            temperature_controlled=True,
            active_route_path=json.dumps(PRIMARY_GUWAHATI_SHILLONG_WAYPOINTS),
            alternate_route_path=json.dumps(ALTERNATE_GUWAHATI_SHILLONG_WAYPOINTS),
            created_at=now - timedelta(minutes=45)
        )
        db.add(med102)
        db.commit()

def seed_database():
    Base.metadata.create_all(bind=engine)
    ensure_schema_migrations(engine)
    db = SessionLocal()

    # Reset tables if needed or check if admin user exists
    if db.query(User).filter(User.email.in_(["admin@linkx8.in", "admin@nerlogiai.in"])).first():
        # Upgrade any legacy sha256 hashes to bcrypt
        demo_passwords = {
            "admin@linkx8.in": "Admin@123",
            "dispatcher@linkx8.in": "Dispatch@123",
            "field@linkx8.in": "Field@123",
            "viewer@linkx8.in": "Viewer@123",
            "admin@nerlogiai.in": "Admin@123",
            "dispatcher@nerlogiai.in": "Dispatch@123",
            "field@nerlogiai.in": "Field@123",
            "viewer@nerlogiai.in": "Viewer@123",
        }
        for u in db.query(User).all():
            if u.hashed_password and not (u.hashed_password.startswith("$2b$") or u.hashed_password.startswith("$2a$")):
                raw_pwd = demo_passwords.get(u.email, "Admin@123")
                u.hashed_password = get_password_hash(raw_pwd)
        db.commit()

        if db.query(Bridge).count() == 0:
            seed_bridges_data(db)
        if db.query(TrafficRecord).count() == 0:
            seed_traffic_data(db)
        seed_corridors_data(db)
        seed_master_scenario_data(db)
        AccessibilityEngine.recalculate_all_accessibility(db)
        print("Database already seeded.")
        db.close()
        return

    print("Seeding database with default LINK X8 regional logistics records...")

    # 1. Users
    users = [
        User(email="admin@linkx8.in", full_name="System Administrator (MDoNER)", hashed_password=get_password_hash("Admin@123"), role="Admin"),
        User(email="dispatcher@linkx8.in", full_name="Logistics Dispatch Officer", hashed_password=get_password_hash("Dispatch@123"), role="Dispatcher"),
        User(email="field@linkx8.in", full_name="Senior Field Inspector", hashed_password=get_password_hash("Field@123"), role="Field Officer"),
        User(email="viewer@linkx8.in", full_name="Public Logistics Observer", hashed_password=get_password_hash("Viewer@123"), role="Viewer"),
        User(email="admin@nerlogiai.in", full_name="System Administrator (Legacy)", hashed_password=get_password_hash("Admin@123"), role="Admin"),
        User(email="dispatcher@nerlogiai.in", full_name="Logistics Dispatch Officer (Legacy)", hashed_password=get_password_hash("Dispatch@123"), role="Dispatcher"),
        User(email="field@nerlogiai.in", full_name="Senior Field Inspector (Legacy)", hashed_password=get_password_hash("Field@123"), role="Field Officer"),
        User(email="viewer@nerlogiai.in", full_name="Public Logistics Observer (Legacy)", hashed_password=get_password_hash("Viewer@123"), role="Viewer")
    ]
    db.add_all(users)
    db.commit()

    # 2. Corridors across 8 NER States
    corridors = [
        Corridor(
            corridor_code="COR-NH27",
            name="NH27 Guwahati - Kohima - Imphal Transport Corridor",
            origin="Guwahati",
            destination="Imphal",
            states_covered="Assam, Nagaland, Manipur",
            status="OPEN",
            risk_level="LOW",
            current_condition="Normal traffic flow along NH27/NH2 pass",
            weather_condition="Light Rain in Kohima sector",
            estimated_delay_mins=0,
            incident_count=0,
            polyline_coords=json.dumps(PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS)
        ),
        Corridor(
            corridor_code="COR-NH37",
            name="NH37 Western Bypass (Silchar - Jiribam - Imphal Corridor)",
            origin="Silchar",
            destination="Imphal",
            states_covered="Assam, Manipur",
            status="PASSABLE",
            risk_level="MEDIUM",
            current_condition="Heavy monsoon rain; road passable with caution",
            weather_condition="Moderate Rain",
            estimated_delay_mins=35,
            incident_count=0,
            polyline_coords=json.dumps(ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS)
        ),
        Corridor(
            corridor_code="COR-NH40",
            name="NH40 Guwahati - Shillong Expressway",
            origin="Guwahati",
            destination="Shillong",
            states_covered="Assam, Meghalaya",
            status="OPEN",
            risk_level="LOW",
            current_condition="Clear mountain highway traffic",
            weather_condition="Fog & Drizzle",
            estimated_delay_mins=10,
            incident_count=0
        ),
        Corridor(
            corridor_code="COR-NH44",
            name="NH44 Shillong - Silchar - Agartala Logistics Highway",
            origin="Shillong",
            destination="Agartala",
            states_covered="Meghalaya, Assam, Tripura",
            status="OPEN",
            risk_level="LOW",
            current_condition="Smooth transport movement",
            weather_condition="Partly Cloudy",
            estimated_delay_mins=0,
            incident_count=0
        ),
        Corridor(
            corridor_code="COR-NH54",
            name="NH54 Silchar - Aizawl Supply Corridor",
            origin="Silchar",
            destination="Aizawl",
            states_covered="Assam, Mizoram",
            status="PARTIAL",
            risk_level="MEDIUM",
            current_condition="Monsoon mudslides near Vairengte sector",
            weather_condition="Heavy Downpour",
            estimated_delay_mins=45,
            incident_count=1
        ),
        Corridor(
            corridor_code="COR-NH415",
            name="NH415 Banderdewa - Itanagar Arterial Highway",
            origin="Banderdewa",
            destination="Itanagar",
            states_covered="Assam, Arunachal Pradesh",
            status="OPEN",
            risk_level="LOW",
            current_condition="Operational hill route",
            weather_condition="Light Rain",
            estimated_delay_mins=15,
            incident_count=0
        ),
        Corridor(
            corridor_code="COR-NH10",
            name="NH10 Siliguri - Gangtok Himalayan Highway",
            origin="Siliguri",
            destination="Gangtok",
            states_covered="West Bengal, Sikkim",
            status="PARTIAL",
            risk_level="HIGH",
            current_condition="Teesta Valley landslide vulnerability zone",
            weather_condition="Torrential Rain",
            estimated_delay_mins=60,
            incident_count=1
        )
    ]
    db.add_all(corridors)
    db.commit()

    # 3. Districts across 8 NER States
    districts = [
        District(name="Kamrup Metropolitan", state="Assam", accessibility_index=96.5, status="Highly Accessible (90+)", active_incidents_count=0, critical_supply_status="STABLE"),
        District(name="East Khasi Hills", state="Meghalaya", accessibility_index=88.0, status="Good (75-89)", active_incidents_count=0, critical_supply_status="STABLE"),
        District(name="Cachar", state="Assam", accessibility_index=84.5, status="Good (75-89)", active_incidents_count=0, critical_supply_status="STABLE"),
        District(name="Kohima", state="Nagaland", accessibility_index=72.0, status="Moderate (50-74)", active_incidents_count=0, critical_supply_status="STABLE"),
        District(name="Senapati", state="Manipur", accessibility_index=82.0, status="Good (75-89)", active_incidents_count=0, critical_supply_status="STABLE"),
        District(name="Imphal West", state="Manipur", accessibility_index=80.0, status="Good (75-89)", active_incidents_count=0, critical_supply_status="STABLE"),
        District(name="Papum Pare", state="Arunachal Pradesh", accessibility_index=78.0, status="Good (75-89)", active_incidents_count=0, critical_supply_status="STABLE"),
        District(name="Aizawl", state="Mizoram", accessibility_index=75.0, status="Good (75-89)", active_incidents_count=0, critical_supply_status="STABLE"),
        District(name="West Tripura", state="Tripura", accessibility_index=91.0, status="Highly Accessible (90+)", active_incidents_count=0, critical_supply_status="STABLE"),
        District(name="East Sikkim", state="Sikkim", accessibility_index=70.0, status="Moderate (50-74)", active_incidents_count=1, critical_supply_status="AT_RISK")
    ]
    db.add_all(districts)
    db.commit()

    # 4. Vehicles
    vehicles = [
        Vehicle(
            vehicle_code="NER-V001",
            driver_name="Ramesh Sharma",
            driver_phone="+91 98765 43210",
            vehicle_type="Cold-Chain Refrigerated Truck (10T)",
            status="IN_TRANSIT",
            current_lat=25.9060, # Dimapur / Kohima highway segment
            current_lng=93.7273,
            destination_city="Imphal",
            risk_level="LOW",
            speed_kmh=42.0,
            heading_deg=135.0,
            connectivity_status="ONLINE",
            telemetry_source="SIMULATED GPS TELEMETRY"
        ),
        Vehicle(
            vehicle_code="NER-V002",
            driver_name="Bikram Gogoi",
            driver_phone="+91 98765 11223",
            vehicle_type="Heavy Relief Goods Carrier (15T)",
            status="IN_TRANSIT",
            current_lat=25.5788,
            current_lng=91.8933,
            destination_city="Silchar",
            risk_level="LOW",
            speed_kmh=48.0,
            heading_deg=90.0,
            connectivity_status="ONLINE",
            telemetry_source="SIMULATED GPS TELEMETRY"
        ),
        Vehicle(
            vehicle_code="NER-V003",
            driver_name="Tenzing Lepcha",
            driver_phone="+91 98765 99887",
            vehicle_type="Container Cargo (20T)",
            status="IDLE",
            current_lat=26.1445,
            current_lng=91.7362,
            destination_city="Guwahati",
            risk_level="LOW",
            speed_kmh=0.0,
            heading_deg=0.0,
            connectivity_status="ONLINE",
            telemetry_source="SIMULATED GPS TELEMETRY"
        ),
        Vehicle(
            vehicle_code="NER-V004",
            driver_name="Lalthangliana Sailo",
            driver_phone="+91 98765 55443",
            vehicle_type="Emergency Oxygen Tanker (8T)",
            status="IN_TRANSIT",
            current_lat=24.8333,
            current_lng=92.7789,
            destination_city="Aizawl",
            risk_level="MEDIUM",
            speed_kmh=36.0,
            heading_deg=180.0,
            connectivity_status="ONLINE",
            telemetry_source="SIMULATED GPS TELEMETRY"
        )
    ]
    db.add_all(vehicles)
    db.commit()

    # 5. Deliveries
    v1 = db.query(Vehicle).filter(Vehicle.vehicle_code == "NER-V001").first()
    v2 = db.query(Vehicle).filter(Vehicle.vehicle_code == "NER-V002").first()
    v4 = db.query(Vehicle).filter(Vehicle.vehicle_code == "NER-V004").first()

    now = datetime.utcnow()
    deliveries = [
        Delivery(
            delivery_code="DEL-2026-001",
            cargo_name="Critical Vaccines & Essential Medicines",
            cargo_type="Medical Supplies",
            cargo_category="Medicines",
            priority="EMERGENCY",
            origin_city="Guwahati",
            destination_city="Imphal",
            assigned_vehicle_id=v1.id if v1 else None,
            driver_name="Ramesh Sharma",
            status="IN_TRANSIT",
            original_eta=now + timedelta(hours=11),
            revised_eta=now + timedelta(hours=11),
            estimated_delay_mins=0,
            route_risk_score=18.0,
            route_risk_category="LOW",
            active_route_path=json.dumps(PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS),
            alternate_route_path=json.dumps(ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS)
        ),
        Delivery(
            delivery_code="DEL-2026-002",
            cargo_name="Disaster Relief Ration Packs",
            cargo_type="Food & Relief",
            cargo_category="Food supplies",
            priority="URGENT",
            origin_city="Guwahati",
            destination_city="Silchar",
            assigned_vehicle_id=v2.id if v2 else None,
            driver_name="Bikram Gogoi",
            status="IN_TRANSIT",
            original_eta=now + timedelta(hours=7),
            revised_eta=now + timedelta(hours=7),
            estimated_delay_mins=0,
            route_risk_score=22.5,
            route_risk_category="LOW",
            active_route_path=json.dumps([
                [26.1445, 91.7362], [25.5788, 91.8933], [24.8333, 92.7789]
            ])
        ),
        Delivery(
            delivery_code="DEL-2026-003",
            cargo_name="Medical Liquid Oxygen Cylinders",
            cargo_type="Oxygen Supplies",
            cargo_category="Oxygen",
            priority="EMERGENCY",
            origin_city="Silchar",
            destination_city="Aizawl",
            assigned_vehicle_id=v4.id if v4 else None,
            driver_name="Lalthangliana Sailo",
            status="IN_TRANSIT",
            original_eta=now + timedelta(hours=5),
            revised_eta=now + timedelta(hours=5, minutes=45),
            estimated_delay_mins=45,
            route_risk_score=54.0,
            route_risk_category="HIGH",
            active_route_path=json.dumps([
                [24.8333, 92.7789], [24.2000, 92.7500], [23.7271, 92.7176]
            ])
        )
    ]
    db.add_all(deliveries)
    db.commit()

    # 6. Weather Records across 10 Cities
    weather_records = [
        WeatherRecord(location_name="Guwahati", state="Assam", temperature_c=28.5, rainfall_mm_hr=12.0, condition="Partly Cloudy", wind_kmh=14.0),
        WeatherRecord(location_name="Shillong", state="Meghalaya", temperature_c=19.2, rainfall_mm_hr=42.0, condition="Heavy Rain & Mist", wind_kmh=22.0),
        WeatherRecord(location_name="Silchar", state="Assam", temperature_c=26.0, rainfall_mm_hr=28.0, condition="Moderate Rain", wind_kmh=16.0),
        WeatherRecord(location_name="Imphal", state="Manipur", temperature_c=23.4, rainfall_mm_hr=68.0, condition="Torrential Monsoon Downpour", wind_kmh=26.0),
        WeatherRecord(location_name="Kohima", state="Nagaland", temperature_c=20.1, rainfall_mm_hr=48.0, condition="Heavy Rain", wind_kmh=20.0),
        WeatherRecord(location_name="Gangtok", state="Sikkim", temperature_c=16.5, rainfall_mm_hr=55.0, condition="Heavy Rain", wind_kmh=18.0),
        WeatherRecord(location_name="Aizawl", state="Mizoram", temperature_c=22.0, rainfall_mm_hr=40.0, condition="Moderate Rain", wind_kmh=15.0),
        WeatherRecord(location_name="Agartala", state="Tripura", temperature_c=30.0, rainfall_mm_hr=10.0, condition="Clear", wind_kmh=12.0),
        WeatherRecord(location_name="Itanagar", state="Arunachal Pradesh", temperature_c=24.5, rainfall_mm_hr=35.0, condition="Moderate Rain", wind_kmh=14.0),
        WeatherRecord(location_name="Dimapur", state="Nagaland", temperature_c=27.2, rainfall_mm_hr=20.0, condition="Light Rain", wind_kmh=16.0)
    ]
    db.add_all(weather_records)

    # 7. System Settings
    settings = [
        SystemSettings(setting_key="RISK_THRESHOLD_LOW", setting_value="24", description="LOW risk 0-24"),
        SystemSettings(setting_key="RISK_THRESHOLD_MEDIUM", setting_value="49", description="MEDIUM risk 25-49"),
        SystemSettings(setting_key="RISK_THRESHOLD_HIGH", setting_value="74", description="HIGH risk 50-74"),
        SystemSettings(setting_key="RISK_THRESHOLD_CRITICAL", setting_value="100", description="CRITICAL risk 75-100"),
        SystemSettings(setting_key="EMERGENCY_OPERATIONS_MODE", setting_value="false", description="System-wide Emergency Operations Mode flag"),
        SystemSettings(setting_key="DEMO_MODE", setting_value="true", description="Flag indicating active SIH Demo Mode")
    ]
    db.add_all(settings)

    # 8. Bridges across NER Transport Corridors
    seed_bridges_data(db)

    # 9. Audit Log
    db.add(AuditLog(user_email="system@linkx8.in", action="SYSTEM_INIT", resource="Database", details="Initial database seed executed successfully with full 8-state NER corridor and bridge intelligence."))

    db.commit()

    # 10. Initial Regional Cascade Accessibility Recalculation
    AccessibilityEngine.recalculate_all_accessibility(db)

    print("Database seeding completed.")
    db.close()

def seed_bridges_data(db):
    bridges = [
        Bridge(
            bridge_code="BRG-NH27-01",
            name="Saraighat Brahmaputra River Bridge",
            river_name="Brahmaputra River",
            latitude=26.1764,
            longitude=91.6811,
            connected_road="NH27",
            corridor_code="COR-NH27",
            district_name="Kamrup Metropolitan",
            state="Assam",
            status="OPERATIONAL",
            condition_description="Double-decker road-rail bridge clear and operational",
            load_capacity_tons=50.0,
            load_restriction_type="No Restriction",
            accessibility_score=98.0,
            risk_level="LOW",
            is_verified=True,
            data_source="FIELD_INSPECTION_RECORD",
            data_confidence="HIGH"
        ),
        Bridge(
            bridge_code="BRG-NH37-01",
            name="Irang River Bailey Bridge",
            river_name="Irang River",
            latitude=24.8100,
            longitude=93.4500,
            connected_road="NH37",
            corridor_code="COR-NH37",
            district_name="Imphal West",
            state="Manipur",
            status="OPERATIONAL",
            condition_description="Single-span steel bridge on Silchar-Imphal arterial corridor",
            load_capacity_tons=35.0,
            load_restriction_type="Reduced Load (Max 20T)",
            accessibility_score=88.0,
            risk_level="MEDIUM",
            is_verified=True,
            data_source="FIELD_INSPECTION_RECORD",
            data_confidence="HIGH"
        ),
        Bridge(
            bridge_code="BRG-NH37-02",
            name="Barak River Suspension Bridge",
            river_name="Barak River",
            latitude=24.8333,
            longitude=92.7789,
            connected_road="NH37",
            corridor_code="COR-NH37",
            district_name="Cachar",
            state="Assam",
            status="OPERATIONAL",
            condition_description="All lanes open for heavy relief cargo",
            load_capacity_tons=40.0,
            load_restriction_type="No Restriction",
            accessibility_score=92.0,
            risk_level="LOW",
            is_verified=True,
            data_source="FIELD_INSPECTION_RECORD",
            data_confidence="HIGH"
        ),
        Bridge(
            bridge_code="BRG-NH10-01",
            name="Teesta River High-Altitude Bridge",
            river_name="Teesta River",
            latitude=27.2500,
            longitude=88.5000,
            connected_road="NH10",
            corridor_code="COR-NH10",
            district_name="East Sikkim",
            state="Sikkim",
            status="RESTRICTED",
            condition_description="Monsoon river surge warning; 20T load restriction enforced",
            load_capacity_tons=20.0,
            load_restriction_type="Heavy Vehicles Restricted",
            accessibility_score=65.0,
            risk_level="HIGH",
            restriction_details="Max load limit 20T, single-lane alternating passage",
            is_verified=True,
            data_source="FIELD_INSPECTION_RECORD",
            data_confidence="HIGH"
        ),
        Bridge(
            bridge_code="BRG-NH54-01",
            name="Dhaleswari River Transit Bridge",
            river_name="Dhaleswari River",
            latitude=23.9500,
            longitude=92.7000,
            connected_road="NH54",
            corridor_code="COR-NH54",
            district_name="Aizawl",
            state="Mizoram",
            status="OPERATIONAL",
            condition_description="Operational mountain gorge crossing",
            load_capacity_tons=30.0,
            load_restriction_type="No Restriction",
            accessibility_score=85.0,
            risk_level="MEDIUM",
            is_verified=True,
            data_source="FIELD_INSPECTION_RECORD",
            data_confidence="HIGH"
        ),
        Bridge(
            bridge_code="BRG-NH415-01",
            name="Dikrong River Bridge",
            river_name="Dikrong River",
            latitude=27.0800,
            longitude=93.6200,
            connected_road="NH415",
            corridor_code="COR-NH415",
            district_name="Papum Pare",
            state="Arunachal Pradesh",
            status="OPERATIONAL",
            condition_description="Clear traffic passage into Itanagar capital complex",
            load_capacity_tons=45.0,
            load_restriction_type="No Restriction",
            accessibility_score=94.0,
            risk_level="LOW",
            is_verified=True,
            data_source="FIELD_INSPECTION_RECORD",
            data_confidence="HIGH"
        ),
        Bridge(
            bridge_code="BRG-NH27-02",
            name="Dhansiri River Bridge",
            river_name="Dhansiri River",
            latitude=25.9060,
            longitude=93.7273,
            connected_road="NH27",
            corridor_code="COR-NH27",
            district_name="Kohima",
            state="Nagaland",
            status="OPERATIONAL",
            condition_description="Dimapur-Kohima pass access bridge in good condition",
            load_capacity_tons=45.0,
            load_restriction_type="No Restriction",
            accessibility_score=90.0,
            risk_level="LOW",
            is_verified=True,
            data_source="FIELD_INSPECTION_RECORD",
            data_confidence="HIGH"
        ),
        Bridge(
            bridge_code="BRG-NH44-01",
            name="Howrah River Bridge",
            river_name="Howrah River",
            latitude=23.8315,
            longitude=91.2868,
            connected_road="NH44",
            corridor_code="COR-NH44",
            district_name="West Tripura",
            state="Tripura",
            status="OPERATIONAL",
            condition_description="Smooth transport movement into Agartala",
            load_capacity_tons=50.0,
            load_restriction_type="No Restriction",
            accessibility_score=96.0,
            risk_level="LOW",
            is_verified=True,
            data_source="FIELD_INSPECTION_RECORD",
            data_confidence="HIGH"
        )
    ]
    db.add_all(bridges)
    db.commit()

    seed_corridors_data(db)
    seed_master_scenario_data(db)
    AccessibilityEngine.recalculate_all_accessibility(db)
    print("Database initial seeding completed successfully.")
    db.close()

def seed_corridors_data(db):
    corridor_seeds = [
        {
            "corridor_code": "COR-NH27",
            "name": "NH-27 East-West National Expressway & Highway",
            "origin": "Siliguri",
            "destination": "Dimapur",
            "states_covered": "West Bengal, Assam, Nagaland",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "4-Lane Divided Expressway with normal flow",
            "weather_condition": "Clear / Partly Cloudy",
            "estimated_delay_mins": 0,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "NHAI Highway ATMS", "BRO Bridge Clearance Registry"]),
            "factor_summary": "Optimal 4-lane cruising conditions",
            "polyline_coords": json.dumps([
                [26.7271, 88.3953], [26.5400, 88.7200], [26.3300, 89.4500], [26.4700, 89.9800],
                [26.4800, 90.2700], [26.5000, 90.5400], [26.2000, 90.5700], [26.1500, 91.2000],
                [26.1445, 91.7362], [26.1600, 92.0000], [26.1800, 92.4000], [26.1500, 92.7000],
                [25.8800, 93.1800], [25.9090, 93.7266]
            ])
        },
        {
            "corridor_code": "COR-NH37",
            "name": "NH-37 Brahmaputra Valley & Southern Arterial",
            "origin": "Goalpara",
            "destination": "Dibrugarh",
            "states_covered": "Assam",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "Smooth trunk road passage through Brahmaputra valley",
            "weather_condition": "Moderate Overcast",
            "estimated_delay_mins": 10,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "Assam PWD Road Telemetry", "NHIDCL Monitored Sensor"]),
            "factor_summary": "Normal road and bridge passage",
            "polyline_coords": json.dumps([
                [26.1700, 90.6200], [26.1445, 91.7362], [26.5800, 92.9500], [26.6000, 93.3000],
                [26.5500, 93.7500], [26.7500, 94.2200], [26.9800, 94.6400], [27.4728, 94.9120],
                [27.5000, 95.3500], [27.7950, 95.6620]
            ])
        },
        {
            "corridor_code": "COR-NH37-EXT",
            "name": "NH-37 Silchar - Jiribam - Imphal Lifeline Highway",
            "origin": "Silchar",
            "destination": "Imphal",
            "states_covered": "Assam, Manipur",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "Operational heavy logistics bypass via Jiribam and Noney",
            "weather_condition": "Light Showers",
            "estimated_delay_mins": 15,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "BRO Project Udayak", "Field Officer Inspection Incident Feed"]),
            "factor_summary": "Operational Western mountain bypass",
            "polyline_coords": json.dumps([
                [24.8333, 92.7789], [24.8012, 93.1250], [24.7800, 93.3500], [24.8500, 93.5000],
                [24.8700, 93.7200], [24.8170, 93.9368]
            ])
        },
        {
            "corridor_code": "COR-NH2",
            "name": "NH-2 / AH-1 Asian Highway Trunk (Dibrugarh - Dimapur - Kohima - Imphal)",
            "origin": "Dibrugarh",
            "destination": "Imphal",
            "states_covered": "Assam, Nagaland, Manipur",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "Asian Highway corridor operational through Kohima pass",
            "weather_condition": "Intermittent Mist",
            "estimated_delay_mins": 20,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "NHIDCL Mountain Highway Feed", "State Disaster Authority"]),
            "factor_summary": "Standard transit profile with mountain monitoring",
            "polyline_coords": json.dumps([
                [27.4728, 94.9120], [26.9800, 94.6400], [26.7000, 94.2000], [25.9090, 93.7266],
                [25.7900, 93.9500], [25.6751, 94.1086], [25.4500, 94.0800], [25.2000, 94.0200],
                [25.0500, 93.9800], [24.8170, 93.9368]
            ])
        },
        {
            "corridor_code": "COR-NH10",
            "name": "NH-10 Himalayan Mountain Lifeline (Siliguri - Gangtok)",
            "origin": "Siliguri",
            "destination": "Gangtok",
            "states_covered": "West Bengal, Sikkim",
            "status": "RESTRICTED",
            "accessibility_status": "RESTRICTED",
            "risk_level": "HIGH",
            "current_condition": "Teesta River gorge section under active slope alert; 20T load limit",
            "weather_condition": "Heavy Mountain Rain",
            "estimated_delay_mins": 55,
            "incident_count": 1,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "BRO Project Swastik", "Field Officer Inspection Incident Feed"]),
            "factor_summary": "Heavy rain + Teesta gorge load restriction",
            "polyline_coords": json.dumps([
                [26.7271, 88.3953], [26.8800, 88.4700], [26.9500, 88.4400], [27.0500, 88.4700],
                [27.1700, 88.5200], [27.2400, 88.5800], [27.3000, 88.6000], [27.3389, 88.6138]
            ])
        },
        {
            "corridor_code": "COR-NH40",
            "name": "NH-6 / NH-40 Trans-Meghalaya & Barak Valley Corridor",
            "origin": "Guwahati",
            "destination": "Silchar",
            "states_covered": "Assam, Meghalaya",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "4-Lane Expressway to Shillong with 2-lane link to Jowai",
            "weather_condition": "Clear / Moderate Mist",
            "estimated_delay_mins": 10,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "NHAI 4-Lane ATMS", "Meghalaya PWD"]),
            "factor_summary": "Normal road and bridge passage",
            "polyline_coords": json.dumps([
                [26.0825, 91.8682], [25.9034, 91.8796], [25.7516, 91.8950], [25.6631, 91.9022],
                [25.5788, 91.8933], [25.4400, 92.2000], [25.2600, 92.3700], [25.1000, 92.4800],
                [24.8333, 92.7789]
            ])
        },
        {
            "corridor_code": "COR-NH8",
            "name": "NH-8 Southern Tripura National Arterial (Karimganj - Agartala - Sabroom)",
            "origin": "Karimganj",
            "destination": "Sabroom",
            "states_covered": "Assam, Tripura",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "Smooth inter-state logistics flow into Agartala and Maitri Setu",
            "weather_condition": "Partly Cloudy",
            "estimated_delay_mins": 0,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "Tripura Transport Department", "NHIDCL"]),
            "factor_summary": "Unrestricted arterial transit",
            "polyline_coords": json.dumps([
                [24.8700, 92.3500], [24.5200, 92.2300], [24.3800, 92.1600], [24.1800, 92.0100],
                [23.8400, 91.6000], [23.8315, 91.2868], [23.5400, 91.4500], [23.2200, 91.5000],
                [23.0030, 91.7050]
            ])
        },
        {
            "corridor_code": "COR-NH13",
            "name": "NH-13 Trans-Arunachal Strategic Highway",
            "origin": "Tawang",
            "destination": "Tezu",
            "states_covered": "Arunachal Pradesh",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "Sela Tunnel pass and foothills sectors open to all traffic",
            "weather_condition": "Alpine Fog",
            "estimated_delay_mins": 25,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "BRO Project Arunank", "Arunachal Police Traffic Feed"]),
            "factor_summary": "All-weather high mountain clearance",
            "polyline_coords": json.dumps([
                [27.5860, 91.8590], [27.5000, 92.1000], [27.2600, 92.4200], [27.0844, 93.6053],
                [27.3500, 94.1000], [28.0600, 95.3200], [28.1500, 95.8300], [27.9100, 96.1600],
                [27.7700, 96.3500]
            ])
        },
        {
            "corridor_code": "COR-NH15",
            "name": "NH-15 Brahmaputra North Bank Strategic Highway",
            "origin": "Baihata Chariali",
            "destination": "Jonai",
            "states_covered": "Assam, Arunachal Pradesh",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "Multi-lane paved highway across northern Brahmaputra plain",
            "weather_condition": "Clear",
            "estimated_delay_mins": 0,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "NHAI North Bank ATMS"]),
            "factor_summary": "Optimal transit clearance",
            "polyline_coords": json.dumps([
                [26.3500, 91.7100], [26.4300, 92.0300], [26.7000, 92.8000], [26.8500, 93.6000],
                [27.2300, 94.1000], [27.3980, 94.8250], [27.4800, 94.5800], [27.7900, 95.2000]
            ])
        },
        {
            "corridor_code": "COR-NH102",
            "name": "NH-102 Asian Highway (Imphal - Moreh International Border)",
            "origin": "Imphal",
            "destination": "Moreh",
            "states_covered": "Manipur",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "International trilateral link fully accessible for freight movement",
            "weather_condition": "Sunny",
            "estimated_delay_mins": 0,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "NHIDCL Trilateral Link Monitor"]),
            "factor_summary": "Border ICP transport clearance normal",
            "polyline_coords": json.dumps([
                [24.8170, 93.9368], [24.6300, 93.9900], [24.4800, 93.9800], [24.4500, 94.0200],
                [24.3800, 94.1500], [24.2400, 94.3000]
            ])
        },
        {
            "corridor_code": "COR-NH29",
            "name": "NH-29 Dimapur - Kohima High-Speed Mountain Expressway",
            "origin": "Dimapur",
            "destination": "Kohima",
            "states_covered": "Nagaland",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "4-Lane mountain expressway with structural slope stabilization",
            "weather_condition": "Light Overcast",
            "estimated_delay_mins": 5,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "NHIDCL Nagaland Smart Toll", "Field Officer Inspection Incident Feed"]),
            "factor_summary": "4-Lane high-speed mountain transit clear",
            "polyline_coords": json.dumps([
                [25.9090, 93.7266], [25.8500, 93.8200], [25.7500, 93.9500], [25.7000, 94.0200],
                [25.6751, 94.1086]
            ])
        },
        {
            "corridor_code": "COR-NH54",
            "name": "NH-54 / NH-306 Central Mizoram Spine (Silchar - Aizawl - Lunglei)",
            "origin": "Silchar",
            "destination": "Lunglei",
            "states_covered": "Assam, Mizoram",
            "status": "RESTRICTED",
            "accessibility_status": "RESTRICTED",
            "risk_level": "MEDIUM",
            "current_condition": "Monsoon mudslides near Vairengte sector; slow transit",
            "weather_condition": "Heavy Rain",
            "estimated_delay_mins": 45,
            "incident_count": 1,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "Mizoram PWD", "Field Officer Inspection Incident Feed"]),
            "factor_summary": "Heavy rain + Vairengte mudslide advisory",
            "polyline_coords": json.dumps([
                [24.8333, 92.7789], [24.5000, 92.7600], [24.2200, 92.6800], [23.7307, 92.7173],
                [23.4000, 92.7500], [22.8800, 92.7300]
            ])
        },
        {
            "corridor_code": "COR-NH415",
            "name": "NH-415 Banderdewa - Itanagar Arterial Highway",
            "origin": "Banderdewa",
            "destination": "Itanagar",
            "states_covered": "Assam, Arunachal Pradesh",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "Clear traffic passage into Itanagar capital complex",
            "weather_condition": "Light Rain",
            "estimated_delay_mins": 15,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "BRO Dikrong Telemetry"]),
            "factor_summary": "Normal hill route passage",
            "polyline_coords": json.dumps([
                [27.1200, 93.8200], [27.1000, 93.7200], [27.0844, 93.6053]
            ])
        },
        {
            "corridor_code": "COR-NH44",
            "name": "NH-44 Shillong - Silchar - Agartala Logistics Highway",
            "origin": "Shillong",
            "destination": "Agartala",
            "states_covered": "Meghalaya, Assam, Tripura",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "Smooth transport movement",
            "weather_condition": "Partly Cloudy",
            "estimated_delay_mins": 0,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "Howrah River Bridge Registry"]),
            "factor_summary": "Normal road and bridge passage",
            "polyline_coords": json.dumps([
                [25.5788, 91.8933], [25.4400, 92.2000], [24.8333, 92.7789], [23.8315, 91.2868]
            ])
        },
        {
            "corridor_code": "COR-NH106-BYPASS",
            "name": "NH106 Eastern Bypass (Guwahati - Jagiroad - Bhoirymbong - Shillong)",
            "origin": "Guwahati",
            "destination": "Shillong",
            "states_covered": "Assam, Meghalaya",
            "status": "OPEN",
            "accessibility_status": "OPEN",
            "risk_level": "LOW",
            "current_condition": "Operational 2-lane hill detour route with all-weather bridge clearance",
            "weather_condition": "Clear",
            "estimated_delay_mins": 0,
            "incident_count": 0,
            "data_source": "INTEGRATED_ACCESSIBILITY_ENGINE",
            "data_sources": json.dumps(["Open-Meteo Live API", "NHIDCL Eastern Bypass Registry"]),
            "factor_summary": "Unrestricted strategic bypass clearance",
            "polyline_coords": json.dumps(ALTERNATE_GUWAHATI_SHILLONG_WAYPOINTS)
        }
    ]

    for c_data in corridor_seeds:
        cor = db.query(Corridor).filter(Corridor.corridor_code == c_data["corridor_code"]).first()
        if not cor:
            cor = Corridor(**c_data)
            db.add(cor)
        else:
            if not cor.polyline_coords or len(cor.polyline_coords) < 10:
                cor.polyline_coords = c_data["polyline_coords"]
            if not cor.accessibility_status:
                cor.accessibility_status = c_data["accessibility_status"]
            if not cor.data_sources:
                cor.data_sources = c_data["data_sources"]
            if not cor.factor_summary:
                cor.factor_summary = c_data["factor_summary"]
    db.commit()

if __name__ == "__main__":
    seed_database()

