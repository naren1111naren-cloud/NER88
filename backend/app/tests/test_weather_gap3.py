import time
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.weather_service import (
    WeatherService,
    NER_LOCATIONS,
    WMO_WEATHER_CODES,
    _WEATHER_CACHE
)

client = TestClient(app)

MOCK_OPEN_METEO_RESPONSE = {
    "latitude": 26.1445,
    "longitude": 91.7362,
    "timezone": "Asia/Kolkata",
    "current": {
        "time": "2026-09-06T20:00",
        "temperature_2m": 27.5,
        "relative_humidity_2m": 85.0,
        "precipitation": 3.5,
        "rain": 3.5,
        "weather_code": 61,
        "wind_speed_10m": 12.0,
        "wind_direction_10m": 180.0
    },
    "hourly": {
        "time": [f"2026-09-06T{h:02d}:00" for h in range(24)],
        "temperature_2m": [26.0 - (h * 0.2) for h in range(24)],
        "relative_humidity_2m": [80.0 + (h * 0.5) for h in range(24)],
        "precipitation_probability": [40.0 for _ in range(24)],
        "precipitation": [2.0 if h % 3 == 0 else 0.5 for h in range(24)],
        "rain": [2.0 if h % 3 == 0 else 0.5 for h in range(24)],
        "weather_code": [61 if h % 3 == 0 else 2 for h in range(24)],
        "wind_speed_10m": [12.0 for _ in range(24)]
    },
    "daily": {
        "time": ["2026-09-06", "2026-09-07", "2026-09-08"],
        "weather_code": [61, 63, 2],
        "temperature_2m_max": [30.0, 29.5, 31.0],
        "temperature_2m_min": [22.0, 21.5, 23.0],
        "precipitation_sum": [15.0, 20.0, 5.0],
        "precipitation_probability_max": [75.0, 85.0, 35.0],
        "wind_speed_10m_max": [16.0, 18.0, 12.0]
    }
}

@pytest.fixture(autouse=True)
def clean_weather_cache():
    WeatherService.clear_cache()
    yield
    WeatherService.clear_cache()

def test_get_supported_locations():
    """Verify supported NER monitoring locations covers all 8 states."""
    res = client.get("/api/v1/weather/locations")
    assert res.status_code == 200
    locations = res.json()
    assert len(locations) >= 12
    states = {loc["state"] for loc in locations}
    expected_states = {"Assam", "Meghalaya", "Manipur", "Mizoram", "Nagaland", "Arunachal Pradesh", "Tripura", "Sikkim"}
    assert expected_states.issubset(states)
    for loc in locations:
        assert "location_name" in loc
        assert "latitude" in loc
        assert "longitude" in loc
        assert "elevation_m" in loc

@patch("app.services.weather_service._SESSION.get")
def test_get_all_ner_weather(mock_get):
    """Verify live meteorological data retrieval across major NER transport hubs with mocked API."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_OPEN_METEO_RESPONSE
    mock_get.return_value = mock_resp

    res = client.get("/api/v1/weather")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 10

    for item in data:
        assert "location_name" in item
        assert "temperature_c" in item
        assert "precipitation_mm" in item
        assert "weather_condition" in item
        assert "wind_speed_kmh" in item
        assert "weather_risk" in item
        assert item["is_live"] is True
        risk = item["weather_risk"]
        assert "total_score" in risk
        assert "category" in risk
        assert risk["category"] in ["LOW", "MODERATE", "HIGH", "SEVERE"]
        assert risk["total_score"] >= 0.0 and risk["total_score"] <= 100.0
        assert "logistics_impact" in risk
        assert item["data_source"] == "Open-Meteo"

@patch("app.services.weather_service._SESSION.get")
def test_get_current_weather_by_coords(mock_get):
    """Verify coordinate-based weather querying for specific GPS location."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_OPEN_METEO_RESPONSE
    mock_get.return_value = mock_resp

    res = client.get("/api/v1/weather/current?lat=25.5788&lng=91.8933&name=Shillong")
    assert res.status_code == 200
    data = res.json()
    assert data["location_name"] == "Shillong"
    assert data["state"] == "Meghalaya"
    assert round(data["latitude"], 2) == 25.58
    assert round(data["longitude"], 2) == 91.89
    assert "temperature_c" in data
    assert "weather_risk" in data
    assert data["data_source"] == "Open-Meteo"
    assert data["is_live"] is True

