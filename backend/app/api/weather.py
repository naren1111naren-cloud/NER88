from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException, status
from app.services.weather_service import WeatherService
from app.schemas.schemas import (
    WeatherCurrentOut,
    WeatherForecastResponseOut,
    RouteWeatherAnalysisRequest,
    RouteWeatherAnalysisOut,
    GeocodingResultItem
)

router = APIRouter(prefix="/weather", tags=["Weather Intelligence Layer (Open-Meteo)"])

from typing import List, Optional, Union, Any

@router.get("", response_model=Union[WeatherForecastResponseOut, WeatherCurrentOut, List[WeatherCurrentOut]])
def get_weather_endpoint(
    latitude: Optional[float] = Query(None, description="GPS Latitude"),
    longitude: Optional[float] = Query(None, description="GPS Longitude"),
    lat: Optional[float] = Query(None, description="GPS Latitude alias"),
    lng: Optional[float] = Query(None, description="GPS Longitude alias"),
    lon: Optional[float] = Query(None, description="GPS Longitude alias"),
    name: Optional[str] = Query(None, description="Location / Hub Name"),
    location_name: Optional[str] = Query(None, description="Location / Hub Name alias"),
    days: int = Query(7, ge=1, le=7, description="Forecast days")
):
    """
    Primary Weather Endpoint:
    - If coordinates or location name are passed (e.g., /api/v1/weather?latitude=26.14&longitude=91.74),
      retrieves live Open-Meteo weather and forecast for that location.
    - If no parameters are passed, retrieves live weather across all NER strategic hubs.
    """
    actual_lat = latitude if latitude is not None else lat
    actual_lng = longitude if longitude is not None else (lng if lng is not None else lon)
    actual_name = location_name if location_name is not None else name

    if actual_lat is not None or actual_lng is not None or actual_name is not None:
        try:
            return WeatherService.get_forecast_for_location(
                location_name=actual_name,
                lat=actual_lat,
                lng=actual_lng,
                days=days
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        except RuntimeError as e:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Weather retrieval failed: {str(e)}")

    return WeatherService.get_all_ner_weather()

@router.get("/search", response_model=List[GeocodingResultItem])
def search_weather_locations(
    q: str = Query(..., min_length=1, description="Location search query (e.g. Gangtok, Aizawl, Shillong)"),
    count: int = Query(10, ge=1, le=20, description="Max results")
):
    """
    Searches locations dynamically using Open-Meteo Geocoding API without hardcoding.
    """
    try:
        return WeatherService.search_locations(query=q, count=count)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Location search failed: {str(e)}")

@router.get("/locations")
def get_supported_locations():
    """Returns pre-configured North Eastern monitoring hubs with geographic coordinates."""
    return WeatherService.get_supported_locations()

@router.get("/current", response_model=WeatherCurrentOut)
def get_current_weather(
    lat: Optional[float] = Query(None, description="GPS Latitude"),
    lng: Optional[float] = Query(None, description="GPS Longitude"),
    latitude: Optional[float] = Query(None, description="GPS Latitude alias"),
    longitude: Optional[float] = Query(None, description="GPS Longitude alias"),
    lon: Optional[float] = Query(None, description="GPS Longitude alias"),
    name: Optional[str] = Query(None, description="City / Hub Name"),
    location_name: Optional[str] = Query(None, description="City / Hub Name alias")
):
    """
    Fetches real-time Open-Meteo weather and calculates multi-factor logistics risk for given coordinates or location.
    """
    actual_lat = lat if lat is not None else latitude
    actual_lng = lng if lng is not None else (longitude if longitude is not None else lon)
    actual_name = name if name is not None else location_name

    try:
        return WeatherService.get_weather_for_location(location_name=actual_name, lat=actual_lat, lng=actual_lng)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal weather service error: {str(e)}")

@router.get("/forecast", response_model=WeatherForecastResponseOut)
def get_weather_forecast(
    lat: Optional[float] = Query(None, description="GPS Latitude"),
    lng: Optional[float] = Query(None, description="GPS Longitude"),
    latitude: Optional[float] = Query(None, description="GPS Latitude alias"),
    longitude: Optional[float] = Query(None, description="GPS Longitude alias"),
    lon: Optional[float] = Query(None, description="GPS Longitude alias"),
    location_name: Optional[str] = Query(None, description="City / Hub Name"),
    name: Optional[str] = Query(None, description="City / Hub Name alias"),
    days: int = Query(7, ge=1, le=7, description="Forecast horizon in days")
):
    """
    Retrieves multi-day and hourly meteorological forecast with risk trajectories from Open-Meteo.
    """
    actual_lat = lat if lat is not None else latitude
    actual_lng = lng if lng is not None else (longitude if longitude is not None else lon)
    actual_name = location_name if location_name is not None else name

    try:
        return WeatherService.get_forecast_for_location(location_name=actual_name, lat=actual_lat, lng=actual_lng, days=days)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal weather forecast error: {str(e)}")

@router.post("/route-risk", response_model=RouteWeatherAnalysisOut)
def analyze_route_weather_risk(payload: RouteWeatherAnalysisRequest):
    """
    Evaluates weather along transport corridor waypoints, identifying localized precipitation and wind bottlenecks.
    """
    try:
        return WeatherService.evaluate_route_weather_risk(
            origin=payload.origin,
            destination=payload.destination,
            corridor_code=payload.corridor_code,
            waypoints=payload.waypoints
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to evaluate corridor weather risk: {str(e)}")

@router.get("/{city_name}", response_model=WeatherCurrentOut)
def get_city_weather(city_name: str):
    """Retrieves live weather and risk assessment for a specific NER city or hub."""
    try:
        return WeatherService.get_weather_for_location(location_name=city_name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to retrieve weather for '{city_name}': {str(e)}")
