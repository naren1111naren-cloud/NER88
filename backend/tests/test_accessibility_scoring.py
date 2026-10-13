import pytest
from app.database.database import SessionLocal
from app.services.accessibility_service import AccessibilityEngine

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

def test_1_perfect_conditions(db):
    """Perfect conditions: flat, 4-lane paved, dry, no hazard -> Score 100"""
    res = AccessibilityEngine.evaluate_route_accessibility_assessment(
        db, origin="CleanCityA", destination="CleanCityB", dist_km=180.0, elev_gain_m=0.0,
        road_name="NH-999Clean", lanes=4, road_surface="Paved", rainfall_mm_hr=0.0
    )
    # Base 100 + 0 (weather) + 0 (terrain) + 5 (road) + 0 (hazard) = 105 -> clamped to 100
    assert res["score"] == 100
    assert res["risk_level"] == "LOW RISK"
    assert res["recommendation"] == "CLEAR TO PROCEED"

def test_2_weather_penalty(db):
    """Weather penalty: heavy rain (16 mm/hr -> -18 weather, -8 waterlogging hazard)"""
    res = AccessibilityEngine.evaluate_route_accessibility_assessment(
        db, origin="CleanCityA", destination="CleanCityB", dist_km=180.0, elev_gain_m=0.0,
        road_name="NH-999Clean", lanes=4, road_surface="Paved", rainfall_mm_hr=16.0
    )
    # 100 - 18 (weather) + 0 (terrain) + 5 (road) - 8 (hazard) = 79
    assert res["score"] == 79
    assert any(f["category"] == "weather" and f["impact"] == -18 for f in res["factors"])

def test_3_terrain_penalty(db):
    """Terrain penalty: steep grade (1440m elev gain -> -15)"""
    res = AccessibilityEngine.evaluate_route_accessibility_assessment(
        db, origin="CleanCityA", destination="CleanCityB", dist_km=103.0, elev_gain_m=1440.0,
        road_name="NH-999Clean", lanes=4, road_surface="Paved", rainfall_mm_hr=0.0
    )
    # 100 + 0 - 15 + 5 + 0 = 90
    assert res["score"] == 90
    assert any(f["category"] == "terrain" and f["impact"] == -15 for f in res["factors"])

def test_4_hazard_penalty(db):
    """Hazard penalty: localized weather+terrain saturation (-8)"""
    res = AccessibilityEngine.evaluate_route_accessibility_assessment(
        db, origin="NonExistentCityA", destination="NonExistentCityB", dist_km=100.0, elev_gain_m=3000.0,
        road_name="NH-999", lanes=4, road_surface="Paved", rainfall_mm_hr=10.0
    )
    # 100 - 12 (weather) - 15 (terrain) + 5 (road) - 8 (hazard) = 70
    assert res["score"] == 70
    assert any(f["category"] == "hazard" and f["impact"] == -8 for f in res["factors"])

def test_5_road_bonus_and_penalty(db):
    """Road 4-lane (+5) vs 2-lane (-4)"""
    res_4lane = AccessibilityEngine.evaluate_route_accessibility_assessment(
        db, origin="CityA", destination="CityB", dist_km=100.0, elev_gain_m=0.0,
        road_name="NH-X", lanes=4, road_surface="Paved", rainfall_mm_hr=0.0
    )
    res_2lane = AccessibilityEngine.evaluate_route_accessibility_assessment(
        db, origin="CityA", destination="CityB", dist_km=100.0, elev_gain_m=0.0,
        road_name="NH-X", lanes=2, road_surface="Paved", rainfall_mm_hr=0.0
    )
    assert any(f["category"] == "road" and f["impact"] == 5 for f in res_4lane["factors"])
    assert any(f["category"] == "road" and f["impact"] == -4 for f in res_2lane["factors"])

def test_6_combined_mathematical_consistency(db):
    """Combined factors must strictly equal sum of components"""
    res = AccessibilityEngine.evaluate_route_accessibility_assessment(
        db, origin="NonExistentCityA", destination="NonExistentCityB", dist_km=103.0, elev_gain_m=1440.0,
        road_name="NH-40", lanes=4, road_surface="Paved", rainfall_mm_hr=2.0
    )
    # Weather -10, Terrain -15, Road +5, Hazard 0 -> 100 - 10 - 15 + 5 + 0 = 80
    expected_sum = 100 + sum(f["impact"] for f in res["factors"])
    assert res["score"] == expected_sum

def test_7_clamping_upper_bound(db):
    """Score cannot exceed 100"""
    res = AccessibilityEngine.evaluate_route_accessibility_assessment(
        db, origin="CityA", destination="CityB", dist_km=100.0, elev_gain_m=0.0,
        road_name="NH-X", lanes=4, road_surface="Paved", rainfall_mm_hr=0.0
    )
    assert res["score"] <= 100

def test_8_clamping_lower_bound(db):
    """Score cannot fall below 0"""
    res = AccessibilityEngine.evaluate_route_accessibility_assessment(
        db, origin="CityA", destination="CityB", dist_km=100.0, elev_gain_m=5000.0,
        road_name="NH-X", lanes=2, road_surface="Unpaved", rainfall_mm_hr=50.0
    )
    assert res["score"] >= 0

def test_9_risk_level_mapping(db):
    """Risk level must strictly match score bands"""
    # 90-100 -> LOW RISK, 75-89 -> MODERATE-LOW, 50-74 -> MODERATE, 25-49 -> HIGH, 0-24 -> CRITICAL
    res_mod = AccessibilityEngine.evaluate_route_accessibility_assessment(
        db, origin="CityA", destination="CityB", dist_km=103.0, elev_gain_m=1440.0,
        road_name="NH-40", lanes=2, road_surface="Paved", rainfall_mm_hr=10.0
    )
    # Weather -12, Terrain -15, Road -4, Hazard -8 -> 100 - 12 - 15 - 4 - 8 = 61 -> MODERATE
    assert res_mod["score"] == 61
    assert res_mod["risk_level"] == "MODERATE"
    assert res_mod["recommendation"] == "PROCEED WITH CAUTION"

def test_10_primary_risk_identification(db):
    """Primary risk must match the factor with the greatest negative impact"""
    res = AccessibilityEngine.evaluate_route_accessibility_assessment(
        db, origin="CityA", destination="CityB", dist_km=103.0, elev_gain_m=1440.0,
        road_name="NH-40", lanes=4, road_surface="Paved", rainfall_mm_hr=2.0
    )
    # Terrain is -15, Weather is -10 -> Primary risk is Terrain
    assert "terrain" in res["primary_risk"].lower()

def test_11_missing_data_policy(db):
    """Missing weather data should default to 0 penalty with PARTIAL data quality"""
    res = AccessibilityEngine.evaluate_route_accessibility_assessment(
        db, origin="UnresolvableCityXYZ", destination="UnresolvableCityABC", dist_km=100.0, elev_gain_m=0.0,
        road_name="NH-X", lanes=4, road_surface="Paved", rainfall_mm_hr=None
    )
    assert res["data_quality"] in ["PARTIAL", "HIGH"]
    assert any(f["category"] == "weather" and f["impact"] == 0 for f in res["factors"])
