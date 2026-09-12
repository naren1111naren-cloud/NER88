import os
import time
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

from app.core.config import settings


logger = logging.getLogger("link_x8.weather")


# ============================================================
# OPEN-METEO CONFIGURATION
# ============================================================

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"

USER_AGENT = "LINK-X8-SIH2026/1.0"

DEFAULT_CACHE_TTL = 900  # 15 minutes


# ============================================================
# NER STRATEGIC LOCATIONS
# Static geographic reference data only.
# Weather values are NEVER stored here.
# ============================================================

NER_LOCATIONS: Dict[str, Dict[str, Any]] = {

    # Assam
    "Guwahati": {
        "state": "Assam",
        "lat": 26.1445,
        "lng": 91.7362,
        "elevation_m": 55,
        "is_hub": True
    },
    "Silchar": {
        "state": "Assam",
        "lat": 24.8333,
        "lng": 92.7789,
        "elevation_m": 25,
        "is_hub": True
    },
    "Dibrugarh": {
        "state": "Assam",
        "lat": 27.4728,
        "lng": 94.9120,
        "elevation_m": 108,
        "is_hub": True
    },
    "Tezpur": {
        "state": "Assam",
        "lat": 26.6338,
        "lng": 92.7926,
        "elevation_m": 48,
        "is_hub": False
    },
    "Jorhat": {
        "state": "Assam",
        "lat": 26.7509,
        "lng": 94.2037,
        "elevation_m": 116,
        "is_hub": False
    },
    "Nagaon": {
        "state": "Assam",
        "lat": 26.3467,
        "lng": 92.6840,
        "elevation_m": 60,
        "is_hub": False
    },

    # Meghalaya
    "Shillong": {
        "state": "Meghalaya",
        "lat": 25.5788,
        "lng": 91.8933,
        "elevation_m": 1525,
        "is_hub": True
    },
    "Cherrapunji": {
        "state": "Meghalaya",
        "lat": 25.2700,
        "lng": 91.7300,
        "elevation_m": 1430,
        "is_hub": False
    },
    "Tura": {
        "state": "Meghalaya",
        "lat": 25.5144,
        "lng": 90.2201,
        "elevation_m": 349,
        "is_hub": False
    },
    "Jowai": {
        "state": "Meghalaya",
        "lat": 25.4500,
        "lng": 92.2000,
        "elevation_m": 1380,
        "is_hub": False
    },

    # Manipur
    "Imphal": {
        "state": "Manipur",
        "lat": 24.8170,
        "lng": 93.9368,
        "elevation_m": 786,
        "is_hub": True
    },
    "Senapati": {
        "state": "Manipur",
        "lat": 25.2676,
        "lng": 94.0210,
        "elevation_m": 1410,
        "is_hub": True
    },
    "Churachandpur": {
        "state": "Manipur",
        "lat": 24.3333,
        "lng": 93.6667,
        "elevation_m": 922,
        "is_hub": False
    },
    "Jiribam": {
        "state": "Manipur",
        "lat": 24.8030,
        "lng": 93.1180,
        "elevation_m": 30,
        "is_hub": False
    },
    "Noney": {
        "state": "Manipur",
        "lat": 24.7500,
        "lng": 93.5000,
        "elevation_m": 650,
        "is_hub": False
    },

    # Mizoram
    "Aizawl": {
        "state": "Mizoram",
        "lat": 23.7271,
        "lng": 92.7176,
        "elevation_m": 1132,
        "is_hub": True
    },
    "Lunglei": {
        "state": "Mizoram",
        "lat": 22.8800,
        "lng": 92.7300,
        "elevation_m": 1222,
        "is_hub": False
    },
    "Serchhip": {
        "state": "Mizoram",
        "lat": 23.3411,
        "lng": 92.8500,
        "elevation_m": 882,
        "is_hub": False
    },
    "Kolasib": {
        "state": "Mizoram",
        "lat": 24.2244,
        "lng": 92.6789,
        "elevation_m": 620,
        "is_hub": False
    },

    # Nagaland
    "Kohima": {
        "state": "Nagaland",
        "lat": 25.6751,
        "lng": 94.1086,
        "elevation_m": 1444,
        "is_hub": True
    },
    "Dimapur": {
        "state": "Nagaland",
        "lat": 25.9060,
        "lng": 93.7273,
        "elevation_m": 145,
        "is_hub": True
    },
    "Mokokchung": {
        "state": "Nagaland",
        "lat": 26.3256,
        "lng": 94.5200,
        "elevation_m": 1325,
        "is_hub": False
    },

    # Arunachal Pradesh
    "Itanagar": {
        "state": "Arunachal Pradesh",
        "lat": 27.0844,
        "lng": 93.6053,
        "elevation_m": 320,
        "is_hub": True
    },
    "Tawang": {
        "state": "Arunachal Pradesh",
        "lat": 27.5861,
        "lng": 91.8594,
        "elevation_m": 3048,
        "is_hub": False
    },
    "Pasighat": {
        "state": "Arunachal Pradesh",
        "lat": 28.0667,
        "lng": 95.3333,
        "elevation_m": 155,
        "is_hub": False
    },

    # Tripura
    "Agartala": {
        "state": "Tripura",
        "lat": 23.8315,
        "lng": 91.2868,
        "elevation_m": 16,
        "is_hub": True
    },
    "Udaipur": {
        "state": "Tripura",
        "lat": 23.5333,
        "lng": 91.4833,
        "elevation_m": 22,
        "is_hub": False
    },

    # Sikkim
    "Gangtok": {
        "state": "Sikkim",
        "lat": 27.3389,
        "lng": 88.6065,
        "elevation_m": 1650,
        "is_hub": True
    },
    "Mangan": {
        "state": "Sikkim",
        "lat": 27.5167,
        "lng": 88.5333,
        "elevation_m": 1310,
        "is_hub": False
    },

    # Gateway Corridor Junction
    "Siliguri": {
        "state": "West Bengal",
        "lat": 26.7271,
        "lng": 88.3953,
        "elevation_m": 122,
        "is_hub": True
    }
}


# Backwards compatibility
NER_CITIES = NER_LOCATIONS


# ============================================================
# WMO WEATHER CODE MAPPING
# ============================================================

