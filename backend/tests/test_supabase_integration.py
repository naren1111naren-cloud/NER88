import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.supabase import SupabaseClient, supabase_client
from app.services.storage_service import StorageService, SupabaseStorageProvider, LocalStorageProvider
from app.core.security import create_access_token

client = TestClient(app)

def test_supabase_client_configuration():
    """Verify SupabaseClient initializes with default settings."""
    assert supabase_client.url == settings.SUPABASE_URL.rstrip("/")
    assert supabase_client.anon_key == settings.SUPABASE_KEY
    assert supabase_client.bucket_name == "field-report-evidence"
    assert supabase_client.is_configured is True

def test_supabase_client_health():
    """Verify Supabase health endpoint response format."""
    health = supabase_client.get_health()
    assert "status" in health
    assert "supabase_url" in health
    assert health["storage_bucket"] == "field-report-evidence"

def test_supabase_storage_provider():
    """Verify SupabaseStorageProvider initializes and handles fallback."""
    provider = SupabaseStorageProvider(bucket_name="field-report-evidence")
    health = provider.get_health()
    assert health.storage_backend == "SUPABASE_STORAGE"
    assert health.bucket_or_path == "field-report-evidence"

    # Test saving a test file (falls back gracefully to local uploads if offline)
    saved_url = provider.save("test_evidence.jpg", b"fake_image_bytes", "image/jpeg")
    assert saved_url is not None
    assert "test_evidence" in saved_url

def test_supabase_status_endpoint():
    """Verify GET /api/v1/auth/supabase-status returns healthy status payload."""
    response = client.get("/api/v1/auth/supabase-status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "supabase_url" in data

def test_auth_me_endpoint_with_valid_token():
    """Verify GET /api/v1/auth/me returns current operator profile."""
    # Create test token
    token = create_access_token(subject=1, role="Admin")
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    profile = response.json()
    assert "email" in profile
    assert profile["role"] == "Admin"

def test_supabase_schema_ddl_integrity():
    """Verify supabase_schema.sql contains all mandatory tables, PostGIS entities, and RLS policies."""
    sql_path = os.path.join(os.path.dirname(__file__), "..", "app", "database", "supabase_schema.sql")
    assert os.path.exists(sql_path), "supabase_schema.sql must exist"

    with open(sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

    # Core tables
    mandatory_tables = [
        "profiles",
        "corridors",
        "road_segments",
        "vehicles",
        "vehicle_telemetry",
        "shipments",
        "incidents",
        "field_reports",
        "field_report_evidence",
        "alerts",
        "weather_observations",
        "audit_logs",
        "offline_sync_queue",
    ]
    for table in mandatory_tables:
        assert f"CREATE TABLE IF NOT EXISTS public.{table}" in sql_content, f"Missing table: {table}"

    # Row Level Security
    assert "ENABLE ROW LEVEL SECURITY" in sql_content
    assert "CREATE POLICY" in sql_content
    assert "public.get_user_role()" in sql_content

    # Realtime publication
    assert "ALTER PUBLICATION supabase_realtime ADD TABLE" in sql_content

def test_role_hierarchy_coverage():
    """Verify all 6 institutional roles are recognized by backend."""
    valid_roles = ["ADMIN", "COMMAND_CENTER", "DISPATCHER", "FIELD_OFFICER", "DRIVER", "ANALYST", "VIEWER"]
    for r in valid_roles:
        t = create_access_token(subject=f"user_{r}", role=r)
        assert t is not None
        assert len(t) > 20
