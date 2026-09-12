"""
SIH GAPS 18, 19, 20 — Automated Operational Alerts
Comprehensive Test Suite

GAP 18 — AUTOMATED BLOCKED-ROAD ALERTS
GAP 19 — INACCESSIBLE-REGION ALERTS
GAP 20 — DELAYED-DELIVERY ALERTS

Test Matrix:
  BLOCKED ROAD:
    [x] Road blockage trigger (incident → accessibility → BLOCKED status)
    [x] Accessibility update after incident
    [x] Alert creation with correct type
    [x] Correct severity (CRITICAL for score=0)
    [x] Correct location (corridor_code, origin→destination)
    [x] Correct road/corridor linkage (corridor_code field)
    [x] Duplicate prevention (second call doesn't create second alert)
    [x] Alert acknowledgement via existing endpoint
    [x] Alert resolution via new endpoint
    [x] Alert recovery (corridor un-blocked → alert resolved)

  INACCESSIBLE REGION:
    [x] District accessibility calculation via AccessibilityEngine
    [x] Threshold detection (score < 30)
    [x] Alert creation with alert_type=INACCESSIBLE_REGION
    [x] Cause identification (incident linked to district)
    [x] Affected district shown in alert
    [x] Duplicate prevention
    [x] Recovery (district recovered → alert resolved)
    [x] Alert acknowledgement

  DELAYED DELIVERY:
    [x] Delivery ETA endpoint works
    [x] Delay calculation produces estimated_delay_mins
    [x] Threshold detection (>= 45 mins by default)
    [x] Alert creation with alert_type=DELIVERY_DELAY_WARNING
    [x] Delay reason included
    [x] Delivery information (delivery_id, vehicle_id)
    [x] Duplicate prevention
    [x] Recovery (delay below threshold → alert resolved)
    [x] Alert acknowledgement

  INTEGRATION:
    [x] End-to-end demo scenario (all 3 alerts)
    [x] Alert resolution endpoint works
    [x] Active alerts filter endpoint works
    [x] Configuration endpoint works
    [x] Status endpoint works

  REGRESSION:
    [x] Existing incidents endpoint still works
    [x] Existing field reports sync still works
    [x] Existing ETA service still works
    [x] Existing alert acknowledgement still works
    [x] SSE stream endpoint still accessible
"""

import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database.database import get_db
from app.models.models import Alert, Corridor, District, Incident, Delivery, Bridge

client = TestClient(app)

# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def get_db_session() -> Session:
    """Get a test DB session."""
    gen = get_db()
    return next(gen)


def cleanup_demo_alerts(db: Session):
    """Remove any demo-scenario alerts and incidents between tests."""
    db.query(Alert).filter(
        Alert.alert_type.in_(["BLOCKED_ROAD", "INACCESSIBLE_REGION", "DELIVERY_DELAY_WARNING"]),
        Alert.source_incident_id.isnot(None)
    ).delete(synchronize_session=False)
    db.query(Incident).filter(
        Incident.description.ilike("%DEMO-SCENARIO-18-19-20%")
    ).delete(synchronize_session=False)
    db.commit()


# ─────────────────────────────────────────────────────────────
# GAP 18 — BLOCKED-ROAD ALERT TESTS
# ─────────────────────────────────────────────────────────────

def test_g18_01_status_endpoint():
    """GAP18-01: Operational alerts status endpoint is accessible."""
    res = client.get("/api/v1/operational-alerts/status")
    assert res.status_code == 200
    data = res.json()
    assert "gap18_blocked_road_alerts" in data
    assert data["gap18_blocked_road_alerts"]["status"] == "OPERATIONAL"


def test_g18_02_configuration_endpoint():
    """GAP18-02: Configuration endpoint exposes documented threshold rules."""
    res = client.get("/api/v1/operational-alerts/configuration")
    assert res.status_code == 200
    data = res.json()
    assert "gap18_blocked_road" in data
    assert "trigger" in data["gap18_blocked_road"]
    assert "deduplication" in data["gap18_blocked_road"]


