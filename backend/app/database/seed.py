import json
from datetime import datetime, timedelta
from app.database.database import engine, Base, SessionLocal
from app.models.models import User, Vehicle, Delivery, Incident, Alert, WeatherRecord, SystemSettings, AuditLog, Corridor, District, Bridge, TrafficRecord
from app.core.security import get_password_hash
from app.services.routing_service import PRIMARY_GUWAHATI_IMPHAL_WAYPOINTS, ALTERNATE_SILCHAR_IMPHAL_WAYPOINTS
from app.services.accessibility_service import AccessibilityEngine

from sqlalchemy import text

def ensure_schema_migrations(engine):
    def add_col_if_missing(conn, table, col, col_type, default=None):
        try:
            conn.execute(text(f"SELECT {col} FROM {table} LIMIT 1"))
        except Exception:
            try:
                def_str = f" DEFAULT {default}" if default is not None else ""
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}{def_str}"))
                conn.commit()
            except Exception:
                pass

    with engine.connect() as conn:
        # Bridges
        add_col_if_missing(conn, "bridges", "connected_road", "VARCHAR")
        add_col_if_missing(conn, "bridges", "load_restriction_type", "VARCHAR", "'No Restriction'")
        add_col_if_missing(conn, "bridges", "is_verified", "BOOLEAN", "1")

        # Incidents
        add_col_if_missing(conn, "incidents", "affected_bridge_id", "INTEGER")
        add_col_if_missing(conn, "incidents", "affected_bridge_code", "VARCHAR")

        # Field reports
        add_col_if_missing(conn, "field_reports", "affected_bridge_id", "INTEGER")
        add_col_if_missing(conn, "field_reports", "affected_bridge_code", "VARCHAR")

        # Vehicles
        add_col_if_missing(conn, "vehicles", "device_id", "VARCHAR")
        add_col_if_missing(conn, "vehicles", "device_api_key", "VARCHAR")
        add_col_if_missing(conn, "vehicles", "odometer_km", "FLOAT", "12450.0")
        add_col_if_missing(conn, "vehicles", "ignition_status", "VARCHAR", "'ON'")
        add_col_if_missing(conn, "vehicles", "telemetry_health", "VARCHAR", "'LIVE'")
        add_col_if_missing(conn, "vehicles", "tracking_mode", "VARCHAR", "'SIMULATION'")
        add_col_if_missing(conn, "vehicles", "altitude_m", "FLOAT", "150.0")
        add_col_if_missing(conn, "vehicles", "battery_level_pct", "FLOAT", "98.0")
        add_col_if_missing(conn, "vehicles", "satellites_connected", "INTEGER", "12")
        add_col_if_missing(conn, "vehicles", "last_telemetry_at", "DATETIME")

        # Alerts
        add_col_if_missing(conn, "alerts", "status", "VARCHAR", "'NEW'")
        add_col_if_missing(conn, "alerts", "acknowledged_at", "DATETIME")
        add_col_if_missing(conn, "alerts", "acknowledged_by", "VARCHAR")
        add_col_if_missing(conn, "alerts", "source_incident_id", "INTEGER")
        add_col_if_missing(conn, "alerts", "corridor_code", "VARCHAR")
        add_col_if_missing(conn, "alerts", "district_name", "VARCHAR")
        add_col_if_missing(conn, "alerts", "recommended_action", "TEXT")
        add_col_if_missing(conn, "alerts", "resolved_at", "DATETIME")

        # Deliveries
        add_col_if_missing(conn, "deliveries", "delay_reason", "VARCHAR", "'Normal Transit Clearance'")
        add_col_if_missing(conn, "deliveries", "quantity_description", "VARCHAR", "'Standard Pallet Load (500 units)'")
        add_col_if_missing(conn, "deliveries", "temperature_controlled", "BOOLEAN", "0")
        add_col_if_missing(conn, "deliveries", "completed_at", "DATETIME")
        add_col_if_missing(conn, "deliveries", "actual_delivery_duration_hours", "FLOAT")

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

if __name__ == "__main__":
    seed_database()
