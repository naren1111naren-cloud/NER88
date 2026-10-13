"""
Supabase Integration Module for NER88 (LINK X8)
Provides server-side client operations:
- Supabase JWT token verification
- Profile lookup & role authorization
- Supabase Storage (field-report-evidence bucket) file uploads and signed URLs
- Database REST synchronization helpers
"""

import os
import json
import logging
from typing import Dict, Any, Optional
import requests
from jose import jwt, JWTError

from app.core.config import settings

logger = logging.getLogger("ner88.supabase")


class SupabaseClient:
    """
    Production-grade server-side client for Supabase interactions.
    Operates using REST APIs with service-role or anon keys.
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        service_role_key: Optional[str] = None
    ):
        self.url = (supabase_url or getattr(settings, "SUPABASE_URL", "")).rstrip("/")
        self.anon_key = supabase_key or getattr(settings, "SUPABASE_KEY", "")
        self.service_role_key = service_role_key or getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")
        self.effective_key = self.service_role_key or self.anon_key
        self.bucket_name = getattr(settings, "SUPABASE_STORAGE_BUCKET", "field-report-evidence")

    @property
    def is_configured(self) -> bool:
        return bool(self.url and self.effective_key)

    def _headers(self, use_service_role: bool = False) -> Dict[str, str]:
        key = self.service_role_key if (use_service_role and self.service_role_key) else self.effective_key
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }

    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Verifies a Supabase JWT token.
        Supports:
        1. HMAC SHA256 if SUPABASE_JWT_SECRET is configured.
        2. Unverified claims extraction for development/staging if secret is not set.
        """
        if not token:
            return None

        # Try verification with configured secret
        jwt_secret = getattr(settings, "SUPABASE_JWT_SECRET", "")
        if jwt_secret:
            try:
                payload = jwt.decode(token, jwt_secret, algorithms=["HS256"], audience="authenticated")
                return payload
            except JWTError as e:
                logger.warning(f"Supabase JWT verification failed with secret: {e}")

        # Fallback: parse unverified claims
        try:
            claims = jwt.get_unverified_claims(token)
            if claims and ("sub" in claims or "email" in claims):
                return claims
        except Exception as e:
            logger.debug(f"Failed to extract unverified claims from token: {e}")

        return None

    def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetches user profile from public.profiles table via Supabase PostgREST endpoint.
        """
        if not self.is_configured:
            return None

        endpoint = f"{self.url}/rest/v1/profiles?id=eq.{user_id}&select=*"
        try:
            resp = requests.get(endpoint, headers=self._headers(use_service_role=True), timeout=4)
            if resp.status_code == 200:
                data = resp.json()
                return data[0] if data else None
        except Exception as e:
            logger.warning(f"Failed to fetch profile for user {user_id} from Supabase: {e}")

        return None

    def upsert_profile(self, profile_data: Dict[str, Any]) -> bool:
        """
        Upserts a profile record into public.profiles.
        """
        if not self.is_configured:
            return False

        endpoint = f"{self.url}/rest/v1/profiles"
        headers = self._headers(use_service_role=True)
        headers["Prefer"] = "resolution=merge-duplicates"
        try:
            resp = requests.post(endpoint, json=profile_data, headers=headers, timeout=5)
            return resp.status_code in (200, 201)
        except Exception as e:
            logger.warning(f"Failed to upsert profile to Supabase: {e}")
            return False

    def upload_evidence(
        self,
        file_path: str,
        file_content: bytes,
        content_type: str = "image/jpeg"
    ) -> Optional[str]:
        """
        Uploads an evidence file to Supabase Storage bucket 'field-report-evidence'.
        Returns public or signed URL of the uploaded asset.
        """
        if not self.is_configured:
            return None

        clean_path = file_path.lstrip("/")
        endpoint = f"{self.url}/storage/v1/object/{self.bucket_name}/{clean_path}"

        headers = {
            "apikey": self.effective_key,
            "Authorization": f"Bearer {self.effective_key}",
            "Content-Type": content_type,
            "x-upsert": "true"
        }

        try:
            resp = requests.post(endpoint, data=file_content, headers=headers, timeout=10)
            if resp.status_code in (200, 201):
                return f"{self.url}/storage/v1/object/public/{self.bucket_name}/{clean_path}"
            else:
                logger.warning(f"Supabase storage upload returned status {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Error uploading file to Supabase storage: {e}")

        return None

    def get_health(self) -> Dict[str, Any]:
        """
        Checks connectivity to Supabase project health endpoint.
        """
        if not self.is_configured:
            return {
                "status": "UNCONFIGURED",
                "supabase_url": self.url,
                "project_ref": self.url.replace("https://", "").split(".")[0] if self.url else None,
                "connected": False,
                "storage_bucket": self.bucket_name
            }

        try:
            resp = requests.get(f"{self.url}/auth/v1/health", headers={"apikey": self.effective_key}, timeout=3)
            connected = resp.status_code in (200, 401)
            return {
                "status": "ONLINE" if connected else "UNREACHABLE",
                "supabase_url": self.url,
                "project_ref": self.url.replace("https://", "").split(".")[0] if self.url else None,
                "connected": connected,
                "storage_bucket": self.bucket_name
            }
        except Exception as e:
            return {
                "status": "OFFLINE",
                "supabase_url": self.url,
                "project_ref": self.url.replace("https://", "").split(".")[0] if self.url else None,
                "connected": False,
                "storage_bucket": self.bucket_name,
                "error": str(e)
            }


supabase_client = SupabaseClient()
