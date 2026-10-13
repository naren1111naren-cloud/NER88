import pytest
from app.database.database import SessionLocal
from app.services.accessibility_service import AccessibilityEngine

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_guwahati_shillong_segment_evaluation(db_session):
    """Test standard Guwahati -> Shillong corridor segmentation."""
    res = AccessibilityEngine.evaluate_route_risk_segments(
        db=db_session,
        origin="Guwahati",
        destination="Shillong",
        route_name="NH-40 Mountain Highway",
        vuln_seg="Segment 04 — Umling Ridge",
        rainfall_mm_hr=18.0,
        dist_km=103.0,
        elev_gain_m=1440.0
    )

    assert res["origin"] == "Guwahati"
    assert res["destination"] == "Shillong"
    assert res["total_sections"] == 5
    assert res["high_risk_count"] >= 1
    assert "HIGH-RISK" in res["primary_status"]

    # Segment 04 should be Umling Ridge with HIGH risk
    seg4 = next(s for s in res["segments"] if s["id"] == "04")
    assert seg4["risk_level"] == "HIGH"
    assert seg4["risk_score"] >= 61
    assert seg4["short_name"] == "Umling Ridge"
    assert any("rainfall" in r.lower() or "rain" in r.lower() for r in seg4["reasons"])
    assert any("slope" in r.lower() or "steep" in r.lower() for r in seg4["reasons"])
    assert seg4["recommended_action"] == "Review alternate route"

def test_dry_lowland_segment_evaluation(db_session):
    """Test dry lowland conditions with 0 rainfall."""
    res = AccessibilityEngine.evaluate_route_risk_segments(
        db=db_session,
        origin="Guwahati",
        destination="Tezpur",
        route_name="NH-27 Brahmaputra Basin",
        rainfall_mm_hr=0.0,
        dist_km=182.0,
        elev_gain_m=210.0
    )

    assert res["origin"] == "Guwahati"
    assert res["destination"] == "Tezpur"
    assert res["total_sections"] == 5
    # Normal segments should be low risk
    seg1 = next(s for s in res["segments"] if s["id"] == "01")
    assert seg1["risk_level"] == "LOW"
    assert seg1["risk_score"] <= 30

def test_highest_risk_segment_marking(db_session):
    """Verify that exactly one segment is marked as is_highest_risk."""
    res = AccessibilityEngine.evaluate_route_risk_segments(
        db=db_session,
        origin="Guwahati",
        destination="Silchar",
        route_name="NH-6 / NH-27 Barak Link",
        vuln_seg="Segment 05 — Sonapur Tunnel Sector",
        rainfall_mm_hr=22.0,
        dist_km=315.0,
        elev_gain_m=820.0
    )

    highest_flags = [s for s in res["segments"] if s["is_highest_risk"]]
    assert len(highest_flags) == 1
    assert highest_flags[0]["id"] == res["highest_risk_segment_id"]