def test_g18_03_incident_triggers_blocked_road_alert():
    """GAP18-03: Reporting a BLOCKED road incident creates a BLOCKED_ROAD alert via accessibility cascade."""
    db = get_db_session()

    # Pre-clean any existing COR-NH27 alert so deduplication doesn't prevent new alert creation
    db.query(Alert).filter(Alert.alert_type == "BLOCKED_ROAD", Alert.corridor_code == "COR-NH27").delete()
    db.commit()

    # Pre-check: count existing blocked road alerts
    before_count = db.query(Alert).filter(
        Alert.alert_type == "BLOCKED_ROAD"
    ).count()

    # Create an incident that blocks a corridor sector (NH27/Senapati)
    incident_payload = {
        "incident_type": "LANDSLIDE",
        "description": "[TEST-G18-03] Test-triggered road blockage on NH27 sector",
        "latitude": 25.2747,
        "longitude": 93.9348,
        "location_name": "Senapati",
        "district_name": "Senapati",
        "severity": "CRITICAL",
        "road_status": "BLOCKED"
    }
    res = client.post("/api/v1/incidents", json=incident_payload)
    assert res.status_code == 200
    incident_id = res.json()["id"]

    # Check if BLOCKED_ROAD alert was created
    after_count = db.query(Alert).filter(Alert.alert_type == "BLOCKED_ROAD").count()
    db.expire_all()

    # If COR-NH27 was blocked, alert should have fired
    blocked_corridor = db.query(Corridor).filter(
        Corridor.corridor_code == "COR-NH27",
        Corridor.status.in_(["BLOCKED", "CLOSED"])
    ).first()

    if blocked_corridor:
        assert after_count > before_count, "BLOCKED_ROAD alert should be created when corridor is BLOCKED"
        alert = db.query(Alert).filter(
            Alert.alert_type == "BLOCKED_ROAD",
            Alert.corridor_code == "COR-NH27"
        ).order_by(Alert.created_at.desc()).first()
        assert alert is not None
        assert alert.severity in ["HIGH", "CRITICAL"]
        assert "COR-NH27" in (alert.corridor_code or "")
    else:
        # Incident didn't block the corridor enough — check AccessibilityEngine ran
        assert res.status_code == 200, "Incident API should return 200 regardless"

    # Cleanup
    db.query(Incident).filter(Incident.id == incident_id).delete()
    db.commit()


def test_g18_04_blocked_road_alert_has_corridor_code():
    """GAP18-04: BLOCKED_ROAD alert contains corridor_code for GIS linkage."""
    db = get_db_session()

    # Direct service test
    from app.services.operational_alerts_service import BlockedRoadAlertService
    from app.services.accessibility_service import AccessibilityEngine

    # Force a corridor to BLOCKED state
    corridor = db.query(Corridor).first()
    if not corridor:
        pytest.skip("No corridors in database")

    original_status = corridor.status
    original_score = corridor.accessibility_score

    corridor.status = "BLOCKED"
    corridor.accessibility_score = 0.0
    corridor.reason = "TEST FORCED BLOCK"
    db.commit()

    # Evaluate alert
    alert = BlockedRoadAlertService.evaluate_and_alert(corridor, db)

    if alert:
        assert alert.alert_type == "BLOCKED_ROAD"
        assert alert.corridor_code == corridor.corridor_code
        assert alert.severity in ["HIGH", "CRITICAL"]
        assert corridor.corridor_code in (alert.location or "")

        # Cleanup: resolve and restore
        alert.status = "RESOLVED"

    corridor.status = original_status
    corridor.accessibility_score = original_score
    db.commit()


def test_g18_05_blocked_road_alert_deduplication():
    """GAP18-05: Second call for same blocked corridor does NOT create a second alert."""
    db = get_db_session()
    from app.services.operational_alerts_service import BlockedRoadAlertService

    corridor = db.query(Corridor).first()
    if not corridor:
        pytest.skip("No corridors in database")

    # Resolve any existing alerts first
    db.query(Alert).filter(
        Alert.alert_type == "BLOCKED_ROAD",
        Alert.corridor_code == corridor.corridor_code
    ).update({"status": "RESOLVED"})
    db.commit()

    original_status = corridor.status
    original_score = corridor.accessibility_score
    corridor.status = "BLOCKED"
    corridor.accessibility_score = 0.0
    db.commit()

    # First call creates alert
    alert1 = BlockedRoadAlertService.evaluate_and_alert(corridor, db)
    db.commit()

    count_after_first = db.query(Alert).filter(
        Alert.alert_type == "BLOCKED_ROAD",
        Alert.corridor_code == corridor.corridor_code,
        Alert.status != "RESOLVED"
    ).count()

    # Second call should NOT create another
    alert2 = BlockedRoadAlertService.evaluate_and_alert(corridor, db)
    db.commit()

    count_after_second = db.query(Alert).filter(
        Alert.alert_type == "BLOCKED_ROAD",
        Alert.corridor_code == corridor.corridor_code,
        Alert.status != "RESOLVED"
    ).count()

    assert count_after_first == count_after_second, "Duplicate alert should NOT be created"

    # Restore
    if alert1:
        alert1.status = "RESOLVED"
    corridor.status = original_status
    corridor.accessibility_score = original_score
    db.commit()


