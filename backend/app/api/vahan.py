"""
VAHAN (MoRTH National Vehicle Registry via ULIP Gateway) API Router
Provides official vehicle lookup, operational readiness evaluation,
bridge load compliance, and fleet synchronization.

Standard: ULIP Integration Requirement Document v6.0
Primary Production Endpoint: VAHAN/04 (Vehicle Number -> JSON Response)
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.schemas import (
    VahanLookupRequest,
    VahanLookupResponse,
    VahanStatusOut,
    VahanSuitabilityRequest,
    VahanSuitabilityResponse,
)
from app.services.vahan_service import VAHANService
from app.services.ulip_service import ULIPService

router = APIRouter(prefix="/vahan", tags=["MoRTH VAHAN / ULIP Vehicle Intelligence"])


@router.get("/status", response_model=VahanStatusOut)
def get_vahan_service_status():
    """
    Returns the real connection and configuration status of the ULIP VAHAN Gateway.
    Reports environment (staging/production), active base URL, and Bearer token state.
    """
    return ULIPService.get_token_status()


@router.get(
    "/vehicle/{vehicle_number}",
    response_model=VahanLookupResponse,
    summary="Lookup vehicle details via MoRTH VAHAN (ULIP VAHAN/04)"
)
def lookup_vahan_vehicle(
    vehicle_number: str,
    bypass_cache: bool = Query(False, description="Set true to force a live fetch from ULIP")
):
    """
    Primary Vehicle Registration Lookup via MoRTH VAHAN 4.0 using ULIP VAHAN/04.
    
    - Validates vehicle number against standard format: `^[A-Z0-9]{5,11}$`
    - Normalizes lowercase and stripped inputs (e.g., `up91l0001` -> `UP91L0001`)
    - Securely requests VAHAN/04 over HTTPS with dynamic Bearer token
    - Returns normalized vehicle specifications, Gross Vehicle Weight (GVW), fitness, and permits
    - Enforces privacy masking on personal identification fields
    """
    result = VAHANService.query_vahan_04(vehicle_number, bypass_cache=bypass_cache)
    return result


@router.post(
    "/vehicle/lookup",
    response_model=VahanLookupResponse,
    summary="Lookup vehicle details via JSON body"
)
def lookup_vahan_vehicle_post(payload: VahanLookupRequest):
    """
    POST variant for vehicle registration lookup via MoRTH VAHAN (ULIP VAHAN/04).
    Accepts JSON body: `{"vehiclenumber": "UP91L0001"}`
    """
    return VAHANService.query_vahan_04(payload.vehicle_number)


@router.post(
    "/verify-suitability",
    response_model=VahanSuitabilityResponse,
    summary="Evaluate vehicle logistics readiness against route and bridge constraints"
)
def evaluate_vehicle_suitability(
    payload: VahanSuitabilityRequest,
    db: Session = Depends(get_db)
):
    """
    Evaluates vehicle profile against operational logistics parameters:
    - Status in national registry (ACTIVE / INACTIVE)
    - Fitness, tax, and insurance validity
    - Blacklist records
    - Target bridge weight limits (BRO / PWD capacity check)
    """
    clean_reg = VAHANService.clean_reg_no(payload.vehicle_number)
    v_res = VAHANService.query_vahan_04(clean_reg)

    if not v_res.get("success") or not v_res.get("data"):
        # If registry lookup fails or not found, return empty profile evaluation
        return VAHANSuitabilityResponse(
            vehicle_number=clean_reg,
            readiness_verdict="Needs verification",
            suitability_score=40.0,
            explanations=[
                f"Vehicle lookup status: {v_res.get('message', 'Vehicle details not found')}.",
                "Manual document inspection recommended before route dispatch."
            ],
            vehicle_profile=None,
            bridge_evaluation=None,
            route_advisory="Vehicle record could not be verified in VAHAN registry."
        )

    return VAHANService.evaluate_readiness(
        vehicle_data=v_res["data"],
        corridor_code=payload.corridor_code,
        bridge_code=payload.bridge_code,
        cargo_weight_tons=payload.cargo_weight_tons,
        db=db
    )


@router.post("/verify-compliance")
def verify_vahan_bridge_compliance(
    payload: dict,
    db: Session = Depends(get_db)
):
    """
    Evaluates vehicle GVW against target BRO/PWD bridge capacity to prevent structural overload.
    Accepts: `{ "registration_number": "AS01EC9921", "bridge_code_or_name": "BRG-NH27-01", "actual_payload_tons": 15.0 }`
    """
    reg_no = payload.get("registration_number") or payload.get("vehicle_number", "")
    bridge_target = payload.get("bridge_code_or_name") or payload.get("bridge_code", "BRG-NH27-01")
    payload_tons = payload.get("actual_payload_tons")

    return VAHANService.evaluate_bridge_compliance(
        registration_number=reg_no,
        bridge_code_or_name=bridge_target,
        actual_payload_tons=float(payload_tons) if payload_tons is not None else None,
        db=db
    )


@router.post("/sync-fleet")
def sync_vahan_fleet(db: Session = Depends(get_db)):
    """
    Synchronizes verified VAHAN registered transport fleet into active vehicle tracker.
    """
    return VAHANService.sync_registered_fleet(db)
