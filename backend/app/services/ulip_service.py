"""
ULIP (Unified Logistics Interface Platform) Authentication & HTTP Gateway Service
Provides secure authentication, Bearer token lifecycle management, automatic session renewal,
and authenticated communication with ULIP APIs (including MoRTH VAHAN/01-06).

Official Technical Standard: ULIP Integration Requirement Document v6.0
Staging Base URL: https://www.ulipstaging.dpiit.gov.in/ulip/v1.0.0
Production Base URL: https://www.ulip.dpiit.gov.in/ulip/v1.0.0
"""

import logging
import threading
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
import requests

from app.core.config import settings

logger = logging.getLogger("link_x8.ulip")


class ULIPAuthError(Exception):
    """Raised when ULIP authentication fails (bad credentials, server rejection)."""
    pass


class ULIPNotConfiguredError(Exception):
    """Raised when ULIP credentials are not configured in the environment."""
    pass


class ULIPServiceUnavailableError(Exception):
    """Raised when ULIP upstream server is unreachable, times out, or returns 5xx."""
    pass


class ULIPService:
    """
    Singleton-style manager for ULIP authentication and API transport.
    Maintains server-side cached Bearer token and handles transparent renewals.
    """

    _token: Optional[str] = None
    _token_expiry: Optional[datetime] = None
    _lock = threading.Lock()

    # ULIP documented session lifetime is 30 minutes.
    # We refresh slightly earlier (e.g. after 25 mins) to prevent mid-flight token expiry.
    SESSION_LIFETIME_MINUTES: int = 25

    @classmethod
    def get_base_url(cls) -> str:
        """Returns the active ULIP Base URL based on settings (Staging vs Production)."""
        return settings.ULIP_EFFECTIVE_BASE_URL.rstrip("/")

    @classmethod
    def is_configured(cls) -> bool:
        """Checks if ULIP credentials or static token are provided in environment."""
        if settings.ULIP_TOKEN and settings.ULIP_TOKEN.strip():
            return True
        return bool(settings.ULIP_USERNAME and settings.ULIP_PASSWORD)

    @classmethod
    def get_token_status(cls) -> Dict[str, Any]:
        """Returns non-sensitive metadata regarding the current authentication state."""
        configured = cls.is_configured()
        if not configured:
            status_str = "NOT_CONFIGURED"
        elif cls._token and cls._token_expiry and datetime.utcnow() < cls._token_expiry:
            status_str = "AUTHENTICATED"
        elif cls._token and cls._token_expiry and datetime.utcnow() >= cls._token_expiry:
            status_str = "EXPIRED"
        else:
            status_str = "UNAUTHENTICATED"

        return {
            "service": "VAHAN via ULIP",
            "environment": getattr(settings, "ULIP_ENV", "staging").lower(),
            "base_url": cls.get_base_url(),
            "is_configured": configured,
            "has_credentials": bool(settings.ULIP_USERNAME and settings.ULIP_PASSWORD),
            "has_static_token": bool(settings.ULIP_TOKEN),
            "token_status": status_str,
            "token_expires_at": cls._token_expiry.isoformat() if cls._token_expiry else None
        }

    @classmethod
    def clear_token_cache(cls) -> None:
        """Invalidates cached access token, forcing fresh login on next request."""
        with cls._lock:
            cls._token = None
            cls._token_expiry = None
            logger.info("ULIP token cache invalidated.")

    @classmethod
    def login(cls, force: bool = False) -> str:
        """
        Authenticates with ULIP at POST /user/login using credentials from settings.
        Returns the Bearer access token string.
        """
        # If static token is supplied in env and force is not set, use it
        if settings.ULIP_TOKEN and settings.ULIP_TOKEN.strip() and not force:
            with cls._lock:
                cls._token = settings.ULIP_TOKEN.strip()
                cls._token_expiry = datetime.utcnow() + timedelta(days=365)
            return cls._token

        if not settings.ULIP_USERNAME or not settings.ULIP_PASSWORD:
            raise ULIPNotConfiguredError(
                "ULIP credentials not configured. Please set ULIP_USERNAME and ULIP_PASSWORD in environment."
            )

        with cls._lock:
            # Check if token is already valid
            if not force and cls._token and cls._token_expiry and datetime.utcnow() < cls._token_expiry:
                return cls._token

            base_url = cls.get_base_url()
            login_url = f"{base_url}/user/login"

            logger.info(f"Initiating ULIP authentication with gateway [{cls.get_base_url()}]")

            headers = {
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
            payload = {
                "username": settings.ULIP_USERNAME,
                "password": settings.ULIP_PASSWORD
            }

            timeout = getattr(settings, "ULIP_TIMEOUT_SECONDS", 15)

            try:
                response = requests.post(
                    login_url,
                    json=payload,
                    headers=headers,
                    timeout=timeout
                )
            except requests.exceptions.Timeout as e:
                logger.error(f"ULIP authentication timeout after {timeout}s: {e}")
                raise ULIPServiceUnavailableError("ULIP authentication service timed out.") from e
            except requests.exceptions.RequestException as e:
                logger.error(f"ULIP authentication network connection failed: {e}")
                raise ULIPServiceUnavailableError(f"Cannot connect to ULIP authentication gateway: {e}") from e

            if response.status_code != 200:
                logger.warning(
                    f"ULIP login failed with HTTP status {response.status_code}"
                )
                raise ULIPAuthError(
                    f"ULIP authentication failed (HTTP {response.status_code}): {response.text[:200]}"
                )

            token_str = ""
            try:
                # ULIP /user/login returns the raw token string or JSON wrapping it
                resp_text = response.text.strip()
                if resp_text.startswith("{") and resp_text.endswith("}"):
                    resp_json = response.json()
                    token_str = (
                        resp_json.get("token") or
                        resp_json.get("access_token") or
                        resp_json.get("response") or
                        resp_json.get("jwtToken") or
                        resp_text
                    )
                else:
                    token_str = resp_text.strip().strip('"').strip("'")
            except Exception as e:
                token_str = response.text.strip().strip('"').strip("'")

            if not token_str or len(token_str) < 10:
                logger.error("ULIP login succeeded but empty or invalid token received")
                raise ULIPAuthError("ULIP returned an empty or invalid authentication token.")

            cls._token = token_str
            cls._token_expiry = datetime.utcnow() + timedelta(minutes=cls.SESSION_LIFETIME_MINUTES)
            logger.info("ULIP authentication successful. Token cached for session.")
            return cls._token

    @classmethod
    def get_valid_token(cls) -> str:
        """Returns a cached valid Bearer token, or logs in if expired or absent."""
        if cls._token and cls._token_expiry and datetime.utcnow() < cls._token_expiry:
            return cls._token
        return cls.login(force=False)

    @classmethod
    def post_authenticated(
        cls,
        endpoint_path: str,
        json_payload: Dict[str, Any],
        retry_on_unauthorized: bool = True
    ) -> Tuple[int, Dict[str, Any]]:
        """
        Executes an authenticated HTTP POST request to a ULIP API endpoint (e.g. /VAHAN/04).
        Automatically injects `Authorization: Bearer <token>` and refreshes token once on 401/403.

        Returns: (http_status_code, response_json_or_dict)
        """
        base_url = cls.get_base_url()
        endpoint_path = endpoint_path.lstrip("/")
        full_url = f"{base_url}/{endpoint_path}"

        token = cls.get_valid_token()

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        }

        timeout = getattr(settings, "ULIP_TIMEOUT_SECONDS", 15)

        logger.info(f"ULIP API Request -> POST {endpoint_path}")

        try:
            response = requests.post(
                full_url,
                json=json_payload,
                headers=headers,
                timeout=timeout
            )
        except requests.exceptions.Timeout as e:
            logger.error(f"ULIP request to {endpoint_path} timed out after {timeout}s: {e}")
            raise ULIPServiceUnavailableError(f"ULIP request to {endpoint_path} timed out.") from e
        except requests.exceptions.RequestException as e:
            logger.error(f"ULIP request to {endpoint_path} network error: {e}")
            raise ULIPServiceUnavailableError(f"Failed to reach ULIP endpoint {endpoint_path}: {e}") from e

        # Handle 401 / 403 expired token with one-time retry
        if response.status_code in (401, 403) and retry_on_unauthorized:
            logger.warning(f"ULIP returned HTTP {response.status_code}. Refreshing token and retrying once...")
            cls.clear_token_cache()
            new_token = cls.login(force=True)
            headers["Authorization"] = f"Bearer {new_token}"

            try:
                response = requests.post(
                    full_url,
                    json=json_payload,
                    headers=headers,
                    timeout=timeout
                )
            except requests.exceptions.RequestException as e:
                raise ULIPServiceUnavailableError(f"Retry request to {endpoint_path} failed: {e}") from e

        try:
            data = response.json()
        except Exception:
            data = {
                "raw_text": response.text,
                "error": True,
                "status_code": response.status_code
            }

        return response.status_code, data