def test_weather_risk_engine_scoring_factors():
    """Verify 6-factor risk calculation across clear, moderate, and severe weather scenarios."""
    # Scenario A: Clear Sky, 0 rain, light wind
    clear_risk = WeatherService.calculate_weather_risk(
        precipitation_mm=0.0,
        precipitation_probability=10.0,
        wind_speed_kmh=8.0,
        temperature_c=25.0,
        weather_code=0
    )
    assert clear_risk["total_score"] <= 25.0
    assert clear_risk["category"] == "LOW"
    assert clear_risk["precipitation_risk"] == 0.0

    # Scenario B: Severe Thunderstorm with heavy rain (40 mm/hr, 90% prob, 45 km/h wind, code 95)
    severe_risk = WeatherService.calculate_weather_risk(
        precipitation_mm=40.0,
        precipitation_probability=95.0,
        wind_speed_kmh=45.0,
        temperature_c=22.0,
        weather_code=95,
        hourly_forecast_precip=[30.0, 25.0, 20.0, 15.0]
    )
    assert severe_risk["total_score"] >= 75.0
    assert severe_risk["category"] == "SEVERE"
    assert severe_risk["precipitation_risk"] == 35.0
    assert severe_risk["severe_weather_risk"] >= 15.0
    assert "Extreme weather alert" in severe_risk["logistics_impact"]

    # Scenario C: High Altitude Freezing Snow Pass (T = -2 C, code 75)
    freezing_risk = WeatherService.calculate_weather_risk(
        precipitation_mm=8.0,
        precipitation_probability=80.0,
        wind_speed_kmh=25.0,
        temperature_c=-2.0,
        weather_code=75
    )
    assert freezing_risk["temperature_risk"] == 10.0
    assert freezing_risk["total_score"] >= 45.0

