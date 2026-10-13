import os
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.storage_service import StorageService, LocalStorageProvider, CloudObjectStorageProvider
from app.core.config import settings

client = TestClient(app)

def test_database_url_configuration():
    """Verify DATABASE_URL setting is dynamically configurable from environment."""
    assert settings.DATABASE_URL is not None
    assert "sqlite" in str(settings.DATABASE_URL) or "postgresql" in str(settings.DATABASE_URL)

def test_local_storage_provider():
    """Verify local filesystem storage provider creates files and reports health."""
    provider = LocalStorageProvider(upload_dir="test_uploads")
    sample_bytes = b"LINK-X8-IMAGE-DATA-TEST"
    file_url = provider.save("damage_report.jpg", sample_bytes)
    assert file_url.startswith("/uploads/")
    
    health = provider.get_health()
    assert health.storage_backend == "LOCAL_FILESYSTEM"
    assert health.is_ready is True
    assert health.total_objects_stored >= 1

    # Cleanup test file
    local_path = os.path.join("test_uploads", os.path.basename(file_url))
    if os.path.exists(local_path):
        os.remove(local_path)
    if os.path.exists("test_uploads"):
        os.rmdir("test_uploads")

def test_cloud_object_storage_provider():
    """Verify cloud object storage provider reports S3 readiness."""
    provider = CloudObjectStorageProvider(bucket_name="link-x8-test-bucket", region="ap-south-1")
    health = provider.get_health()
    assert health.storage_backend == "CLOUD_OBJECT_STORAGE_S3"
    assert health.bucket_or_path == "link-x8-test-bucket"
    assert health.is_ready is True

def test_root_health_endpoint():
    """Verify root GET /health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert "NER88" in data["system"] or "LINK X8" in data["system"]

def test_deep_observability_health_endpoint():
    """Verify deep GET /api/v1/health returns comprehensive system health."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["HEALTHY", "DEGRADED"]
    assert data["project"] == "LINK X8"
    assert data["sih_problem"] == "SIH26002"
    assert data["database_status"] == "HEALTHY"
    assert data["database_dialect"] in ["sqlite", "postgresql"]
    assert "object_storage" in data
    assert data["object_storage"]["is_ready"] is True
    assert data["transport_integrations_status"] == "INTEGRATION-READY"
    assert data["government_monitoring_status"] == "INTEGRATION-READY"
    assert data["uptime_seconds"] >= 0

def test_alembic_configuration_exists():
    """Verify Alembic migration configuration files exist."""
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    alembic_ini = os.path.join(base_dir, "alembic.ini")
    alembic_env = os.path.join(base_dir, "alembic", "env.py")
    assert os.path.exists(alembic_ini)
    assert os.path.exists(alembic_env)

def test_docker_configuration_exists():
    """Verify Dockerfile and docker-compose.yml files exist."""
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    root_dir = os.path.abspath(os.path.join(backend_dir, ".."))
    backend_dockerfile = os.path.join(backend_dir, "Dockerfile")
    docker_compose = os.path.join(root_dir, "docker-compose.yml")
    assert os.path.exists(backend_dockerfile)
    assert os.path.exists(docker_compose)