WMO_WEATHER_CODES: Dict[int, Dict[str, Any]] = {

    0: {
        "condition": "Clear Sky",
        "severity_factor": 0.0,
        "icon": "sun"
    },

    1: {
        "condition": "Mainly Clear",
        "severity_factor": 0.05,
        "icon": "sun-cloud"
    },

    2: {
        "condition": "Partly Cloudy",
        "severity_factor": 0.10,
        "icon": "cloud"
    },

    3: {
        "condition": "Overcast",
        "severity_factor": 0.15,
        "icon": "clouds"
    },

    45: {
        "condition": "Dense Mountain Fog",
        "severity_factor": 0.45,
        "icon": "fog"
    },

    48: {
        "condition": "Depositing Rime Fog",
        "severity_factor": 0.50,
        "icon": "fog"
    },

    51: {
        "condition": "Light Drizzle",
        "severity_factor": 0.20,
        "icon": "drizzle"
    },

    53: {
        "condition": "Moderate Drizzle",
        "severity_factor": 0.30,
        "icon": "drizzle"
    },

    55: {
        "condition": "Dense Drizzle",
        "severity_factor": 0.40,
        "icon": "drizzle"
    },

    56: {
        "condition": "Freezing Drizzle",
        "severity_factor": 0.65,
        "icon": "snow"
    },

    57: {
        "condition": "Dense Freezing Drizzle",
        "severity_factor": 0.80,
        "icon": "snow"
    },

    61: {
        "condition": "Slight Rain",
        "severity_factor": 0.30,
        "icon": "rain-light"
    },

    63: {
        "condition": "Moderate Rain",
        "severity_factor": 0.60,
        "icon": "rain-moderate"
    },

    65: {
        "condition": "Heavy Monsoon Downpour",
        "severity_factor": 0.85,
        "icon": "rain-heavy"
    },

    66: {
        "condition": "Light Freezing Rain",
        "severity_factor": 0.75,
        "icon": "snow"
    },

    67: {
        "condition": "Heavy Freezing Rain",
        "severity_factor": 0.95,
        "icon": "snow"
    },

    71: {
        "condition": "Slight Snow Fall",
        "severity_factor": 0.50,
        "icon": "snow"
    },

    73: {
        "condition": "Moderate Snow Fall",
        "severity_factor": 0.70,
        "icon": "snow"
    },

    75: {
        "condition": "Heavy Mountain Snow Fall",
        "severity_factor": 0.90,
        "icon": "snow"
    },

    77: {
        "condition": "Snow Grains",
        "severity_factor": 0.60,
        "icon": "snow"
    },

    80: {
        "condition": "Slight Rain Showers",
        "severity_factor": 0.35,
        "icon": "rain-shower"
    },

    81: {
        "condition": "Moderate Rain Showers",
        "severity_factor": 0.65,
        "icon": "rain-shower"
    },

    82: {
        "condition": "Violent Torrential Showers",
        "severity_factor": 0.90,
        "icon": "rain-shower"
    },

    85: {
        "condition": "Slight Snow Showers",
        "severity_factor": 0.55,
        "icon": "snow"
    },

    86: {
        "condition": "Heavy Snow Showers",
        "severity_factor": 0.85,
        "icon": "snow"
    },

    95: {
        "condition": "Severe Thunderstorm",
        "severity_factor": 0.85,
        "icon": "thunder"
    },

    96: {
        "condition": "Thunderstorm with Slight Hail",
        "severity_factor": 0.95,
        "icon": "thunder-hail"
    },

    99: {
        "condition": "Severe Thunderstorm with Heavy Hail",
        "severity_factor": 1.00,
        "icon": "thunder-hail"
    }
}


# ============================================================
# CACHE
# ============================================================

_WEATHER_CACHE: Dict[str, Dict[str, Any]] = {}


import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ============================================================
# HTTP SESSION
# ============================================================

def _get_http_session() -> requests.Session:

    session = requests.Session()
    ssl_verify = os.getenv("WEATHER_SSL_VERIFY", "false").strip().lower() in ("true", "1", "yes")
    session.verify = ssl_verify

    retries = Retry(
        total=2,
        connect=2,
        read=2,
        backoff_factor=0.3,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=frozenset(["GET"]),
        raise_on_status=False
    )

    adapter = HTTPAdapter(
        max_retries=retries,
        pool_connections=10,
        pool_maxsize=20
    )

    session.mount("https://", adapter)
    session.mount("http://", adapter)

    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "application/json"
    })

    return session


_SESSION = _get_http_session()


# ============================================================
# WEATHER SERVICE
# ============================================================

