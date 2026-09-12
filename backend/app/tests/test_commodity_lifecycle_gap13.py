import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.database.database import SessionLocal
from app.models.models import Delivery, Vehicle, AuditLog
from app.schemas.schemas import (
    CommodityConsignmentCreateIn,
    CommodityStatusUpdateIn,
    CommodityDeliveryCompleteIn
)
from app.services.commodity_service import CommodityService

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_commodity_test_db():
    db = SessionLocal()
    db.query(Delivery).filter(Delivery.delivery_code.like("MED-TEST-%")).delete(synchronize_session=False)
    db.query(Delivery).filter(Delivery.delivery_code.like("FOOD-TEST-%")).delete(synchronize_session=False)
    db.query(Delivery).filter(Delivery.delivery_code.like("CONST-TEST-%")).delete(synchronize_session=False)
    db.query(Delivery).filter(Delivery.delivery_code.like("AGRI-TEST-%")).delete(synchronize_session=False)
    db.commit()
    db.close()
    yield
    db = SessionLocal()
    db.query(Delivery).filter(Delivery.delivery_code.like("MED-TEST-%")).delete(synchronize_session=False)
    db.query(Delivery).filter(Delivery.delivery_code.like("FOOD-TEST-%")).delete(synchronize_session=False)
    db.query(Delivery).filter(Delivery.delivery_code.like("CONST-TEST-%")).delete(synchronize_session=False)
    db.query(Delivery).filter(Delivery.delivery_code.like("AGRI-TEST-%")).delete(synchronize_session=False)
    db.commit()
    db.close()

def test_medicines_lifecycle_flow():
    """TEST 1: Verify complete end-to-end lifecycle for Medicines category."""
    db = SessionLocal()
    payload = CommodityConsignmentCreateIn(
        cargo_name="Critical Cold-Chain Vaccines",
        cargo_category="Medicines",
        cargo_type="Life-Saving Pharmaceuticals",
        priority="EMERGENCY",
        origin_city="Guwahati",
        destination_city="Imphal",
        quantity_description="500 refrigerated vaccine vials",
        temperature_controlled=True
    )
    deliv = CommodityService.create_consignment(payload, db)
    assert deliv.cargo_category == "Medicines"
    assert deliv.status in ["CREATED", "ASSIGNED"]
    assert deliv.temperature_controlled is True

    # Update lifecycle steps
    deliv = CommodityService.update_lifecycle_status(
        deliv.id,
        CommodityStatusUpdateIn(status="DISPATCHED", current_lat=26.1445, current_lng=91.7362),
        db
    )
    assert deliv.status == "DISPATCHED"

    deliv = CommodityService.update_lifecycle_status(
        deliv.id,
        CommodityStatusUpdateIn(status="IN_TRANSIT", current_lat=25.9060, current_lng=93.7273),
        db
    )
    assert deliv.status == "IN_TRANSIT"

    # Complete delivery
    completed = CommodityService.complete_delivery(
        deliv.id,
        CommodityDeliveryCompleteIn(received_by="Imphal Central Hospital CMO", completion_notes="Cold-chain seal intact"),
        db
    )
    assert completed.status == "DELIVERED"
    assert completed.completed_at is not None
    assert completed.actual_delivery_duration_hours is not None
    db.close()

def test_food_supplies_lifecycle_flow():
    """TEST 2: Verify lifecycle for Food supplies category."""
    db = SessionLocal()
    payload = CommodityConsignmentCreateIn(
        cargo_name="PDS Rice and Pulses",
        cargo_category="Food supplies",
        cargo_type="Essential Food Grains",
        priority="URGENT",
        origin_city="Guwahati",
        destination_city="Silchar",
        quantity_description="25 Metric Tons"
    )
    deliv = CommodityService.create_consignment(payload, db)
    assert deliv.cargo_category == "Food supplies"
    assert deliv.delivery_code.startswith("FOOD-")
    db.close()