@patch("app.services.weather_service._SESSION.get")
def test_weather_forecast_3days(mock_get):
    """Verify multi-day forecast and 24-hour hourly risk trajectory response."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_OPEN_METEO_RESPONSE
    mock_get.return_value = mock_resp

    res = client.get("/api/v1/weather/forecast?location_name=Gangtok&days=3")
    assert res.status_code == 200
    data = res.json()
    assert data["location_name"] == "Gangtok"
    assert len(data["hourly"]) >= 12
    assert len(data["daily"]) >= 3

    first_hour = data["hourly"][0]
    assert "time" in first_hour
    assert "temperature_c" in first_hour
    assert "hourly_risk_score" in first_hour
    assert "hourly_risk_category" in first_hour

    first_day = data["daily"][0]
    assert "date" in first_day
    assert "temperature_max_c" in first_day
    assert "precipitation_sum_mm" in first_day
    assert "daily_risk_category" in first_day

@patch("app.services.weather_service._SESSION.get")
def test_route_waypoint_weather_risk(mock_get):
    """Verify route waypoint sampling and corridor risk evaluation."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_OPEN_METEO_RESPONSE
    mock_get.return_value = mock_resp

    payload = {
        "origin": "Guwahati",
        "destination": "Imphal",
        "corridor_code": "COR-NH27",
        "waypoints": [
            [26.1445, 91.7362],
            [25.9060, 93.7273],
            [25.6751, 94.1086],
            [25.2676, 94.0210],
            [24.8170, 93.9368]
        ]
    }
    res = client.post("/api/v1/weather/route-risk", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["origin"] == "Guwahati"
    assert data["destination"] == "Imphal"
    assert "aggregate_weather_risk_score" in data
    assert "aggregate_weather_risk_category" in data
    assert "logistics_advisory" in data
    assert len(data["waypoint_assessments"]) >= 3

    for wp in data["waypoint_assessments"]:
        assert "nearest_hub" in wp
        assert "weather_risk_score" in wp
        assert "weather_condition" in wp

def test_gap3_scenario_1_normal_weather_low_risk():
    """TEST 1: Normal weather -> low weather risk (< 25)."""
    res = WeatherService.calculate_weather_risk(
        precipitation_mm=0.0,
        precipitation_probability=5.0,
        wind_speed_kmh=6.0,
        temperature_c=22.0,
        weather_code=0
    )
    assert res["category"] == "LOW"
    assert res["total_score"] < 25.0
    assert "Optimal logistics weather" in res["logistics_impact"] or "Favorable" in res["primary_threat"]

def test_gap3_scenario_2_increasing_precipitation_increasing_risk():
    """TEST 2: Increasing precipitation -> monotonically increasing risk."""
    score_dry = WeatherService.calculate_weather_risk(0.0, 10.0, 10.0, 24.0, 1)["total_score"]
    score_light = WeatherService.calculate_weather_risk(4.0, 50.0, 10.0, 24.0, 61)["total_score"]
    score_heavy = WeatherService.calculate_weather_risk(25.0, 85.0, 10.0, 24.0, 65)["total_score"]
    score_extreme = WeatherService.calculate_weather_risk(60.0, 95.0, 10.0, 24.0, 82)["total_score"]
    
    assert score_dry < score_light
    assert score_light < score_heavy
    assert score_heavy < score_extreme

def test_gap3_scenario_3_severe_weather_high_risk():
    """TEST 3: Severe weather conditions produce SEVERE/HIGH risk category."""
    res = WeatherService.calculate_weather_risk(
        precipitation_mm=55.0,
        precipitation_probability=95.0,
        wind_speed_kmh=50.0,
        temperature_c=20.0,
        weather_code=99,
        hourly_forecast_precip=[40.0, 30.0, 20.0, 15.0]
    )
    assert res["category"] == "SEVERE"
    assert res["total_score"] >= 75.0
    assert "Extreme weather alert" in res["logistics_impact"]

def test_gap3_scenario_4_score_bounds_validity():
    """TEST 4: Weather hazard score strictly remains within valid bounds [0.0, 100.0]."""
    min_res = WeatherService.calculate_weather_risk(0.0, 0.0, 0.0, 22.0, 0)
    assert min_res["total_score"] >= 0.0 and min_res["total_score"] <= 100.0
    
    max_res = WeatherService.calculate_weather_risk(200.0, 100.0, 150.0, -15.0, 99, [100.0, 100.0, 100.0])
    assert max_res["total_score"] == 100.0

@patch("app.services.weather_service._SESSION.get")
def test_gap3_scenario_5_waypoint_risk_calculation(mock_get):
    """TEST 5: Waypoint weather risk is calculated correctly along corridor coordinates."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_OPEN_METEO_RESPONSE
    mock_get.return_value = mock_resp

    wp_data = WeatherService.evaluate_route_weather_risk(
        origin="Guwahati",
        destination="Shillong",
        corridor_code="COR-NH40",
        waypoints=[[26.1445, 91.7362], [25.8616, 91.8147], [25.5788, 91.8933]]
    )
    assert len(wp_data["waypoint_assessments"]) >= 3
    assert wp_data["aggregate_weather_risk_score"] >= 0.0
    assert wp_data["aggregate_weather_risk_category"] in ["LOW", "MODERATE", "HIGH", "SEVERE"]

@patch("app.services.weather_service._SESSION.get")
def test_gap3_scenario_6_weather_affects_corridor_risk(mock_get):
    """TEST 6: Weather conditions affect corridor risk aggregation."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_OPEN_METEO_RESPONSE
    mock_get.return_value = mock_resp

    res = WeatherService.evaluate_route_weather_risk(
        origin="Siliguri",
        destination="Gangtok",
        corridor_code="COR-NH10"
    )
    assert "aggregate_weather_risk_score" in res
    assert "peak_precipitation_mm_hr" in res
    assert "logistics_advisory" in res

@patch("app.services.weather_service._SESSION.get")
def test_gap3_scenario_10_cached_weather_handled_correctly(mock_get):
    """TEST 10: Repeated queries within TTL reuse cached weather entry."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_OPEN_METEO_RESPONSE
    mock_get.return_value = mock_resp

    # First query fetches live
    w1 = WeatherService.get_weather_for_location(location_name="Kohima")
    assert mock_get.call_count == 1
    assert w1["is_cached"] is False
    assert w1["data_source"] == "Open-Meteo"

    # Immediate second query hits cache without calling network again
    w2 = WeatherService.get_weather_for_location(location_name="Kohima")
    assert mock_get.call_count == 1
    assert w2["is_cached"] is True
    assert w2["data_source"] == "Open-Meteo"

@patch("app.services.weather_service._SESSION.get")
def test_gap3_scenario_11_stale_weather_identified_correctly(mock_get):
    """TEST 11: Stale weather cache entries are transparently tagged when network fails."""
    # Seed cache key
    cache_key = "26.145_91.736_2"
    _WEATHER_CACHE[cache_key] = {
        "data": MOCK_OPEN_METEO_RESPONSE,
        "cached_at": time.time() - 2000.0 # Expired
    }
    # Simulate network failure
    mock_get.side_effect = Exception("Open-Meteo connection timeout")

    raw, src, is_cached, is_stale, conf = WeatherService._fetch_open_meteo_raw(26.1445, 91.7362, days=2)
    assert raw is not None
    assert is_stale is True
    assert is_cached is True
    assert src == "Open-Meteo (cached)"

@patch("app.services.weather_service._SESSION.get")
def test_weather_network_failure_no_cache_raises(mock_get):
    """Verify that when Open-Meteo fails and no cache exists, an error is raised (no fake data generated)."""
    mock_get.side_effect = Exception("Network unreachable")
    with pytest.raises(RuntimeError) as excinfo:
        WeatherService.get_weather_for_location(location_name="Aizawl")
    assert "temporarily unreachable" in str(excinfo.value)

def test_unknown_city_raises_404():
    """Verify unknown city name returns 404 rather than silently returning default city."""
    res = client.get("/api/v1/weather/UnknownCityXYZ")
    assert res.status_code == 404
    assert "Unknown NER location" in res.json()["detail"]

def test_wmo_weather_code_decoding():
    """Verify WMO weather codes decode properly."""
    assert WeatherService.decode_wmo_code(0)["condition"] == "Clear Sky"
    assert WeatherService.decode_wmo_code(65)["condition"] == "Heavy Monsoon Downpour"
    assert WeatherService.decode_wmo_code(95)["condition"] == "Severe Thunderstorm"
    assert WeatherService.decode_wmo_code(999)["condition"] == "Variable Meteorological Conditions"
