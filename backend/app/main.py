import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure python path can find ml package
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.core.config import settings
from app.database.seed import seed_database
from app.api import (
    auth, dashboard, vehicles, deliveries, routes,
    incidents, alerts, weather, field_reports, analytics,
    audit_logs, user_management, settings as system_settings, ml, demo,
    corridors, districts, accessibility, bridges, telemetry,
    transport_integrations, government_integrations, health, traffic,
    device_hardware,  # GAP 16 — Physical GPS/OBD Device Integration
    ml_data,          # GAP 17 — Real Historical Regional Training Data
    operational_alerts, # GAP 18, 19, 20 — Automated Operational Alerts
    vahan             # MoRTH VAHAN / ULIP v6.0 Vehicle Intelligence
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Smart Logistics and Accessibility Intelligence Platform for North Eastern Region (NER) of India",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS Middleware setup
cors_origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Run DB seeds on startup
@app.on_event("startup")
def on_startup():
    try:
        seed_database()
    except Exception as e:
        print("Database seed warning:", e)

# Include API Routers
api_v1 = settings.API_V1_STR
app.include_router(auth.router, prefix=api_v1)
app.include_router(dashboard.router, prefix=api_v1)
app.include_router(accessibility.router, prefix=api_v1)
app.include_router(bridges.router, prefix=api_v1)
app.include_router(telemetry.router, prefix=api_v1)
app.include_router(vehicles.router, prefix=api_v1)
app.include_router(deliveries.router, prefix=api_v1)
app.include_router(routes.router, prefix=api_v1)
app.include_router(corridors.router, prefix=api_v1)
app.include_router(districts.router, prefix=api_v1)
app.include_router(incidents.router, prefix=api_v1)
app.include_router(alerts.router, prefix=api_v1)
app.include_router(weather.router, prefix=api_v1)
app.include_router(field_reports.router, prefix=api_v1)
app.include_router(analytics.router, prefix=api_v1)
app.include_router(audit_logs.router, prefix=api_v1)
app.include_router(user_management.router, prefix=api_v1)
app.include_router(system_settings.router, prefix=api_v1)
app.include_router(ml.router, prefix=api_v1)
app.include_router(demo.router, prefix=api_v1)

# Gaps 8, 9, 10, 11 Routers
app.include_router(transport_integrations.router, prefix=api_v1)
app.include_router(government_integrations.router, prefix=api_v1)
app.include_router(health.router, prefix=api_v1)
app.include_router(traffic.router, prefix=api_v1)

# MoRTH VAHAN / ULIP Vehicle Intelligence Router
app.include_router(vahan.router, prefix=api_v1)

# Gap 16 — Physical GPS/OBD Device Integration
app.include_router(device_hardware.router, prefix=api_v1)

# Gap 17 — Real Historical Regional Training Data
app.include_router(ml_data.router, prefix=api_v1)

# Gaps 18, 19, 20 — Automated Operational Alerts
app.include_router(operational_alerts.router, prefix=api_v1)

@app.get("/")
def root():
    return {
        "project": "LINK X8",
        "tagline": "Predict. Reroute. Deliver.",
        "sih_problem_id": "SIH26002",
        "organization": "Ministry of Development of North Eastern Region (MDoNER)",
        "status": "ONLINE",
        "documentation": "/docs"
    }

@app.get("/health")
def root_health_check():
    return {
        "status": "HEALTHY",
        "system": "LINK X8 Core Engine",
        "environment": "PRODUCTION" if getattr(settings, "ENVIRONMENT", "development") == "production" else "DEVELOPMENT",
        "api_v1_health": f"{settings.API_V1_STR}/health",
        "weather_health": f"{settings.API_V1_STR}/health/weather"
    }
