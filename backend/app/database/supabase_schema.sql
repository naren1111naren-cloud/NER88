-- ==============================================================================
-- NER88 / LINK X8 (SIH26002) - Supabase PostgreSQL & PostGIS Schema Migration
-- Complete Relational DDL with Row Level Security (RLS) & Realtime Subscriptions
-- ==============================================================================

-- 1. Enable Core PostgreSQL & GIS Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Enable PostGIS if supported
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "postgis";
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PostGIS extension not available or already configured; proceeding with fallback coordinates.';
END $$;

-- ==============================================================================
-- 2. Organizations, States & Administrative Districts
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'GOVERNMENT', -- GOVERNMENT, DEFENSE, LOGISTICS, EMERGENCY
    state TEXT DEFAULT 'Northeast Region',
    contact_email TEXT,
    contact_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.states (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL, -- e.g. AS, MN, ML, TR, NL, MZ, AR, SK
    name TEXT NOT NULL,
    capital_city TEXT,
    boundary_geom GEOMETRY(Polygon, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.districts (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    state TEXT NOT NULL,
    accessibility_index DOUBLE PRECISION DEFAULT 85.0,
    status TEXT DEFAULT 'Good',
    active_incidents_count INTEGER DEFAULT 0,
    bridge_count INTEGER DEFAULT 0,
    accessible_corridor_count INTEGER DEFAULT 0,
    critical_supply_status TEXT DEFAULT 'STABLE',
    boundary_geom GEOMETRY(Polygon, 4326),
    last_recalculated TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. Profiles (Linked 1:1 to auth.users.id)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    organization TEXT DEFAULT 'Ministry of Development of North Eastern Region (MDoNER)',
    designation TEXT DEFAULT 'Logistics Intelligence Officer',
    role TEXT NOT NULL DEFAULT 'VIEWER' CHECK (role IN ('ADMIN', 'COMMAND_CENTER', 'DISPATCHER', 'FIELD_OFFICER', 'DRIVER', 'ANALYST', 'VIEWER')),
    state TEXT DEFAULT 'Assam',
    district TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Helper function to inspect role inside RLS policies
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Trigger to automatically create a profile entry when a new auth.users record is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'role', 'VIEWER')
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 4. Corridors & Road Segments
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.corridors (
    id SERIAL PRIMARY KEY,
    corridor_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    states_covered TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN',
    accessibility_status TEXT DEFAULT 'OPEN' CHECK (accessibility_status IN ('OPEN', 'RESTRICTED', 'BLOCKED')),
    accessibility_score DOUBLE PRECISION DEFAULT 90.0,
    risk_level TEXT DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    current_condition TEXT,
    weather_condition TEXT DEFAULT 'Clear',
    reason TEXT,
    factor_summary TEXT,
    estimated_delay_mins INTEGER DEFAULT 0,
    incident_count INTEGER DEFAULT 0,
    data_source TEXT DEFAULT 'INTEGRATED_ACCESSIBILITY_ENGINE',
    data_sources JSONB DEFAULT '["Open-Meteo Live API", "Field Inspection Feed", "BRO Clearance Registry"]'::jsonb,
    data_confidence TEXT DEFAULT 'HIGH',
    geometry GEOMETRY(LineString, 4326),
    polyline_coords JSONB,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.road_segments (
    id SERIAL PRIMARY KEY,
    corridor_id INTEGER REFERENCES public.corridors(id) ON DELETE CASCADE,
    segment_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    start_lat DOUBLE PRECISION NOT NULL,
    start_lng DOUBLE PRECISION NOT NULL,
    end_lat DOUBLE PRECISION NOT NULL,
    end_lng DOUBLE PRECISION NOT NULL,
    geometry GEOMETRY(LineString, 4326),
    segment_length_km DOUBLE PRECISION DEFAULT 10.0,
    risk_score DOUBLE PRECISION DEFAULT 10.0,
    surface_condition TEXT DEFAULT 'GOOD', -- GOOD, FAIR, POOR, FLOODED, BLOCKED
    last_inspected TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. Vehicles & Telemetry
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.vehicles (
    id SERIAL PRIMARY KEY,
    vehicle_code TEXT UNIQUE NOT NULL,
    device_id TEXT,
    device_api_key TEXT,
    driver_name TEXT NOT NULL,
    driver_phone TEXT,
    vehicle_type TEXT DEFAULT 'Heavy Truck (10T)',
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'IDLE', 'OFFLINE', 'EMERGENCY', 'DELIVERED', 'IN_TRANSIT', 'REROUTED')),
    current_lat DOUBLE PRECISION NOT NULL,
    current_lng DOUBLE PRECISION NOT NULL,
    current_location GEOMETRY(Point, 4326),
    speed_kmh DOUBLE PRECISION DEFAULT 45.0,
    heading_deg DOUBLE PRECISION DEFAULT 90.0,
    odometer_km DOUBLE PRECISION DEFAULT 0.0,
    ignition_status TEXT DEFAULT 'ON',
    connectivity_status TEXT DEFAULT 'ONLINE',
    telemetry_health TEXT DEFAULT 'LIVE',
    tracking_mode TEXT DEFAULT 'SIMULATION',
    telemetry_source TEXT DEFAULT 'GPS_TELEMETRY',
    last_telemetry_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vehicle_telemetry (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    vehicle_code TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326),
    speed_kmh DOUBLE PRECISION DEFAULT 0.0,
    heading_deg DOUBLE PRECISION DEFAULT 0.0,
    altitude_m DOUBLE PRECISION DEFAULT 150.0,
    odometer_km DOUBLE PRECISION DEFAULT 0.0,
    ignition_status TEXT DEFAULT 'ON',
    battery_level_pct DOUBLE PRECISION DEFAULT 100.0,
    satellites_connected INTEGER DEFAULT 8,
    telemetry_source TEXT DEFAULT 'GPS_TRACKER',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_time ON public.vehicle_telemetry(vehicle_id, recorded_at DESC);

-- ==============================================================================
-- 6. Shipments, Routes & Route Segments
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.shipments (
    id SERIAL PRIMARY KEY,
    shipment_number TEXT UNIQUE NOT NULL,
    commodity TEXT NOT NULL,
    cargo_type TEXT DEFAULT 'Medical Supplies',
    cargo_category TEXT DEFAULT 'Medicines',
    priority TEXT DEFAULT 'URGENT' CHECK (priority IN ('EMERGENCY', 'URGENT', 'HIGH', 'NORMAL')),
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    origin_location GEOMETRY(Point, 4326),
    destination_location GEOMETRY(Point, 4326),
    vehicle_id INTEGER REFERENCES public.vehicles(id) ON DELETE SET NULL,
    driver_name TEXT,
    status TEXT DEFAULT 'IN_TRANSIT' CHECK (status IN ('PLANNED', 'IN_TRANSIT', 'DELAYED', 'REROUTED', 'DELIVERED', 'CANCELLED')),
    planned_eta TIMESTAMPTZ NOT NULL,
    current_eta TIMESTAMPTZ NOT NULL,
    actual_delivery_at TIMESTAMPTZ,
    route_risk_score DOUBLE PRECISION DEFAULT 15.0,
    route_risk_category TEXT DEFAULT 'LOW',
    active_route_path JSONB,
    alternate_route_path JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.routes (
    id SERIAL PRIMARY KEY,
    route_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    distance_km DOUBLE PRECISION NOT NULL,
    standard_duration_hours DOUBLE PRECISION NOT NULL,
    geometry GEOMETRY(LineString, 4326),
    waypoints JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.route_segments (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES public.routes(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,
    road_segment_id INTEGER REFERENCES public.road_segments(id) ON DELETE SET NULL,
    distance_km DOUBLE PRECISION NOT NULL,
    estimated_time_minutes INTEGER NOT NULL
);

-- ==============================================================================
-- 7. Incidents, Field Reports & Evidence
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.incidents (
    id SERIAL PRIMARY KEY,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('LANDSLIDE', 'FLOOD', 'ROAD_BLOCKAGE', 'BRIDGE_DAMAGE', 'ACCIDENT', 'HEAVY_RAIN', 'INFRASTRUCTURE_DAMAGE', 'OTHER')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('REPORTED', 'VERIFIED', 'ACTIVE', 'RESOLVED', 'REJECTED')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326),
    location_name TEXT NOT NULL,
    corridor_id INTEGER REFERENCES public.corridors(id) ON DELETE SET NULL,
    reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.field_reports (
    id SERIAL PRIMARY KEY,
    report_code TEXT UNIQUE NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('ROAD_BLOCKAGE', 'LANDSLIDE', 'FLOOD', 'BRIDGE_DAMAGE', 'HEAVY_RAIN', 'ACCIDENT', 'TRAFFIC_DISRUPTION', 'INFRASTRUCTURE_DAMAGE', 'ROAD_ACCESSIBILITY', 'OTHER')),
    title TEXT,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'HIGH' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    priority TEXT DEFAULT 'NORMAL',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326),
    location_name TEXT NOT NULL,
    district_name TEXT,
    reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    corridor_id INTEGER REFERENCES public.corridors(id) ON DELETE SET NULL,
    vehicle_id INTEGER REFERENCES public.vehicles(id) ON DELETE SET NULL,
    sync_status TEXT DEFAULT 'SYNCED' CHECK (sync_status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED')),
    client_created_at TIMESTAMPTZ DEFAULT NOW(),
    server_received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.field_report_evidence (
    id SERIAL PRIMARY KEY,
    field_report_id INTEGER NOT NULL REFERENCES public.field_reports(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type TEXT DEFAULT 'image/jpeg',
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. Accessibility Status & Risk Assessments
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.accessibility_status (
    id SERIAL PRIMARY KEY,
    corridor_id INTEGER NOT NULL REFERENCES public.corridors(id) ON DELETE CASCADE,
    score DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'RESTRICTED', 'BLOCKED')),
    risk_level TEXT NOT NULL,
    reason TEXT NOT NULL,
    weather_penalty DOUBLE PRECISION DEFAULT 0.0,
    hazard_penalty DOUBLE PRECISION DEFAULT 0.0,
    infrastructure_penalty DOUBLE PRECISION DEFAULT 0.0,
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.risk_assessments (
    id SERIAL PRIMARY KEY,
    target_type TEXT NOT NULL, -- CORRIDOR, VEHICLE, SHIPMENT, DISTRICT
    target_id TEXT NOT NULL,
    composite_risk_score DOUBLE PRECISION NOT NULL,
    risk_category TEXT NOT NULL,
    primary_threat TEXT NOT NULL,
    recommendations TEXT,
    assessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. Alerts & Notifications
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.alerts (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    severity TEXT DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    vehicle_id INTEGER REFERENCES public.vehicles(id) ON DELETE SET NULL,
    shipment_id INTEGER REFERENCES public.shipments(id) ON DELETE SET NULL,
    corridor_id INTEGER REFERENCES public.corridors(id) ON DELETE SET NULL,
    incident_id INTEGER REFERENCES public.incidents(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'NEW',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id SERIAL PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    channel TEXT DEFAULT 'IN_APP', -- IN_APP, SMS, EMAIL
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 10. Weather Observations & Offline Sync Queue
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.weather_observations (
    id SERIAL PRIMARY KEY,
    location_name TEXT NOT NULL,
    state TEXT,
    temperature_c DOUBLE PRECISION,
    rainfall_mm_hr DOUBLE PRECISION DEFAULT 0.0,
    weather_condition TEXT DEFAULT 'Clear',
    wind_kmh DOUBLE PRECISION DEFAULT 0.0,
    risk_level TEXT DEFAULT 'LOW',
    observed_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'Open-Meteo'
);

CREATE TABLE IF NOT EXISTS public.offline_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_local_id TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- FIELD_REPORT, TELEMETRY, INCIDENT
    payload JSONB NOT NULL,
    sync_status TEXT DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

-- ==============================================================================
-- 11. Audit Logging
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- 12. Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corridors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.road_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_report_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_sync_queue ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Profiles Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- ------------------------------------------------------------------------------
-- Field Reports Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Operational field reports are viewable by authenticated users" ON public.field_reports;
CREATE POLICY "Operational field reports are viewable by authenticated users"
ON public.field_reports FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Field officers and operators can insert reports" ON public.field_reports;
CREATE POLICY "Field officers and operators can insert reports"
ON public.field_reports FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL AND
    (reported_by = auth.uid() OR public.get_user_role() IN ('ADMIN', 'COMMAND_CENTER', 'DISPATCHER', 'FIELD_OFFICER'))
);

DROP POLICY IF EXISTS "Report creators or admins can update field reports" ON public.field_reports;
CREATE POLICY "Report creators or admins can update field reports"
ON public.field_reports FOR UPDATE
TO authenticated
USING (
    reported_by = auth.uid() OR
    public.get_user_role() IN ('ADMIN', 'COMMAND_CENTER', 'DISPATCHER')
);

-- ------------------------------------------------------------------------------
-- Field Report Evidence Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Field report evidence viewable by authenticated users" ON public.field_report_evidence;
CREATE POLICY "Field report evidence viewable by authenticated users"
ON public.field_report_evidence FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can upload field report evidence" ON public.field_report_evidence;
CREATE POLICY "Authenticated users can upload field report evidence"
ON public.field_report_evidence FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid() OR public.get_user_role() IN ('ADMIN', 'COMMAND_CENTER', 'DISPATCHER', 'FIELD_OFFICER'));

-- ------------------------------------------------------------------------------
-- Vehicles & Telemetry Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Vehicles viewable by authenticated users" ON public.vehicles;
CREATE POLICY "Vehicles viewable by authenticated users"
ON public.vehicles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Operators or assigned drivers can update vehicle state" ON public.vehicles;
CREATE POLICY "Operators or assigned drivers can update vehicle state"
ON public.vehicles FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('ADMIN', 'COMMAND_CENTER', 'DISPATCHER', 'DRIVER'));

DROP POLICY IF EXISTS "Telemetry viewable by authenticated users" ON public.vehicle_telemetry;
CREATE POLICY "Telemetry viewable by authenticated users"
ON public.vehicle_telemetry FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authorized sources can insert telemetry" ON public.vehicle_telemetry;
CREATE POLICY "Authorized sources can insert telemetry"
ON public.vehicle_telemetry FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() IN ('ADMIN', 'COMMAND_CENTER', 'DISPATCHER', 'DRIVER'));

-- ------------------------------------------------------------------------------
-- Corridors & Road Segments Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Corridors viewable by all authenticated users and viewers" ON public.corridors;
CREATE POLICY "Corridors viewable by all authenticated users and viewers"
ON public.corridors FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Corridors modifiable only by admins and command center" ON public.corridors;
CREATE POLICY "Corridors modifiable only by admins and command center"
ON public.corridors FOR ALL
TO authenticated
USING (public.get_user_role() IN ('ADMIN', 'COMMAND_CENTER'));

-- ------------------------------------------------------------------------------
-- Alerts & Notifications Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Alerts viewable by authenticated users" ON public.alerts;
CREATE POLICY "Alerts viewable by authenticated users"
ON public.alerts FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Alerts acknowledged by operators" ON public.alerts;
CREATE POLICY "Alerts acknowledged by operators"
ON public.alerts FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('ADMIN', 'COMMAND_CENTER', 'DISPATCHER', 'FIELD_OFFICER'));

-- ------------------------------------------------------------------------------
-- Audit Logs Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Audit logs restricted to Admins and Command Center" ON public.audit_logs;
CREATE POLICY "Audit logs restricted to Admins and Command Center"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.get_user_role() IN ('ADMIN', 'COMMAND_CENTER'));

-- ==============================================================================
-- 13. Enable Realtime Publications for Operational Entities
-- ==============================================================================

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.corridors;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.field_reports;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Realtime publication setup skipped or already active.';
END $$;