class WeatherService:

    # --------------------------------------------------------
    # CACHE
    # --------------------------------------------------------

    @staticmethod
    def clear_cache():
        _WEATHER_CACHE.clear()

    @staticmethod
    def _cache_ttl() -> int:

        try:
            value = getattr(
                settings,
                "WEATHER_CACHE_TTL_SECONDS",
                DEFAULT_CACHE_TTL
            )

            return max(0, int(value))

        except Exception:
            return DEFAULT_CACHE_TTL

    # --------------------------------------------------------
    # URL RESOLUTION
    # --------------------------------------------------------

    @staticmethod
    def _get_forecast_url() -> str:
        """
        Always resolves to the valid Open-Meteo forecast endpoint.

        Supported configuration:

        OPEN_METEO_FULL_URL=https://api.open-meteo.com/v1/forecast

        OR

        OPEN_METEO_BASE_URL=https://api.open-meteo.com
        """

        configured_full = getattr(
            settings,
            "OPEN_METEO_FULL_URL",
            None
        )

        configured_base = getattr(
            settings,
            "OPEN_METEO_BASE_URL",
            None
        )

        # Prefer a valid configured FULL URL
        if configured_full:

            full = str(configured_full).strip().rstrip("/")

            if full.endswith("/v1/forecast"):
                return full

            if full.endswith("/v1"):
                return f"{full}/forecast"

            if full == "https://api.open-meteo.com":
                return OPEN_METEO_FORECAST_URL

            # Prevent malformed URL such as:
            # https://api.open-meteo.com/forecast
            if "/v1/forecast" not in full:
                return f"{full}/v1/forecast"

            return full

        # Fall back to BASE URL
        if configured_base:

            base = str(configured_base).strip().rstrip("/")

            if base.endswith("/v1/forecast"):
                return base

            if base.endswith("/v1"):
                return f"{base}/forecast"

            return f"{base}/v1/forecast"

        # Guaranteed valid public Open-Meteo endpoint
        return OPEN_METEO_FORECAST_URL

    @staticmethod
    def _get_geocoding_url() -> str:

        configured = getattr(
            settings,
            "OPEN_METEO_GEOCODING_URL",
            None
        )

        if configured:
            return str(configured).strip().rstrip("/")

        return OPEN_METEO_GEOCODING_URL

    # --------------------------------------------------------
    # SUPPORTED LOCATIONS
    # --------------------------------------------------------

    @staticmethod
    def get_supported_locations() -> List[Dict[str, Any]]:

        return [
            {
                "location_name": name,
                "state": info["state"],
                "latitude": info["lat"],
                "longitude": info["lng"],
                "elevation_m": info["elevation_m"],
                "is_hub": info["is_hub"]
            }
            for name, info in NER_LOCATIONS.items()
        ]

    # --------------------------------------------------------
    # NEAREST HUB
    # --------------------------------------------------------

    @staticmethod
    def _find_nearest_hub(
        lat: float,
        lng: float
    ) -> Tuple[str, str]:

        closest_name = "Guwahati"
        closest_state = "Assam"

        min_dist_sq = float("inf")

        for name, info in NER_LOCATIONS.items():

            dist_sq = (
                (info["lat"] - lat) ** 2
                +
                (info["lng"] - lng) ** 2
            )

            if dist_sq < min_dist_sq:

                min_dist_sq = dist_sq
                closest_name = name
                closest_state = info["state"]

        return closest_name, closest_state

    # --------------------------------------------------------
    # WMO DECODER
    # --------------------------------------------------------

    @staticmethod
    def decode_wmo_code(code: int) -> Dict[str, Any]:

        return WMO_WEATHER_CODES.get(
            int(code),
            {
                "condition": "Variable Meteorological Conditions",
                "severity_factor": 0.25,
                "icon": "cloud"
            }
        )

    # --------------------------------------------------------
    # WEATHER RISK
    # --------------------------------------------------------

    @staticmethod
    def calculate_weather_risk(
        precipitation_mm: float,
        precipitation_probability: float,
        wind_speed_kmh: float,
        temperature_c: float,
        weather_code: int,
        hourly_forecast_precip: Optional[List[float]] = None
    ) -> Dict[str, Any]:

        precipitation_mm = max(
            0.0,
            float(precipitation_mm)
        )

        precipitation_probability = max(
            0.0,
            min(100.0, float(precipitation_probability))
        )

        wind_speed_kmh = max(
            0.0,
            float(wind_speed_kmh)
        )

        temperature_c = float(temperature_c)

        # ----------------------------------------------------
        # 1. PRECIPITATION
        # ----------------------------------------------------

        if precipitation_mm <= 1.0:

            precip_risk = precipitation_mm * 4.0

        elif precipitation_mm <= 5.0:

            precip_risk = (
                4.0
                +
                (precipitation_mm - 1.0) * 2.5
            )

        elif precipitation_mm <= 15.0:

            precip_risk = (
                14.0
                +
                (precipitation_mm - 5.0) * 1.2
            )

        elif precipitation_mm <= 35.0:

            precip_risk = (
                26.0
                +
                (precipitation_mm - 15.0) * 0.35
            )

        else:

            precip_risk = 35.0

        precip_risk = round(
            min(35.0, max(0.0, precip_risk)),
            1
        )

        # ----------------------------------------------------
        # 2. PRECIPITATION PROBABILITY
        # ----------------------------------------------------

        prob_risk = round(
            min(
                20.0,
                max(
                    0.0,
                    precipitation_probability / 100.0 * 20.0
                )
            ),
            1
        )

        # ----------------------------------------------------
        # 3. WIND
        # ----------------------------------------------------

        if wind_speed_kmh <= 15.0:

            wind_risk = (
                wind_speed_kmh / 15.0
            ) * 3.0

        elif wind_speed_kmh <= 35.0:

            wind_risk = (
                3.0
                +
                (
                    (wind_speed_kmh - 15.0)
                    /
                    20.0
                ) * 7.0
            )

        else:

            wind_risk = (
                10.0
                +
                min(
                    5.0,
                    (
                        (wind_speed_kmh - 35.0)
                        /
                        25.0
                    ) * 5.0
                )
            )

        wind_risk = round(
            min(15.0, max(0.0, wind_risk)),
            1
        )

        # ----------------------------------------------------
        # 4. WMO SEVERE WEATHER
        # ----------------------------------------------------

        wmo_info = WeatherService.decode_wmo_code(
            weather_code
        )

        severe_risk = round(
            wmo_info["severity_factor"] * 20.0,
            1
        )

        # ----------------------------------------------------
        # 5. TEMPERATURE
        # ----------------------------------------------------

        if temperature_c < 0.0:

            temp_risk = 10.0

        elif temperature_c <= 4.0:

            temp_risk = 6.0

        elif temperature_c >= 38.0:

            temp_risk = 4.0

        else:

            temp_risk = 0.0

        # ----------------------------------------------------
        # 6. FORECAST PERSISTENCE
        # ----------------------------------------------------

        persistence_risk = 0.0

        if (
            hourly_forecast_precip
            and
            len(hourly_forecast_precip) >= 4
        ):

            next_6h_sum = sum(
                float(x)
                for x in hourly_forecast_precip[:6]
                if x is not None
            )

            if next_6h_sum > 25.0:

                persistence_risk = 10.0

            elif next_6h_sum > 10.0:

                persistence_risk = 6.0

            elif next_6h_sum > 3.0:

                persistence_risk = 3.0

        # ----------------------------------------------------
        # TOTAL
        # ----------------------------------------------------

        total_score = round(
            min(
                100.0,
                precip_risk
                +
                prob_risk
                +
                wind_risk
                +
                severe_risk
                +
                temp_risk
                +
                persistence_risk
            ),
            1
        )

        if total_score >= 75.0:

            category = "SEVERE"

        elif total_score >= 50.0:

            category = "HIGH"

        elif total_score >= 25.0:

            category = "MODERATE"

        else:

            category = "LOW"

        # ----------------------------------------------------
        # THREATS
        # ----------------------------------------------------

        threats = []

        if precip_risk >= 20.0:

            threats.append(
                "Intense rainfall exposure"
            )

        if severe_risk >= 14.0:

            threats.append(
                f"Severe weather condition ({wmo_info['condition']})"
            )

        if wind_risk >= 9.0:

            threats.append(
                f"High wind speed ({wind_speed_kmh:.1f} km/h)"
            )

        if temp_risk >= 6.0:

            threats.append(
                f"Freezing conditions ({temperature_c:.1f}°C)"
            )

        if persistence_risk >= 6.0:

            threats.append(
                "Prolonged multi-hour rainfall"
            )

        if threats:

            primary_threat = threats[0]

        elif category == "LOW":

            primary_threat = (
                "Favorable road transport weather"
            )

        else:

            primary_threat = (
                "Moderate weather exposure"
            )

        # ----------------------------------------------------
        # LOGISTICS IMPACT
        # ----------------------------------------------------

        if category == "SEVERE":

            impact = (
                f"Extreme weather alert: Severe weather detected ({primary_threat}). "
                f"Mountain transport disruption risk is elevated. "
                f"Review route conditions before dispatch."
            )

        elif category == "HIGH":

            impact = (
                f"Elevated weather disruption risk: "
                f"{primary_threat}. "
                f"Reduced vehicle speeds and route monitoring recommended."
            )

        elif category == "MODERATE":

            impact = (
                f"Moderate meteorological exposure: "
                f"{wmo_info['condition']}. "
                f"Additional caution may be required on mountain corridors."
            )

        else:

            impact = (
                f"Optimal logistics weather: Low weather-related logistics risk "
                f"based on current meteorological observations ({primary_threat})."
            )

        return {
            "precipitation_risk": precip_risk,
            "probability_risk": prob_risk,
            "wind_risk": wind_risk,
            "severe_weather_risk": severe_risk,
            "temperature_risk": temp_risk,
            "persistence_risk": persistence_risk,
            "total_score": total_score,
            "category": category,
            "logistics_impact": impact,
            "primary_threat": primary_threat
        }

    # --------------------------------------------------------
    # GEOCODING
    # --------------------------------------------------------

    @staticmethod
    def search_locations(
        query: str,
        count: int = 10
    ) -> List[Dict[str, Any]]:

        if not query or not query.strip():
            return []

        clean_query = query.strip()

        geocoding_url = (
            WeatherService._get_geocoding_url()
        )

        params = {
            "name": clean_query,
            "count": max(
                1,
                min(20, int(count))
            ),
            "language": "en",
            "format": "json"
        }

        try:

            response = _SESSION.get(
                geocoding_url,
                params=params,
                timeout=(5, 15)
            )

            if response.status_code != 200:

                logger.warning(
                    "Open-Meteo geocoding HTTP %s for %s",
                    response.status_code,
                    clean_query
                )

                return WeatherService._catalog_location_search(
                    clean_query,
                    count
                )

            data = response.json()

            results = data.get(
                "results",
                []
            )

            formatted = []

            for item in results:

                latitude = item.get("latitude")
                longitude = item.get("longitude")

                if latitude is None or longitude is None:
                    continue

                formatted.append({
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "latitude": float(latitude),
                    "longitude": float(longitude),
                    "elevation": (
                        float(item["elevation"])
                        if item.get("elevation") is not None
                        else None
                    ),
                    "country_code": item.get(
                        "country_code"
                    ),
                    "country": item.get(
                        "country"
                    ),
                    "admin1": item.get(
                        "admin1"
                    ),
                    "admin2": item.get(
                        "admin2"
                    ),
                    "timezone": item.get(
                        "timezone",
                        "Asia/Kolkata"
                    )
                })

            return formatted

        except requests.RequestException as exc:

            logger.warning(
                "Open-Meteo geocoding request failed for '%s': %s",
                clean_query,
                exc
            )

        except ValueError as exc:

            logger.warning(
                "Open-Meteo geocoding returned invalid JSON for '%s': %s",
                clean_query,
                exc
            )

        except Exception:

            logger.exception(
                "Unexpected Open-Meteo geocoding error for '%s'",
                clean_query
            )

        return WeatherService._catalog_location_search(
            clean_query,
            count
        )

    @staticmethod
    def _catalog_location_search(
        query: str,
        count: int
    ) -> List[Dict[str, Any]]:

        matches = []

        query_lower = query.lower()

        for name, info in NER_LOCATIONS.items():

            if (
                query_lower in name.lower()
                or
                query_lower in info["state"].lower()
            ):

                matches.append({
                    "id": abs(hash(name)) % 1000000,
                    "name": name,
                    "latitude": info["lat"],
                    "longitude": info["lng"],
                    "elevation": info["elevation_m"],
                    "country_code": "IN",
                    "country": "India",
                    "admin1": info["state"],
                    "admin2": None,
                    "timezone": "Asia/Kolkata"
                })

        return matches[:count]

    # --------------------------------------------------------
    # RAW OPEN-METEO REQUEST
    # --------------------------------------------------------

    @staticmethod
    def _fetch_open_meteo_raw(
        lat: float,
        lng: float,
        days: int = 7
    ) -> Tuple[
        Optional[Dict[str, Any]],
        str,
        bool,
        bool,
        str
    ]:

        clamped_lat = max(
            -90.0,
            min(90.0, float(lat))
        )

        clamped_lng = max(
            -180.0,
            min(180.0, float(lng))
        )

        days = max(
            1,
            min(7, int(days))
        )

        cache_key = (
            f"{round(clamped_lat, 3)}_"
            f"{round(clamped_lng, 3)}_"
            f"{days}"
        )

        now_ts = time.time()

        # ----------------------------------------------------
        # CACHE HIT
        # ----------------------------------------------------

        if cache_key in _WEATHER_CACHE:

            cached_entry = _WEATHER_CACHE[
                cache_key
            ]

            age = (
                now_ts
                -
                cached_entry["cached_at"]
            )

            if age < WeatherService._cache_ttl():

                return (
                    cached_entry["data"],
                    "Open-Meteo",
                    True,
                    False,
                    "HIGH"
                )

        # ----------------------------------------------------
        # OPEN-METEO PARAMETERS
        # ----------------------------------------------------

        params = {

            "latitude": round(
                clamped_lat,
                4
            ),

            "longitude": round(
                clamped_lng,
                4
            ),

            "current": (
                "temperature_2m,"
                "relative_humidity_2m,"
                "apparent_temperature,"
                "precipitation,"
                "rain,"
                "showers,"
                "snowfall,"
                "weather_code,"
                "cloud_cover,"
                "pressure_msl,"
                "wind_speed_10m,"
                "wind_direction_10m,"
                "wind_gusts_10m"
            ),

            "hourly": (
                "temperature_2m,"
                "relative_humidity_2m,"
                "precipitation_probability,"
                "precipitation,"
                "rain,"
                "weather_code,"
                "wind_speed_10m,"
                "wind_gusts_10m,"
                "visibility,"
                "cloud_cover"
            ),

            "daily": (
                "weather_code,"
                "temperature_2m_max,"
                "temperature_2m_min,"
                "precipitation_sum,"
                "precipitation_probability_max,"
                "wind_speed_10m_max,"
                "wind_gusts_10m_max,"
                "sunrise,"
                "sunset"
            ),

            "timezone": "auto",

            "forecast_days": days
        }

        url = WeatherService._get_forecast_url()

        logger.info(
            "Requesting live Open-Meteo data: %s",
            url
        )

        logger.debug(
            "Open-Meteo coordinates: lat=%s lng=%s",
            clamped_lat,
            clamped_lng
        )

        # ----------------------------------------------------
        # HTTP REQUEST
        # ----------------------------------------------------

        try:

            response = _SESSION.get(
                url,
                params=params,
                timeout=(5, 20)
            )

            logger.info(
                "Open-Meteo response HTTP %s",
                response.status_code
            )

            # ------------------------------------------------
            # SUCCESS
            # ------------------------------------------------

            if response.status_code == 200:

                try:

                    data = response.json()

                except ValueError:

                    logger.error(
                        "Open-Meteo returned invalid JSON"
                    )

                    raise

                # Essential sections
                if not isinstance(data, dict):

                    logger.error(
                        "Open-Meteo response is not a JSON object"
                    )

                elif (
                    "current" in data
                    and
                    "hourly" in data
                    and
                    "daily" in data
                ):

                    _WEATHER_CACHE[
                        cache_key
                    ] = {
                        "data": data,
                        "cached_at": now_ts
                    }

                    return (
                        data,
                        "Open-Meteo",
                        False,
                        False,
                        "HIGH"
                    )

                else:

                    logger.error(
                        "Open-Meteo response missing required sections: %s",
                        list(data.keys())
                    )

            else:

                body = response.text[:500]

                logger.error(
                    "Open-Meteo HTTP %s: %s",
                    response.status_code,
                    body
                )

        # ----------------------------------------------------
        # TIMEOUT
        # ----------------------------------------------------

        except requests.exceptions.Timeout as exc:

            logger.error(
                "Open-Meteo timeout for (%s, %s): %s",
                clamped_lat,
                clamped_lng,
                exc
            )

        # ----------------------------------------------------
        # CONNECTION ERROR
        # ----------------------------------------------------

        except requests.exceptions.ConnectionError as exc:

            logger.error(
                "Open-Meteo connection error for (%s, %s): %s",
                clamped_lat,
                clamped_lng,
                exc
            )

        # ----------------------------------------------------
        # REQUEST ERROR
        # ----------------------------------------------------

        except requests.exceptions.RequestException as exc:

            logger.error(
                "Open-Meteo request error for (%s, %s): %s",
                clamped_lat,
                clamped_lng,
                exc
            )

        # ----------------------------------------------------
        # UNKNOWN ERROR
        # ----------------------------------------------------

        except Exception:

            logger.exception(
                "Unexpected Open-Meteo error for (%s, %s)",
                clamped_lat,
                clamped_lng
            )

        # ----------------------------------------------------
        # STALE CACHE
        # ----------------------------------------------------

        if cache_key in _WEATHER_CACHE:

            logger.warning(
                "Serving stale Open-Meteo cache for (%s, %s)",
                clamped_lat,
                clamped_lng
            )

            return (
                _WEATHER_CACHE[cache_key]["data"],
                "Open-Meteo (cached)",
                True,
                True,
                "MEDIUM"
            )

        # ----------------------------------------------------
        # NO DATA
        # ----------------------------------------------------

        return (
            None,
            "Open-Meteo (unavailable)",
            False,
            False,
            "NONE"
        )

    # --------------------------------------------------------
    # LOCATION RESOLUTION
    # --------------------------------------------------------

    @staticmethod
    def _resolve_location(
        location_name: Optional[str] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None
    ) -> Tuple[
        str,
        Optional[str],
        float,
        float
    ]:

        # ----------------------------------------------------
        # LOCATION NAME
        # ----------------------------------------------------

        if location_name:

            clean_name = location_name.strip()

            # Exact catalog match
            if clean_name in NER_LOCATIONS:

                info = NER_LOCATIONS[
                    clean_name
                ]

                return (
                    clean_name,
                    info["state"],
                    info["lat"],
                    info["lng"]
                )

            # Case-insensitive match
            matched = next(
                (
                    name
                    for name in NER_LOCATIONS
                    if name.lower()
                    ==
                    clean_name.lower()
                ),
                None
            )

            if matched:

                info = NER_LOCATIONS[
                    matched
                ]

                return (
                    matched,
                    info["state"],
                    info["lat"],
                    info["lng"]
                )

            # Custom location + coordinates
            if (
                lat is not None
                and
                lng is not None
            ):

                clamped_lat = max(
                    -90.0,
                    min(90.0, float(lat))
                )

                clamped_lng = max(
                    -180.0,
                    min(180.0, float(lng))
                )

                _, nearest_state = (
                    WeatherService._find_nearest_hub(
                        clamped_lat,
                        clamped_lng
                    )
                )

                return (
                    clean_name,
                    nearest_state,
                    clamped_lat,
                    clamped_lng
                )

            # Open-Meteo geocoding
            geo_results = (
                WeatherService.search_locations(
                    clean_name,
                    count=1
                )
            )

            if geo_results:

                top = geo_results[0]

                return (
                    top["name"],
                    top.get("admin1"),
                    top["latitude"],
                    top["longitude"]
                )

            raise ValueError(
                f"Unknown NER location '{location_name}'. "
                f"Use a supported NER location or provide GPS coordinates."
            )

        # ----------------------------------------------------
        # GPS COORDINATES
        # ----------------------------------------------------

        if (
            lat is not None
            and
            lng is not None
        ):

            clamped_lat = max(
                -90.0,
                min(90.0, float(lat))
            )

            clamped_lng = max(
                -180.0,
                min(180.0, float(lng))
            )

            nearest_name, nearest_state = (
                WeatherService._find_nearest_hub(
                    clamped_lat,
                    clamped_lng
                )
            )

            return (
                (
                    f"{clamped_lat:.3f}°N, "
                    f"{clamped_lng:.3f}°E "
                    f"({nearest_name})"
                ),
                nearest_state,
                clamped_lat,
                clamped_lng
            )

        # ----------------------------------------------------
        # DEFAULT NER MONITORING LOCATION
        # Static location only.
        # Weather is still fetched live.
        # ----------------------------------------------------

        info = NER_LOCATIONS[
            "Guwahati"
        ]

        return (
            "Guwahati",
            info["state"],
            info["lat"],
            info["lng"]
        )

    # --------------------------------------------------------
    # CURRENT WEATHER
    # --------------------------------------------------------

    @staticmethod
    def get_weather_for_location(
        location_name: Optional[str] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        db: Optional[Any] = None
    ) -> Dict[str, Any]:

        (
            resolved_name,
            resolved_state,
            resolved_lat,
            resolved_lng
        ) = WeatherService._resolve_location(
            location_name=location_name,
            lat=lat,
            lng=lng
        )

        (
            raw_data,
            source_label,
            is_cached,
            is_stale,
            confidence
        ) = WeatherService._fetch_open_meteo_raw(
            resolved_lat,
            resolved_lng,
            days=7
        )

        if not raw_data:

            raise RuntimeError(
                "Open-Meteo weather service is "
                f"temporarily unreachable for "
                f"'{resolved_name}' "
                f"({resolved_lat}, {resolved_lng}). "
                "No cached weather data is available."
            )

        current = raw_data.get(
            "current",
            {}
        )

        hourly = raw_data.get(
            "hourly",
            {}
        )

        # ----------------------------------------------------
        # Validate essential current fields
        # ----------------------------------------------------

        required_current_fields = [
            "temperature_2m",
            "relative_humidity_2m",
            "weather_code",
            "wind_speed_10m"
        ]

        missing_fields = [
            field
            for field in required_current_fields
            if current.get(field) is None
        ]

        if missing_fields:

            raise RuntimeError(
                "Open-Meteo returned incomplete current "
                f"weather data. Missing: {missing_fields}"
            )

        # ----------------------------------------------------
        # Current values
        # ----------------------------------------------------

        temp = float(
            current["temperature_2m"]
        )

        apparent_temp = float(
            current.get(
                "apparent_temperature",
                temp
            )
        )

        humidity = float(
            current["relative_humidity_2m"]
        )

        precip = float(
            current.get(
                "precipitation",
                0.0
            )
        )

        rain = float(
            current.get(
                "rain",
                0.0
            )
        )

        showers = float(
            current.get(
                "showers",
                0.0
            )
        )

        snowfall = float(
            current.get(
                "snowfall",
                0.0
            )
        )

        code = int(
            current["weather_code"]
        )

        cloud_cover = float(
            current.get(
                "cloud_cover",
                0.0
            )
        )

        pressure = float(
            current.get(
                "pressure_msl",
                0.0
            )
        )

        wind_spd = float(
            current["wind_speed_10m"]
        )

        wind_dir = float(
            current.get(
                "wind_direction_10m",
                0.0
            )
        )

        wind_gusts = float(
            current.get(
                "wind_gusts_10m",
                wind_spd
            )
        )

        # ----------------------------------------------------
        # Visibility
        # Open-Meteo gives visibility in meters.
        # ----------------------------------------------------

        hourly_vis = hourly.get(
            "visibility",
            []
        )

        if hourly_vis:

            raw_vis_m = float(
                hourly_vis[0]
            )

            vis_km = round(
                raw_vis_m / 1000.0,
                1
            )

        else:

            vis_km = None

        # ----------------------------------------------------
        # Precipitation probability
        # ----------------------------------------------------

        hourly_prob = hourly.get(
            "precipitation_probability",
            []
        )

        if hourly_prob:

            current_prob = float(
                hourly_prob[0]
            )

        else:

            current_prob = 0.0

        # ----------------------------------------------------
        # WMO
        # ----------------------------------------------------

        wmo = WeatherService.decode_wmo_code(
            code
        )

        # ----------------------------------------------------
        # Forecast precipitation
        # ----------------------------------------------------

        hourly_precip = [
            float(value)
            for value in hourly.get(
                "precipitation",
                []
            )[:12]
            if value is not None
        ]

        # ----------------------------------------------------
        # Logistics risk
        # ----------------------------------------------------

        risk_breakdown = (
            WeatherService.calculate_weather_risk(
                precipitation_mm=precip,
                precipitation_probability=current_prob,
                wind_speed_kmh=wind_spd,
                temperature_c=temp,
                weather_code=code,
                hourly_forecast_precip=hourly_precip
            )
        )

        # ----------------------------------------------------
        # Operational alert
        # ----------------------------------------------------

        if (
            db is not None
            and
            risk_breakdown["category"]
            in ["SEVERE", "HIGH"]
        ):

            try:

                from app.models.models import Alert

                alert_title = (
                    f"SEVERE WEATHER ADVISORY: "
                    f"{resolved_name.upper()} "
                    f"({risk_breakdown['category']} RISK)"
                )

                existing = (
                    db.query(Alert)
                    .filter(
                        Alert.alert_type
                        ==
                        "WEATHER_DISRUPTION",

                        Alert.location.ilike(
                            f"%{resolved_name}%"
                        ),

                        Alert.is_read == False
                    )
                    .first()
                )

                if not existing:

                    db.add(
                        Alert(
                            alert_type=(
                                "WEATHER_DISRUPTION"
                            ),

                            title=alert_title,

                            message=(
                                risk_breakdown[
                                    "logistics_impact"
                                ]
                                +
                                f" Current precipitation: "
                                f"{precip} mm."
                                +
                                f" Wind: "
                                f"{wind_spd} km/h."
                            ),

                            severity=(
                                "CRITICAL"
                                if
                                risk_breakdown[
                                    "category"
                                ]
                                ==
                                "SEVERE"
                                else
                                "HIGH"
                            ),

                            location=(
                                f"{resolved_name} "
                                f"({resolved_state})"
                            ),

                            recommended_action=(
                                "Review affected "
                                "transport corridors "
                                "and monitor weather "
                                "conditions."
                            ),

                            is_read=False
                        )
                    )

                    db.commit()

            except Exception:

                logger.exception(
                    "Failed to create weather alert"
                )

        # ----------------------------------------------------
        # Metadata
        # ----------------------------------------------------

        now = datetime.now(
            timezone.utc
        )

        timezone_str = raw_data.get(
            "timezone",
            "Asia/Kolkata"
        )

        is_live_flag = not is_stale

        updated_at = current.get(
            "time"
        )

        if not updated_at:

            updated_at = now.isoformat()

        # ----------------------------------------------------
        # Response
        # ----------------------------------------------------

        return {

            "location_name": resolved_name,

            "state": resolved_state,

            "latitude": resolved_lat,

            "longitude": resolved_lng,

            "temperature_c": temp,

            "apparent_temperature_c": apparent_temp,

            "feels_like_c": apparent_temp,

            "relative_humidity_percent": humidity,

            "precipitation_mm": precip,

            "rain_mm": rain,

            "showers_mm": showers,

            "snowfall_cm": snowfall,

            "weather_code": code,

            "weather_condition": wmo["condition"],

            "cloud_cover_percent": cloud_cover,

            "pressure_msl_hpa": pressure,

            "wind_speed_kmh": wind_spd,

            "wind_direction_deg": wind_dir,

            "wind_gusts_kmh": wind_gusts,

            "visibility_km": vis_km,

            "weather_risk": risk_breakdown,

            "data_source": source_label,

            "data_confidence": confidence,

            "is_live": is_live_flag,

            "is_cached": is_cached,

            "is_stale": is_stale,

            "timezone": timezone_str,

            "rainfall_mm_hr": precip,

            "precipitation_probability": current_prob,

            "condition": wmo["condition"],

            "wind_kmh": wind_spd,

            "humidity_percent": humidity,

            "updated_at": updated_at,

            "observed_at": now,

            "fetched_at": now
        }

    # --------------------------------------------------------
    # FORECAST
    # --------------------------------------------------------

    @staticmethod
    def get_forecast_for_location(
        location_name: Optional[str] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        days: int = 7
    ) -> Dict[str, Any]:

        (
            resolved_name,
            resolved_state,
            resolved_lat,
            resolved_lng
        ) = WeatherService._resolve_location(
            location_name=location_name,
            lat=lat,
            lng=lng
        )

        (
            raw_data,
            source_label,
            is_cached,
            is_stale,
            confidence
        ) = WeatherService._fetch_open_meteo_raw(
            resolved_lat,
            resolved_lng,
            days=days
        )

        if not raw_data:

            raise RuntimeError(
                "Open-Meteo forecast service is "
                f"currently unavailable for "
                f"'{resolved_name}'."
            )

        # ----------------------------------------------------
        # Current weather
        # ----------------------------------------------------

        current_res = (
            WeatherService.get_weather_for_location(
                location_name=resolved_name,
                lat=resolved_lat,
                lng=resolved_lng
            )
        )

        hourly_raw = raw_data.get(
            "hourly",
            {}
        )

        daily_raw = raw_data.get(
            "daily",
            {}
        )

        # ----------------------------------------------------
        # HOURLY
        # ----------------------------------------------------

        hourly_items = []

        times = hourly_raw.get(
            "time",
            []
        )

        temps = hourly_raw.get(
            "temperature_2m",
            []
        )

        precips = hourly_raw.get(
            "precipitation",
            []
        )

        rains = hourly_raw.get(
            "rain",
            []
        )

        probs = hourly_raw.get(
            "precipitation_probability",
            []
        )

        codes = hourly_raw.get(
            "weather_code",
            []
        )

        winds = hourly_raw.get(
            "wind_speed_10m",
            []
        )

        gusts = hourly_raw.get(
            "wind_gusts_10m",
            []
        )

        visibilities = hourly_raw.get(
            "visibility",
            []
        )

        clouds = hourly_raw.get(
            "cloud_cover",
            []
        )

        max_h = min(
            24,
            len(times)
        )

        for i in range(max_h):

            if i >= len(temps):
                continue

            h_temp = float(
                temps[i]
            )

            h_precip = (
                float(precips[i])
                if i < len(precips)
                else 0.0
            )

            h_rain = (
                float(rains[i])
                if i < len(rains)
                else 0.0
            )

            h_prob = (
                float(probs[i])
                if i < len(probs)
                else 0.0
            )

            h_code = (
                int(codes[i])
                if i < len(codes)
                else 0
            )

            h_wind = (
                float(winds[i])
                if i < len(winds)
                else 0.0
            )

            h_gust = (
                float(gusts[i])
                if i < len(gusts)
                else h_wind
            )

            h_vis_m = (
                float(visibilities[i])
                if i < len(visibilities)
                else None
            )

            h_cloud = (
                float(clouds[i])
                if i < len(clouds)
                else 0.0
            )

            h_wmo = (
                WeatherService.decode_wmo_code(
                    h_code
                )
            )

            h_risk = (
                WeatherService.calculate_weather_risk(
                    precipitation_mm=h_precip,
                    precipitation_probability=h_prob,
                    wind_speed_kmh=h_wind,
                    temperature_c=h_temp,
                    weather_code=h_code
                )
            )

            hourly_item = {

                "time": times[i],

                "temperature_c": h_temp,

                "precipitation_mm": h_precip,

                "rain_mm": h_rain,

                "precipitation_probability": h_prob,

                "weather_code": h_code,

                "weather_condition": (
                    h_wmo["condition"]
                ),

                "condition": (
                    h_wmo["condition"]
                ),

                "wind_speed_kmh": h_wind,

                "wind_kmh": h_wind,

                "wind_gusts_kmh": h_gust,

                "visibility_km": (
                    round(
                        h_vis_m / 1000.0,
                        1
                    )
                    if h_vis_m is not None
                    else None
                ),

                "cloud_cover_percent": h_cloud,

                "hourly_risk_score": (
                    h_risk["total_score"]
                ),

                "hourly_risk_category": (
                    h_risk["category"]
                )
            }

            hourly_items.append(
                hourly_item
            )

        # ----------------------------------------------------
        # DAILY
        # ----------------------------------------------------

        daily_items = []

        d_times = daily_raw.get(
            "time",
            []
        )

        d_tmax = daily_raw.get(
            "temperature_2m_max",
            []
        )

        d_tmin = daily_raw.get(
            "temperature_2m_min",
            []
        )

        d_psum = daily_raw.get(
            "precipitation_sum",
            []
        )

        d_pprob = daily_raw.get(
            "precipitation_probability_max",
            []
        )

        d_wmax = daily_raw.get(
            "wind_speed_10m_max",
            []
        )

        d_gmax = daily_raw.get(
            "wind_gusts_10m_max",
            []
        )

        d_sunrises = daily_raw.get(
            "sunrise",
            []
        )

        d_sunsets = daily_raw.get(
            "sunset",
            []
        )

        d_codes = daily_raw.get(
            "weather_code",
            []
        )

        for i in range(
            len(d_times)
        ):

            if i >= len(d_tmax):
                continue

            code = (
                int(d_codes[i])
                if i < len(d_codes)
                else 0
            )

            wmo = (
                WeatherService.decode_wmo_code(
                    code
                )
            )

            psum = (
                float(d_psum[i])
                if i < len(d_psum)
                else 0.0
            )

            pprob = (
                float(d_pprob[i])
                if i < len(d_pprob)
                else 0.0
            )

            # Calculated category from real forecast
            if (
                psum > 35.0
                or
                pprob > 80.0
            ):

                d_risk_cat = "SEVERE"

            elif (
                psum > 15.0
                or
                pprob > 60.0
            ):

                d_risk_cat = "HIGH"

            elif (
                psum > 5.0
                or
                pprob > 40.0
            ):

                d_risk_cat = "MODERATE"

            else:

                d_risk_cat = "LOW"

            daily_items.append({

                "date": d_times[i],

                "temperature_max_c": (
                    float(d_tmax[i])
                ),

                "temperature_min_c": (
                    float(d_tmin[i])
                    if i < len(d_tmin)
                    else None
                ),

                "precipitation_sum_mm": psum,

                "precipitation_probability_max": (
                    pprob
                ),

                "max_wind_speed_kmh": (
                    float(d_wmax[i])
                    if i < len(d_wmax)
                    else None
                ),

                "wind_gusts_max_kmh": (
                    float(d_gmax[i])
                    if i < len(d_gmax)
                    else None
                ),

                "sunrise": (
                    d_sunrises[i]
                    if i < len(d_sunrises)
                    else None
                ),

                "sunset": (
                    d_sunsets[i]
                    if i < len(d_sunsets)
                    else None
                ),

                "weather_code": code,

                "weather_condition": (
                    wmo["condition"]
                ),

                "daily_risk_category": (
                    d_risk_cat
                )
            })

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        now = datetime.now(
            timezone.utc
        )

        timezone_str = raw_data.get(
            "timezone",
            "Asia/Kolkata"
        )

        return {

            "location_name": resolved_name,

            "state": resolved_state,

            "latitude": resolved_lat,

            "longitude": resolved_lng,

            "current": current_res,

            "hourly": hourly_items,

            "daily": daily_items,

            "data_source": source_label,

            "is_live": not is_stale,

            "is_cached": is_cached,

            "is_stale": is_stale,

            "data_confidence": confidence,

            "timezone": timezone_str,

            "last_updated": now
        }

    # --------------------------------------------------------
    # ALL NER WEATHER
    # --------------------------------------------------------

    @staticmethod
    def get_all_ner_weather() -> List[Dict[str, Any]]:

        results = []

        for name in NER_LOCATIONS.keys():

            try:

                result = (
                    WeatherService.get_weather_for_location(
                        location_name=name
                    )
                )

                results.append(result)

            except Exception as exc:

                logger.error(
                    "Failed to fetch weather for %s: %s",
                    name,
                    exc
                )

        return results

    # --------------------------------------------------------
    # ROUTE WEATHER RISK
    # --------------------------------------------------------

    @staticmethod
    def evaluate_route_weather_risk(
        origin: str,
        destination: str,
        corridor_code: Optional[str] = None,
        waypoints: Optional[
            List[List[float]]
        ] = None
    ) -> Dict[str, Any]:

        # ----------------------------------------------------
        # Waypoints are expected from the routing engine.
        # ----------------------------------------------------

        if not waypoints:

            try:
                _, _, o_lat, o_lng = WeatherService._resolve_location(location_name=origin)
            except Exception:
                raise ValueError(f"Unknown origin location: {origin}")

            try:
                _, _, d_lat, d_lng = WeatherService._resolve_location(location_name=destination)
            except Exception:
                raise ValueError(f"Unknown destination location: {destination}")

            mid_lat = (o_lat + d_lat) / 2.0
            mid_lng = (o_lng + d_lng) / 2.0

            waypoints = [
                [o_lat, o_lng],
                [mid_lat, mid_lng],
                [d_lat, d_lng]
            ]

        # ----------------------------------------------------
        # Sample maximum 6 points
        # ----------------------------------------------------

        step = max(
            1,
            len(waypoints) // 5
        )

        sampled_pts = (
            waypoints[::step]
        )

        if (
            waypoints[-1]
            not in sampled_pts
        ):

            sampled_pts.append(
                waypoints[-1]
            )

        assessments = []

        risk_scores = []

        peak_precip = 0.0

        peak_wind = 0.0

        severe_count = 0

        # ----------------------------------------------------
        # Query Open-Meteo for every route sample
        # ----------------------------------------------------

        for idx, point in enumerate(
            sampled_pts
        ):

            if (
                not isinstance(point, (list, tuple))
                or
                len(point) < 2
            ):

                continue

            try:

                point_lat = float(
                    point[0]
                )

                point_lng = float(
                    point[1]
                )

                weather = (
                    WeatherService.get_weather_for_location(
                        lat=point_lat,
                        lng=point_lng
                    )
                )

            except Exception as exc:

                logger.warning(
                    "Route weather query failed "
                    "for waypoint %s: %s",
                    point,
                    exc
                )

                continue

            weather_risk = (
                weather["weather_risk"]
            )

            score = float(
                weather_risk["total_score"]
            )

            risk_scores.append(
                score
            )

            peak_precip = max(
                peak_precip,
                float(
                    weather[
                        "precipitation_mm"
                    ]
                )
            )

            peak_wind = max(
                peak_wind,
                float(
                    weather[
                        "wind_speed_kmh"
                    ]
                )
            )

            if (
                weather_risk["category"]
                in
                ["HIGH", "SEVERE"]
            ):

                severe_count += 1

            assessments.append({

                "waypoint_index": idx,

                "latitude": point_lat,

                "longitude": point_lng,

                "nearest_hub": (
                    weather["location_name"]
                ),

                "temperature_c": (
                    weather["temperature_c"]
                ),

                "precipitation_mm": (
                    weather["precipitation_mm"]
                ),

                "precipitation_probability": (
                    weather[
                        "precipitation_probability"
                    ]
                ),

                "weather_condition": (
                    weather[
                        "weather_condition"
                    ]
                ),

                "wind_speed_kmh": (
                    weather[
                        "wind_speed_kmh"
                    ]
                ),

                "weather_risk_score": score,

                "weather_risk_category": (
                    weather_risk[
                        "category"
                    ]
                ),

                "primary_threat": (
                    weather_risk[
                        "primary_threat"
                    ]
                )
            })

        # ----------------------------------------------------
        # No weather data
        # ----------------------------------------------------

        if not risk_scores:

            raise RuntimeError(
                "Unable to retrieve live weather "
                "data for any route waypoint."
            )

        # ----------------------------------------------------
        # Aggregate risk
        # ----------------------------------------------------

        avg_score = round(
            sum(risk_scores)
            /
            len(risk_scores),
            1
        )

        max_score = max(
            risk_scores
        )

        aggregate_score = round(
            (
                0.6 * max_score
                +
                0.4 * avg_score
            ),
            1
        )

        # ----------------------------------------------------
        # Classification
        # ----------------------------------------------------

        if aggregate_score >= 75.0:

            aggregate_category = (
                "SEVERE"
            )

            advisory = (
                "Severe weather conditions "
                "detected along the corridor. "
                f"Peak precipitation: "
                f"{peak_precip:.1f} mm. "
                "Review transport conditions "
                "before dispatch."
            )

        elif aggregate_score >= 50.0:

            aggregate_category = (
                "HIGH"
            )

            advisory = (
                "Elevated weather-related "
                "risk detected along the "
                "corridor. "
                f"{severe_count} sensitive "
                "weather sectors identified."
            )

        elif aggregate_score >= 25.0:

            aggregate_category = (
                "MODERATE"
            )

            advisory = (
                "Moderate meteorological "
                "exposure along the corridor. "
                f"Peak precipitation: "
                f"{peak_precip:.1f} mm. "
                f"Peak wind: "
                f"{peak_wind:.1f} km/h."
            )

        else:

            aggregate_category = (
                "LOW"
            )

            advisory = (
                "Low weather-related "
                "transport risk based on "
                "current Open-Meteo data."
            )

        now = datetime.now(
            timezone.utc
        )

        return {

            "origin": origin,

            "destination": destination,

            "corridor_code": corridor_code,

            "aggregate_weather_risk_score": (
                aggregate_score
            ),

            "aggregate_weather_risk_category": (
                aggregate_category
            ),

            "peak_precipitation_mm_hr": (
                peak_precip
            ),

            "peak_wind_speed_kmh": (
                peak_wind
            ),

            "severe_weather_count": (
                severe_count
            ),

            "logistics_advisory": advisory,

            "waypoint_assessments": (
                assessments
            ),

            "data_source": "Open-Meteo",

            "evaluated_at": now
        }