def test_construction_materials_lifecycle_flow():
    """TEST 3: Verify lifecycle for Construction materials category."""
    db = SessionLocal()
    payload = CommodityConsignmentCreateIn(
        cargo_name="Modular Steel Bridge Girders",
        cargo_category="Construction materials",
        cargo_type="Infrastructure Bridge Spans",
        priority="HIGH",
        origin_city="Silchar",
        destination_city="Aizawl",
        quantity_description="12 Metric Tons Heavy Steel"
    )
    deliv = CommodityService.create_consignment(payload, db)
    assert deliv.cargo_category == "Construction materials"
    assert deliv.delivery_code.startswith("CONST-")
    db.close()

def test_agricultural_produce_lifecycle_flow():
    """TEST 4: Verify lifecycle for Agricultural produce category."""
    db = SessionLocal()
    payload = CommodityConsignmentCreateIn(
        cargo_name="Organic Hill Ginger Harvest",
        cargo_category="Agricultural produce",
        cargo_type="Fresh Farm Produce",
        priority="URGENT",
        origin_city="Shillong",
        destination_city="Guwahati",
        quantity_description="6 Metric Tons Fresh Perishables"
    )
    deliv = CommodityService.create_consignment(payload, db)
    assert deliv.cargo_category == "Agricultural produce"
    assert deliv.delivery_code.startswith("AGRI-")
    db.close()

def test_consignment_creation_api_post():
    """TEST 5: Verify POST /api/v1/deliveries/consignment endpoint."""
    payload = {
        "cargo_name": "Emergency Medical Serum",
        "cargo_category": "Medicines",
        "cargo_type": "Medical Supplies",
        "priority": "EMERGENCY",
        "origin_city": "Guwahati",
        "destination_city": "Kohima",
        "quantity_description": "100 serum packs",
        "temperature_controlled": True
    }
    res = client.post("/api/v1/deliveries/consignment", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["cargo_category"] == "Medicines"
    assert data["origin_city"] == "Guwahati"
    assert data["destination_city"] == "Kohima"

def test_update_status_api_post():
    """TEST 6: Verify POST /api/v1/deliveries/{id}/update-status endpoint."""
    db = SessionLocal()
    d = db.query(Delivery).first()
    assert d is not None

    update_payload = {
        "status": "IN_TRANSIT",
        "current_lat": 25.9060,
        "current_lng": 93.7273,
        "location_note": "Passing Dimapur Transit Checkpoint"
    }
    res = client.post(f"/api/v1/deliveries/{d.id}/update-status", json=update_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "IN_TRANSIT"
    db.close()

def test_complete_delivery_api_post():
    """TEST 7: Verify POST /api/v1/deliveries/{id}/complete endpoint."""
    db = SessionLocal()
    d = db.query(Delivery).filter(Delivery.status != "DELIVERED").first()
    assert d is not None

    complete_payload = {
        "received_by": "District Depot Officer",
        "verification_pin": "8821",
        "completion_notes": "Consignment verified and unsealed"
    }
    res = client.post(f"/api/v1/deliveries/{d.id}/complete", json=complete_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "DELIVERED"
    assert data["completed_at"] is not None
    db.close()

def test_filter_by_category_api_get():
    """TEST 8: Verify GET /api/v1/deliveries/categories/Medicines."""
    res = client.get("/api/v1/deliveries/categories/Medicines")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    for item in data:
        assert item["cargo_category"] == "Medicines"

def test_overview_essential_commodities_api_get():
    """TEST 9: Verify GET /api/v1/deliveries/overview/essential-commodities aggregation endpoint."""
    res = client.get("/api/v1/deliveries/overview/essential-commodities")
    assert res.status_code == 200
    data = res.json()
    assert "total_active_essential_deliveries" in data
    assert "medicines_count" in data
    assert "food_supplies_count" in data
    assert "construction_materials_count" in data
    assert "agricultural_produce_count" in data
    assert len(data["categories_summary"]) == 4

def test_demo_essential_scenarios_seed_endpoint():
    """TEST 10: Verify POST /api/v1/deliveries/demo-essential-scenarios seeds 4 essential categories."""
    res = client.post("/api/v1/deliveries/demo-essential-scenarios")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 4
    categories = [d["cargo_category"] for d in data]
    assert "Medicines" in categories
    assert "Food supplies" in categories
    assert "Construction materials" in categories
    assert "Agricultural produce" in categories