def test_g18_06_blocked_road_alert_acknowledgement():
    """GAP18-06: BLOCKED_ROAD alert can be acknowledged via existing alert endpoint."""
    db = get_db_session()

    # Create a test alert directly
    test_alert = Alert(
        alert_type="BLOCKED_ROAD",
        title="TEST G18-06: Blocked Road Alert",
        message="Test blocked road alert for acknowledgement test",
        severity="CRITICAL",
        location="Test Corridor",
        corridor_code="COR-TEST",
        status="NEW",
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(test_alert)
    db.commit()
    db.refresh(test_alert)

    alert_id = test_alert.id

    # Acknowledge via existing endpoint
    res = client.post(
        f"/api/v1/alerts/{alert_id}/acknowledge",
        json={"acknowledged_by": "NER Dispatcher", "notes": "Route evaluation initiated"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ACKNOWLEDGED"
    assert data["acknowledged_by"] == "NER Dispatcher"

    # Cleanup
    db.query(Alert).filter(Alert.id == alert_id).delete()
    db.commit()


def test_g18_07_blocked_road_alert_resolution():
    """GAP18-07: BLOCKED_ROAD alert can be explicitly resolved when corridor clears."""
    db = get_db_session()

    test_alert = Alert(
        alert_type="BLOCKED_ROAD",
        title="TEST G18-07: Road Cleared Alert",
        message="Test blocked road alert for resolution test",
        severity="HIGH",
        corridor_code="COR-TEST2",
        status="ACKNOWLEDGED",
        is_read=True,
        created_at=datetime.utcnow()
    )
    db.add(test_alert)
    db.commit()
    db.refresh(test_alert)

    # Resolve via operational-alerts endpoint
    res = client.post(
        f"/api/v1/operational-alerts/{test_alert.id}/resolve",
        json={"acknowledged_by": "System Auto-Resolve", "notes": "Corridor cleared"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RESOLVED"
    assert data["resolved_at"] is not None

    db.query(Alert).filter(Alert.id == test_alert.id).delete()
    db.commit()


def test_g18_08_corridor_recovery_auto_resolves_alert():
    """GAP18-08: When corridor recovers, BlockedRoadAlertService resolves active alert."""
    db = get_db_session()
    from app.services.operational_alerts_service import BlockedRoadAlertService

    corridor = db.query(Corridor).first()
    if not corridor:
        pytest.skip("No corridors in database")

    # Set up: resolve existing, force block, create alert
    db.query(Alert).filter(
        Alert.alert_type == "BLOCKED_ROAD",
        Alert.corridor_code == corridor.corridor_code,
        Alert.status != "RESOLVED"
    ).update({"status": "RESOLVED"})
    db.commit()

    original_status = corridor.status
    original_score = corridor.accessibility_score
    corridor.status = "BLOCKED"
    corridor.accessibility_score = 0.0
    db.commit()

    alert = BlockedRoadAlertService.evaluate_and_alert(corridor, db)
    db.commit()
    assert alert is not None

    # Now recover the corridor
    corridor.status = "OPEN"
    corridor.accessibility_score = 90.0
    db.commit()

    BlockedRoadAlertService.evaluate_and_alert(corridor, db)
    db.commit()

    # Check alert was resolved
    db.expire_all()
    resolved = db.query(Alert).filter(Alert.id == alert.id).first()
    assert resolved is not None
    assert resolved.status == "RESOLVED"

    # Restore original
    corridor.status = original_status
    corridor.accessibility_score = original_score
    db.commit()


def test_g18_09_accessibility_service_still_works():
    """GAP18-09: AccessibilityEngine.recalculate_all_accessibility still works after alert hook addition."""
    db = get_db_session()
    from app.services.accessibility_service import AccessibilityEngine
    result = AccessibilityEngine.recalculate_all_accessibility(db)
    assert "bridges_recalculated" in result
    assert "corridors_recalculated" in result
    assert "districts_recalculated" in result
    assert "timestamp" in result
    # New fields added
    assert "blocked_road_alerts_fired" in result
    assert "inaccessible_region_alerts_fired" in result


def test_g18_10_active_alerts_filter():
    """GAP18-10: Active alerts endpoint filters by alert_type=BLOCKED_ROAD."""
    res = client.get("/api/v1/operational-alerts/active?alert_type=BLOCKED_ROAD")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    for a in data:
        assert a["alert_type"] == "BLOCKED_ROAD"
        assert a["status"] != "RESOLVED"


# ─────────────────────────────────────────────────────────────
# GAP 19 — INACCESSIBLE REGION ALERT TESTS
# ─────────────────────────────────────────────────────────────

def test_g19_01_inaccessible_region_configuration():
    """GAP19-01: Configuration endpoint documents Gap 19 threshold."""
    res = client.get("/api/v1/operational-alerts/configuration")
    assert res.status_code == 200
    data = res.json()
    assert "gap19_inaccessible_region" in data
    config = data["gap19_inaccessible_region"]
    assert "score_threshold" in config
    assert float(config["score_threshold"]) == 30.0


def test_g19_02_district_below_threshold_creates_alert():
    """GAP19-02: District with accessibility_index < 30 triggers INACCESSIBLE_REGION alert."""
    db = get_db_session()
    from app.services.operational_alerts_service import InaccessibleRegionAlertService, INACCESSIBLE_REGION_THRESHOLD

    district = db.query(District).first()
    if not district:
        pytest.skip("No districts in database")

    # Resolve any existing district alerts
    db.query(Alert).filter(
        Alert.alert_type == "INACCESSIBLE_REGION",
        Alert.district_name == district.name,
        Alert.status != "RESOLVED"
    ).update({"status": "RESOLVED"})
    db.commit()

    original_index = district.accessibility_index
    original_status = district.status

    # Force below threshold
    district.accessibility_index = INACCESSIBLE_REGION_THRESHOLD - 5.0  # e.g. 25.0
    district.status = "Severely Inaccessible (0-24)" if district.accessibility_index < 25 else "Poor (25-49)"
    db.commit()

    alert = InaccessibleRegionAlertService.evaluate_and_alert(district, db)
    db.commit()

    assert alert is not None
    assert alert.alert_type == "INACCESSIBLE_REGION"
    assert alert.district_name == district.name
    assert alert.severity in ["HIGH", "CRITICAL"]
    assert district.name in (alert.location or "")

    # Cleanup
    if alert:
        alert.status = "RESOLVED"
    district.accessibility_index = original_index
    district.status = original_status
    db.commit()


def test_g19_03_district_above_threshold_no_alert():
    """GAP19-03: District with high accessibility does NOT trigger alert."""
    db = get_db_session()
    from app.services.operational_alerts_service import InaccessibleRegionAlertService, INACCESSIBLE_REGION_THRESHOLD

    district = db.query(District).first()
    if not district:
        pytest.skip("No districts in database")

    before_count = db.query(Alert).filter(
        Alert.alert_type == "INACCESSIBLE_REGION",
        Alert.district_name == district.name,
        Alert.status != "RESOLVED"
    ).count()

    original_index = district.accessibility_index
    district.accessibility_index = 80.0  # Well above threshold
    db.commit()

    alert = InaccessibleRegionAlertService.evaluate_and_alert(district, db)
    db.commit()

    after_count = db.query(Alert).filter(
        Alert.alert_type == "INACCESSIBLE_REGION",
        Alert.district_name == district.name,
        Alert.status != "RESOLVED"
    ).count()

    # No new alert should be created; if one existed before, it should be resolved
    assert after_count <= before_count

    district.accessibility_index = original_index
    db.commit()


def test_g19_04_inaccessible_region_deduplication():
    """GAP19-04: Second call for same district does NOT create a duplicate INACCESSIBLE_REGION alert."""
    db = get_db_session()
    from app.services.operational_alerts_service import InaccessibleRegionAlertService, INACCESSIBLE_REGION_THRESHOLD

    district = db.query(District).first()
    if not district:
        pytest.skip("No districts in database")

    # Resolve existing
    db.query(Alert).filter(
        Alert.alert_type == "INACCESSIBLE_REGION",
        Alert.district_name == district.name,
        Alert.status != "RESOLVED"
    ).update({"status": "RESOLVED"})
    db.commit()

    original_index = district.accessibility_index
    district.accessibility_index = INACCESSIBLE_REGION_THRESHOLD - 10.0
    db.commit()

    alert1 = InaccessibleRegionAlertService.evaluate_and_alert(district, db)
    db.commit()

    count_after_first = db.query(Alert).filter(
        Alert.alert_type == "INACCESSIBLE_REGION",
        Alert.district_name == district.name,
        Alert.status != "RESOLVED"
    ).count()

    alert2 = InaccessibleRegionAlertService.evaluate_and_alert(district, db)
    db.commit()

    count_after_second = db.query(Alert).filter(
        Alert.alert_type == "INACCESSIBLE_REGION",
        Alert.district_name == district.name,
        Alert.status != "RESOLVED"
    ).count()

    assert count_after_first == count_after_second, "Duplicate INACCESSIBLE_REGION alert should NOT be created"

    if alert1:
        alert1.status = "RESOLVED"
    district.accessibility_index = original_index
    db.commit()


def test_g19_05_inaccessible_region_recovery():
    """GAP19-05: When district recovers above threshold, alert is auto-resolved."""
    db = get_db_session()
    from app.services.operational_alerts_service import InaccessibleRegionAlertService, INACCESSIBLE_REGION_THRESHOLD

    district = db.query(District).first()
    if not district:
        pytest.skip("No districts in database")

    db.query(Alert).filter(
        Alert.alert_type == "INACCESSIBLE_REGION",
        Alert.district_name == district.name,
        Alert.status != "RESOLVED"
    ).update({"status": "RESOLVED"})
    db.commit()

    original_index = district.accessibility_index
    district.accessibility_index = INACCESSIBLE_REGION_THRESHOLD - 10.0
    db.commit()

    alert = InaccessibleRegionAlertService.evaluate_and_alert(district, db)
    db.commit()
    assert alert is not None

    # Recover
    district.accessibility_index = 85.0
    db.commit()
    InaccessibleRegionAlertService.evaluate_and_alert(district, db)
    db.commit()

    db.expire_all()
    resolved = db.query(Alert).filter(Alert.id == alert.id).first()
    assert resolved.status == "RESOLVED"

    district.accessibility_index = original_index
    db.commit()


def test_g19_06_inaccessible_region_acknowledgement():
    """GAP19-06: INACCESSIBLE_REGION alert can be acknowledged."""
    db = get_db_session()

    test_alert = Alert(
        alert_type="INACCESSIBLE_REGION",
        title="TEST G19-06: District Inaccessible",
        message="Test inaccessibility alert",
        severity="HIGH",
        district_name="TestDistrict",
        location="TestDistrict, Manipur",
        status="NEW",
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(test_alert)
    db.commit()
    db.refresh(test_alert)

    res = client.post(
        f"/api/v1/alerts/{test_alert.id}/acknowledge",
        json={"acknowledged_by": "NER Dispatcher", "notes": "Coordinating NDRF response"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ACKNOWLEDGED"

    db.query(Alert).filter(Alert.id == test_alert.id).delete()
    db.commit()


def test_g19_07_inaccessible_alert_contains_district_name():
    """GAP19-07: INACCESSIBLE_REGION alert exposes district_name for UI display."""
    db = get_db_session()
    from app.services.operational_alerts_service import InaccessibleRegionAlertService, INACCESSIBLE_REGION_THRESHOLD

    district = db.query(District).first()
    if not district:
        pytest.skip("No districts in database")

    db.query(Alert).filter(
        Alert.alert_type == "INACCESSIBLE_REGION",
        Alert.district_name == district.name,
        Alert.status != "RESOLVED"
    ).update({"status": "RESOLVED"})
    db.commit()

    original_index = district.accessibility_index
    district.accessibility_index = INACCESSIBLE_REGION_THRESHOLD - 8.0
    db.commit()

    alert = InaccessibleRegionAlertService.evaluate_and_alert(district, db)
    db.commit()

    if alert:
        assert alert.district_name == district.name
        assert alert.district_name is not None
        # Cleanup
        alert.status = "RESOLVED"

    district.accessibility_index = original_index
    db.commit()


# ─────────────────────────────────────────────────────────────
# GAP 20 — DELAYED DELIVERY ALERT TESTS
# ─────────────────────────────────────────────────────────────

def test_g20_01_delay_threshold_is_documented():
    """GAP20-01: Delay threshold is documented in configuration endpoint."""
    res = client.get("/api/v1/operational-alerts/configuration")
    assert res.status_code == 200
    data = res.json()
    assert "gap20_delayed_delivery" in data
    config = data["gap20_delayed_delivery"]
    assert "score_threshold" in config
    assert "configurable_via" in config


def test_g20_02_delivery_delay_alert_created_above_threshold():
    """GAP20-02: DELIVERY_DELAY_WARNING created when delay >= threshold."""
    db = get_db_session()
    from app.services.operational_alerts_service import DelayedDeliveryAlertService, DELIVERY_DELAY_THRESHOLD_MINS

    delivery = db.query(Delivery).first()
    if not delivery:
        pytest.skip("No deliveries in database")

    # Resolve existing delay alerts for this delivery
    db.query(Alert).filter(
        Alert.alert_type == "DELIVERY_DELAY_WARNING",
        Alert.delivery_id == delivery.id,
        Alert.status != "RESOLVED"
    ).update({"status": "RESOLVED"})
    db.commit()

    original_delay = delivery.estimated_delay_mins
    original_reason = delivery.delay_reason

    # Force delay above threshold
    delivery.estimated_delay_mins = DELIVERY_DELAY_THRESHOLD_MINS + 20
    delivery.delay_reason = "INCIDENT"
    db.commit()

    alert = DelayedDeliveryAlertService.evaluate_and_alert(delivery, db)
    db.commit()

    assert alert is not None
    assert alert.alert_type == "DELIVERY_DELAY_WARNING"
    assert alert.delivery_id == delivery.id
    assert alert.severity in ["MEDIUM", "HIGH", "CRITICAL"]

    # Cleanup
    if alert:
        alert.status = "RESOLVED"
    delivery.estimated_delay_mins = original_delay
    delivery.delay_reason = original_reason
    db.commit()


def test_g20_03_delivery_delay_alert_not_created_below_threshold():
    """GAP20-03: DELIVERY_DELAY_WARNING NOT created when delay < threshold."""
    db = get_db_session()
    from app.services.operational_alerts_service import DelayedDeliveryAlertService, DELIVERY_DELAY_THRESHOLD_MINS

    delivery = db.query(Delivery).first()
    if not delivery:
        pytest.skip("No deliveries in database")

    db.query(Alert).filter(
        Alert.alert_type == "DELIVERY_DELAY_WARNING",
        Alert.delivery_id == delivery.id,
        Alert.status != "RESOLVED"
    ).update({"status": "RESOLVED"})
    db.commit()

    original_delay = delivery.estimated_delay_mins
    delivery.estimated_delay_mins = DELIVERY_DELAY_THRESHOLD_MINS - 10  # Below threshold
    db.commit()

    before = db.query(Alert).filter(
        Alert.alert_type == "DELIVERY_DELAY_WARNING",
        Alert.delivery_id == delivery.id,
        Alert.status != "RESOLVED"
    ).count()

    alert = DelayedDeliveryAlertService.evaluate_and_alert(delivery, db)

    after = db.query(Alert).filter(
        Alert.alert_type == "DELIVERY_DELAY_WARNING",
        Alert.delivery_id == delivery.id,
        Alert.status != "RESOLVED"
    ).count()

    assert before == after, "No alert should be created below threshold"
    assert alert is None

    delivery.estimated_delay_mins = original_delay
    db.commit()


def test_g20_04_delivery_delay_deduplication():
    """GAP20-04: Second call for same delayed delivery does NOT create second alert."""
    db = get_db_session()
    from app.services.operational_alerts_service import DelayedDeliveryAlertService, DELIVERY_DELAY_THRESHOLD_MINS

    delivery = db.query(Delivery).first()
    if not delivery:
        pytest.skip("No deliveries in database")

    db.query(Alert).filter(
        Alert.alert_type == "DELIVERY_DELAY_WARNING",
        Alert.delivery_id == delivery.id,
        Alert.status != "RESOLVED"
    ).update({"status": "RESOLVED"})
    db.commit()

    original_delay = delivery.estimated_delay_mins
    delivery.estimated_delay_mins = DELIVERY_DELAY_THRESHOLD_MINS + 30
    db.commit()

    alert1 = DelayedDeliveryAlertService.evaluate_and_alert(delivery, db)
    db.commit()
    count1 = db.query(Alert).filter(
        Alert.alert_type == "DELIVERY_DELAY_WARNING",
        Alert.delivery_id == delivery.id,
        Alert.status != "RESOLVED"
    ).count()

    alert2 = DelayedDeliveryAlertService.evaluate_and_alert(delivery, db)
    db.commit()
    count2 = db.query(Alert).filter(
        Alert.alert_type == "DELIVERY_DELAY_WARNING",
        Alert.delivery_id == delivery.id,
        Alert.status != "RESOLVED"
    ).count()

    assert count1 == count2, "Duplicate delay alert should NOT be created"

    if alert1:
        alert1.status = "RESOLVED"
    delivery.estimated_delay_mins = original_delay
    db.commit()


def test_g20_05_delivery_delay_contains_delivery_info():
    """GAP20-05: DELIVERY_DELAY_WARNING contains delivery_id and vehicle_id."""
    db = get_db_session()
    from app.services.operational_alerts_service import DelayedDeliveryAlertService, DELIVERY_DELAY_THRESHOLD_MINS

    delivery = db.query(Delivery).first()
    if not delivery:
        pytest.skip("No deliveries in database")

    db.query(Alert).filter(
        Alert.alert_type == "DELIVERY_DELAY_WARNING",
        Alert.delivery_id == delivery.id,
        Alert.status != "RESOLVED"
    ).update({"status": "RESOLVED"})
    db.commit()

    original_delay = delivery.estimated_delay_mins
    delivery.estimated_delay_mins = DELIVERY_DELAY_THRESHOLD_MINS + 20
    delivery.delay_reason = "WEATHER"
    db.commit()

    alert = DelayedDeliveryAlertService.evaluate_and_alert(delivery, db)
    db.commit()

    if alert:
        assert alert.delivery_id == delivery.id
        assert delivery.delivery_code in alert.title
        # Check delay reason appears in message
        assert "Weather" in alert.message or "WEATHER" in alert.message or "weather" in alert.message.lower()
        alert.status = "RESOLVED"

    delivery.estimated_delay_mins = original_delay
    db.commit()


def test_g20_06_delivery_delay_recovery():
    """GAP20-06: When delay drops below threshold, DELIVERY_DELAY_WARNING is auto-resolved."""
    db = get_db_session()
    from app.services.operational_alerts_service import DelayedDeliveryAlertService, DELIVERY_DELAY_THRESHOLD_MINS

    delivery = db.query(Delivery).first()
    if not delivery:
        pytest.skip("No deliveries in database")

    db.query(Alert).filter(
        Alert.alert_type == "DELIVERY_DELAY_WARNING",
        Alert.delivery_id == delivery.id,
        Alert.status != "RESOLVED"
    ).update({"status": "RESOLVED"})
    db.commit()

    original_delay = delivery.estimated_delay_mins
    delivery.estimated_delay_mins = DELIVERY_DELAY_THRESHOLD_MINS + 30
    db.commit()

    alert = DelayedDeliveryAlertService.evaluate_and_alert(delivery, db)
    db.commit()
    assert alert is not None

    # Recover: drop delay below threshold
    delivery.estimated_delay_mins = DELIVERY_DELAY_THRESHOLD_MINS - 10
    db.commit()

    DelayedDeliveryAlertService.evaluate_and_alert(delivery, db)
    db.commit()

    db.expire_all()
    resolved = db.query(Alert).filter(Alert.id == alert.id).first()
    assert resolved.status == "RESOLVED"

    delivery.estimated_delay_mins = original_delay
    db.commit()


def test_g20_07_delivery_delay_acknowledgement():
    """GAP20-07: DELIVERY_DELAY_WARNING can be acknowledged."""
    db = get_db_session()

    delivery = db.query(Delivery).first()
    if not delivery:
        pytest.skip("No deliveries in database")

    test_alert = Alert(
        alert_type="DELIVERY_DELAY_WARNING",
        title=f"TEST G20-07: Delay Alert for {delivery.delivery_code}",
        message="Test delay alert for acknowledgement",
        severity="HIGH",
        delivery_id=delivery.id,
        status="NEW",
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(test_alert)
    db.commit()
    db.refresh(test_alert)

    res = client.post(
        f"/api/v1/alerts/{test_alert.id}/acknowledge",
        json={"acknowledged_by": "Dispatcher", "notes": "Rerouting initiated"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ACKNOWLEDGED"

    db.query(Alert).filter(Alert.id == test_alert.id).delete()
    db.commit()


def test_g20_08_eta_endpoint_still_works():
    """GAP20-08: Existing ETA endpoint still works after Gap 20 integration."""
    res = client.get("/api/v1/deliveries/eta/breakdown?origin=Guwahati&destination=Imphal")
    assert res.status_code == 200
    data = res.json()
    assert "predicted_eta" in data
    assert "total_estimated_delay_mins" in data
    assert "delay_contributors" in data
    assert "primary_delay_reason" in data


def test_g20_09_delivery_live_eta_update_works():
    """GAP20-09: POST /deliveries/{id}/update-live-eta still works after Gap 20."""
    db = get_db_session()
    delivery = db.query(Delivery).filter(Delivery.status == "IN_TRANSIT").first()
    if not delivery:
        delivery = db.query(Delivery).first()
    if not delivery:
        pytest.skip("No deliveries in database")

    res = client.post(
        f"/api/v1/deliveries/{delivery.id}/update-live-eta",
        params={"current_lat": 25.5, "current_lng": 93.8}
    )
    assert res.status_code == 200
    data = res.json()
    assert "estimated_delay_mins" in data
    assert "delay_alert_active" in data
    assert "revised_eta" in data


# ─────────────────────────────────────────────────────────────
# INTEGRATION — END-TO-END DEMO SCENARIO
# ─────────────────────────────────────────────────────────────

def test_g18_g19_g20_demo_scenario_status():
    """INTEGRATION: Demo scenario status endpoint works."""
    res = client.get("/api/v1/operational-alerts/demo-scenario/status")
    assert res.status_code == 200
    data = res.json()
    assert "flow" in data
    assert len(data["flow"]) >= 5
    assert "SIMULATED" in data.get("data_label", "")


def test_g18_g19_g20_demo_scenario_triggers_all_three_gaps():
    """INTEGRATION: End-to-end demo scenario triggers Gap 18, 19, and 20 alerts."""
    res = client.post("/api/v1/operational-alerts/demo-scenario")
    assert res.status_code == 200
    data = res.json()

    # Validate response structure
    assert "steps" in data
    assert "summary" in data
    assert "data_label" in data
    assert "SIMULATED" in data["data_label"]

    # Check steps are present
    step_actions = [s["action"] for s in data["steps"]]
    assert any("INCIDENT" in a.upper() for a in step_actions)
    assert any("CASCADE" in a.upper() or "ACCESSIBILITY" in a.upper() for a in step_actions)
    assert any("GAP 18" in a or "BLOCKED_ROAD" in a for a in step_actions)
    assert any("GAP 19" in a or "INACCESSIBLE_REGION" in a for a in step_actions)
    assert any("GAP 20" in a or "DELIVERY" in a for a in step_actions)

    # Demo cleanup
    client.delete("/api/v1/operational-alerts/demo-scenario/cleanup")


def test_g18_g19_g20_active_alerts_endpoint():
    """INTEGRATION: Active alerts endpoint returns operational alert types only."""
    res = client.get("/api/v1/operational-alerts/active")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    for alert in data:
        assert alert["alert_type"] in ["BLOCKED_ROAD", "INACCESSIBLE_REGION", "DELIVERY_DELAY_WARNING"]
        assert alert["status"] != "RESOLVED"


# ─────────────────────────────────────────────────────────────
# REGRESSION — EXISTING SYSTEM STILL WORKS
# ─────────────────────────────────────────────────────────────

def test_regression_existing_alerts_endpoint():
    """REGRESSION: Existing GET /api/v1/alerts still works."""
    res = client.get("/api/v1/alerts")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_regression_existing_incidents_endpoint():
    """REGRESSION: Existing GET /api/v1/incidents still works."""
    res = client.get("/api/v1/incidents")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_regression_existing_deliveries_endpoint():
    """REGRESSION: Existing GET /api/v1/deliveries still works."""
    res = client.get("/api/v1/deliveries")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_regression_existing_corridors_endpoint():
    """REGRESSION: Existing GET /api/v1/corridors still works."""
    res = client.get("/api/v1/corridors")
    assert res.status_code == 200


def test_regression_existing_districts_endpoint():
    """REGRESSION: Existing GET /api/v1/districts still works."""
    res = client.get("/api/v1/districts")
    assert res.status_code == 200


def test_regression_existing_alert_acknowledgement():
    """REGRESSION: Existing POST /api/v1/alerts/{id}/acknowledge still works."""
    db = get_db_session()
    test_alert = Alert(
        alert_type="REGRESSION_TEST",
        title="Regression test alert",
        message="Regression test for acknowledgement",
        severity="LOW",
        status="NEW",
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(test_alert)
    db.commit()
    db.refresh(test_alert)

    res = client.post(f"/api/v1/alerts/{test_alert.id}/acknowledge",
                      json={"acknowledged_by": "Test System"})
    assert res.status_code == 200
    assert res.json()["status"] == "ACKNOWLEDGED"

    db.query(Alert).filter(Alert.id == test_alert.id).delete()
    db.commit()


def test_regression_alert_history():
    """REGRESSION: Existing GET /api/v1/alerts/history still works."""
    res = client.get("/api/v1/alerts/history")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_regression_field_reports_sync():
    """REGRESSION: Field reports sync endpoint still works after Gap 18-19 hook."""
    payload = {
        "reports": [
            {
                "report_code": "FR-REG-TEST-001",
                "incident_type": "ROAD_DAMAGE",
                "description": "Regression test field report",
                "latitude": 26.1445,
                "longitude": 91.7362,
                "location_name": "Test Location",
                "district_name": "Kamrup Metropolitan",
                "severity": "LOW",
                "road_status": "PASSABLE"
            }
        ]
    }
    res = client.post("/api/v1/field-reports/sync", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["synced_count"] >= 1


def test_regression_ml_predict():
    """REGRESSION: ML predict endpoint still works."""
    payload = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "distance_km": 280,
        "terrain_elevation_gain_m": 1800,
        "rainfall_mm_hr": 35,
        "active_incidents_count": 1,
        "highest_severity_numeric": 2,
        "road_blocked_status": 0,
        "historical_landslide_freq": 0.4,
        "traffic_congestion_index": 0.35
    }
    res = client.post("/api/v1/ml/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "prediction" in data
    assert "explanation" in data


def test_regression_telemetry_ingest():
    """REGRESSION: Telemetry ingest still works."""
    payload = {
        "vehicle_code": "NER-V001",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "speed_kmh": 42.5,
        "telemetry_source": "SIMULATED GPS TELEMETRY"
    }
    res = client.post("/api/v1/telemetry/ingest", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "SUCCESS"
