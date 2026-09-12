import os
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "LINK X8"
    API_V1_STR: str = "/api/v1"

    ENVIRONMENT: str = os.getenv(
        "ENVIRONMENT",
        "development"
    )

    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "link-x8-super-secret-sih-2026-hackathon-key-32bytes!"
    )

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # ---------------------------------------------------------
    # DATABASE
    # ---------------------------------------------------------

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./ner_logiai.db"
    )

    # ---------------------------------------------------------
    # CORS
    # ---------------------------------------------------------

    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        os.getenv(
            "BACKEND_CORS_ORIGINS",
            "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000"
        )
    )

    @property
    def cors_origin_list(self) -> List[str]:
        if not self.CORS_ORIGINS or self.CORS_ORIGINS.strip() == "*":
            return [
                "http://localhost:5173",
                "http://localhost:3000",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:3000",
                "http://localhost:8000",
                "http://127.0.0.1:8000",
            ]

        parsed = [
            origin.strip()
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]

        # Always include development defaults if running locally
        dev_defaults = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ]
        for origin in dev_defaults:
            if origin not in parsed:
                parsed.append(origin)

        return parsed

    # ---------------------------------------------------------
    # STORAGE
    # ---------------------------------------------------------

    STORAGE_BACKEND: str = os.getenv(
        "STORAGE_BACKEND",
        "LOCAL"
    )

    STORAGE_LOCAL_DIR: str = os.getenv(
        "STORAGE_LOCAL_DIR",
        "./uploaded_assets"
    )

    S3_BUCKET_NAME: str = os.getenv(
        "S3_BUCKET_NAME",
        "link-x8-cloud-storage"
    )

    S3_REGION_NAME: str = os.getenv(
        "S3_REGION_NAME",
        "ap-south-1"
    )

    S3_ENDPOINT_URL: str = os.getenv(
        "S3_ENDPOINT_URL",
        ""
    )

    S3_ACCESS_KEY_ID: str = os.getenv(
        "S3_ACCESS_KEY_ID",
        ""
    )

    S3_SECRET_ACCESS_KEY: str = os.getenv(
        "S3_SECRET_ACCESS_KEY",
        ""
    )

    # ---------------------------------------------------------
    # TRANSPORT / ULIP / VAHAN (MoRTH / NLDSL ULIP v6.0 Standard)
    # ---------------------------------------------------------

    TRANSPORT_INTEGRATION_API_KEY: str = os.getenv(
        "TRANSPORT_INTEGRATION_API_KEY",
        ""
    )

    ULIP_ENV: str = os.getenv(
        "ULIP_ENV",
        "staging"
    )

    ULIP_BASE_URL: str = os.getenv(
        "ULIP_BASE_URL",
        ""
    )

    ULIP_USERNAME: str = os.getenv(
        "ULIP_USERNAME",
        ""
    )

    ULIP_PASSWORD: str = os.getenv(
        "ULIP_PASSWORD",
        ""
    )

    ULIP_TOKEN: str = os.getenv(
        "ULIP_TOKEN",
        ""
    )

    ULIP_TIMEOUT_SECONDS: int = int(
        os.getenv("ULIP_TIMEOUT_SECONDS", "15")
    )

    VAHAN_CACHE_TTL_SECONDS: int = int(
        os.getenv("VAHAN_CACHE_TTL_SECONDS", "3600")
    )

    @property
    def ULIP_EFFECTIVE_BASE_URL(self) -> str:
        """
        Determines the correct ULIP Gateway URL based on ULIP_ENV:
        Staging: https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0
        Production: https://www.ulip.dpiit.gov.in/ulip/v1.0.0
        """
        if self.ULIP_BASE_URL and self.ULIP_BASE_URL.strip():
            return self.ULIP_BASE_URL.rstrip("/")
        if self.ULIP_ENV.lower() == "production":
            return "https://www.ulip.dpiit.gov.in/ulip/v1.0.0"
        return "https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0"

    ULIP_GATEWAY_URL: str = os.getenv(
        "ULIP_GATEWAY_URL",
        "https://api.ulip.gov.in/v1"
    )

    VAHAN_REGISTRY_URL: str = os.getenv(
        "VAHAN_REGISTRY_URL",
        "https://vahan.parivahan.gov.in/api/v1"
    )

    # ---------------------------------------------------------
    # GOVERNMENT INTEGRATIONS (DATA.GOV.IN, NHAI, BRO, VAHAN, NDMA)
    # ---------------------------------------------------------

    DATA_GOV_IN_API_KEY: str = os.getenv(
        "DATA_GOV_IN_API_KEY",
        ""
    )

    DATA_GOV_IN_BASE_URL: str = os.getenv(
        "DATA_GOV_IN_BASE_URL",
        "https://api.data.gov.in/resource"
    )

    NHAI_RAMS_API_KEY: str = os.getenv(
        "NHAI_RAMS_API_KEY",
        ""
    )

    NHAI_MONITORING_ENDPOINT: str = os.getenv(
        "NHAI_MONITORING_ENDPOINT",
        "https://data.nhai.gov.in/api/v1"
    )

    BRO_COMMAND_API_KEY: str = os.getenv(
        "BRO_COMMAND_API_KEY",
        ""
    )

    BRO_COMMAND_ENDPOINT: str = os.getenv(
        "BRO_COMMAND_ENDPOINT",
        "https://bro.nic.in/api/v1"
    )

    VAHAN_API_KEY: str = os.getenv(
        "VAHAN_API_KEY",
        ""
    )

    VAHAN_REGISTRY_URL: str = os.getenv(
        "VAHAN_REGISTRY_URL",
        "https://vahan.parivahan.gov.in/api/v1"
    )

    SARATHI_REGISTRY_URL: str = os.getenv(
        "SARATHI_REGISTRY_URL",
        "https://sarathi.parivahan.gov.in/api/v1"
    )

    NDMA_SACHET_API_KEY: str = os.getenv(
        "NDMA_SACHET_API_KEY",
        ""
    )

    NDMA_ALERTS_ENDPOINT: str = os.getenv(
        "NDMA_ALERTS_ENDPOINT",
        "https://sachet.ndma.gov.in/api/v1"
    )

    GOV_INTEGRATION_API_KEY: str = os.getenv(
        "GOV_INTEGRATION_API_KEY",
        ""
    )

    # ---------------------------------------------------------
    # OPEN-METEO
    # ---------------------------------------------------------

    # REAL Open-Meteo API
    OPEN_METEO_BASE_URL: str = os.getenv(
        "OPEN_METEO_BASE_URL",
        "https://api.open-meteo.com"
    )

    OPEN_METEO_FORECAST_ENDPOINT: str = os.getenv(
        "OPEN_METEO_FORECAST_ENDPOINT",
        "/v1/forecast"
    )

    OPEN_METEO_GEOCODING_URL: str = os.getenv(
        "OPEN_METEO_GEOCODING_URL",
        "https://geocoding-api.open-meteo.com/v1/search"
    )

    # 15 minute cache
    WEATHER_CACHE_TTL_SECONDS: int = int(
        os.getenv(
            "WEATHER_CACHE_TTL_SECONDS",
            "900"
        )
    )

    @property
    def OPEN_METEO_FULL_URL(self) -> str:
        """
        Always produces:

        https://api.open-meteo.com/v1/forecast
        """

        base = self.OPEN_METEO_BASE_URL.rstrip("/")
        endpoint = self.OPEN_METEO_FORECAST_ENDPOINT.strip()

        if not endpoint.startswith("/"):
            endpoint = "/" + endpoint

        # Prevent duplicated /v1/forecast
        if base.endswith("/v1/forecast"):
            return base

        return f"{base}{endpoint}"

    # ---------------------------------------------------------
    # PYDANTIC SETTINGS
    # ---------------------------------------------------------

    model_config = SettingsConfigDict(
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()