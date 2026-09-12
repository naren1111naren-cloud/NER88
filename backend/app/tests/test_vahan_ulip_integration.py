"""
Comprehensive Unit & Integration Test Suite for ULIP VAHAN Integration (ULIP v6.0 Standard)
Tests vehicle registration normalization, VAHAN/04 response parsing, privacy masking,
token authentication & retry lifecycle, error responses, bridge compliance, and FastAPI endpoints.
"""

import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from datetime import datetime, timedelta

from app.main import app
from app.core.config import settings
from app.services.ulip_service import (
    ULIPService,
    ULIPAuthError,
    ULIPNotConfiguredError,
    ULIPServiceUnavailableError
)
from app.services.vahan_service import VAHANService

client = TestClient(app)

# Official Sample ULIP VAHAN/04 Success Payload
SAMPLE_VAHAN_04_SUCCESS_RESPONSE = {
    "response": [
        {
            "response": {
                "stautsMessage": "OK",
                "stateCd": "UP",
                "rtoCd": "91",
                "rcRegnNo": "UP91L0001",
                "rcRegnDt": "26-Jan-2017",
                "rcPurchaseDt": "24-Jan-2017",
                "rcChasiNo": "ME4JF509AH70*****",
                "rcEngNo": "JF50E760*****",
                "rcVhClassDesc": "M-Cycle/Scooter",
                "rcMakerDesc": "HONDA MOTORCYCLE AND SCOOTER INDIA (P) LTD",
                "rcMakerModel": "HONDA ACTIVA",
                "rcBodyTypeDesc": "SOLO",
                "rcFuelDesc": "PETROL",
                "rcColor": "P A WHITE",
                "rcOwnerName": "R***L K***R",
                "rcPermanentAddress": ", 999999",
                "rcPresentAddress": ", 999999",
                "rcFitUpto": "25-Jan-2032",
                "rcNormsDesc": "BHARAT STAGE II",
                "rcFinancer": "",
                "rcRegisteredAt": "HAMIRPUR(UP), Uttar Pradesh",
                "rcStatusAsOn": "03-Feb-2026 05:02:62604",
                "rcManuMonthYr": "1/2017",
                "rcUnldWt": "108",
                "rcVchCatg": "2WN",
                "rcGvw": "269",
                "rcNoCyl": "1",
                "rcCubicCap": "109.00",
                "rcSeatCap": "2",
                "rcWheelbase": "1230",
                "rcStandCap": "0",
                "rcSleeperCap": "",
                "rcOwnerSr": "1",
                "rcPuccUpto": "15-Dec-2026",
                "rcPuccNo": "PUC-UP-9921",
                "rcBlacklistStatus": "",
                "rcNocDetails": "",
                "rcNocDt": "",
                "rcVhClass": 1,
                "rcVhType": "N",
                "rcFuelCd": "1",
                "rcMakerCd": "36",
                "rcModelCd": "HONDA ACTIVA",
                "rcSaleAmt": "51129",
                "rcRegnUpto": "25-Jan-2032",
                "rcOwnCatgDesc": "OTHERS",
                "rcVchCatgDesc": "TWO WHEELER(NT)",
                "rcOwnerCdDesc": "INDIVIDUAL",
                "rcPassengerTax": "",
                "rcGoodsTax": "",
                "rcTaxUpto": "25-Jan-2032",
                "rcTaxMode": "L",
                "rcInsuranceComp": "HDFC ERGO General Insurance Company Ltd",
                "rcInsurancePolicyNo": "2320100501934300000",
                "rcInsuranceUpto": "15-Sep-2020",
                "rcStatus": "ACTIVE"
            },
            "responseStatus": "SUCCESS",
            "message": None
        }
    ],
    "error": "false",
    "code": "200",
    "message": "Success"
}

# Official Sample ULIP VAHAN/04 Not Found (Code 231) Payload
SAMPLE_VAHAN_04_NOT_FOUND_RESPONSE = {
    "response": [
        {
            "response": None,
            "responseStatus": "ERROR",
            "message": {
                "id": None,
                "code": "231",
                "params": None,
                "text": "Vehicle Details not Found"
            }
        }
    ],
    "error": "false",
    "code": "200",
    "message": "Success"
}

# Official Sample ULIP 400 Bad Request Payload
SAMPLE_VAHAN_04_INVALID_FORMAT_RESPONSE = {
    "response": None,
    "error": "true",
    "code": "400 BAD_REQUEST",
    "message": "Data format failed OR wrong value entered at: vehiclenumber. Format should follow ^[A-Z0-9]{5,11}$"
}


@pytest.fixture(autouse=True)
def reset_services():
    VAHANService.clear_cache()
    ULIPService.clear_token_cache()
    yield
    VAHANService.clear_cache()
    ULIPService.clear_token_cache()


# =========================================================================
# 1. INPUT VALIDATION & NORMALIZATION TESTS
# =========================================================================

def test_vehicle_number_cleaning_and_normalization():
    assert VAHANService.clean_reg_no("  up91l0001  ") == "UP91L0001"
    assert VAHANService.clean_reg_no("AS-01-EC-9921") == "AS01EC9921"
    assert VAHANService.clean_reg_no("ml 05 aa 4402") == "ML05AA4402"
    assert VAHANService.clean_reg_no("tr.01.b.8833") == "TR01B8833"


def test_vehicle_number_validation_success():
    valid, err = VAHANService.validate_reg_no("UP91L0001")
    assert valid is True
    assert err is None

    valid, err = VAHANService.validate_reg_no("AS01EC9921")
    assert valid is True
    assert err is None


def test_vehicle_number_validation_too_short():
    valid, err = VAHANService.validate_reg_no("DL1A")
    assert valid is False
    assert "too short" in err


def test_vehicle_number_validation_too_long():
    valid, err = VAHANService.validate_reg_no("UP91L000199999")
    assert valid is False
    assert "too long" in err


def test_vehicle_number_validation_invalid_characters():
    valid, err = VAHANService.validate_reg_no("UP91@0001")
    assert valid is False
    assert "invalid characters" in err


# =========================================================================
# 2. ULIP AUTHENTICATION & TOKEN LIFECYCLE TESTS
# =========================================================================

@patch.object(settings, "ULIP_USERNAME", "test_user")
@patch.object(settings, "ULIP_PASSWORD", "test_pass")
@patch.object(settings, "ULIP_TOKEN", "")
@patch("requests.post")
def test_ulip_login_success(mock_post):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = '{"token": "mock_jwt_access_token_12345"}'
    mock_resp.json.return_value = {"token": "mock_jwt_access_token_12345"}
    mock_post.return_value = mock_resp

    token = ULIPService.login(force=True)
    assert token == "mock_jwt_access_token_12345"

    status = ULIPService.get_token_status()
    assert status["token_status"] == "AUTHENTICATED"
    assert status["is_configured"] is True


@patch.object(settings, "ULIP_USERNAME", "")
@patch.object(settings, "ULIP_PASSWORD", "")
@patch.object(settings, "ULIP_TOKEN", "")
def test_ulip_not_configured():
    assert ULIPService.is_configured() is False
    with pytest.raises(ULIPNotConfiguredError):
        ULIPService.login()


@patch.object(settings, "ULIP_USERNAME", "test_user")
@patch.object(settings, "ULIP_PASSWORD", "bad_pass")
@patch.object(settings, "ULIP_TOKEN", "")
@patch("requests.post")
def test_ulip_login_auth_failure(mock_post):
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.text = "Unauthorized credentials"
    mock_post.return_value = mock_resp

    with pytest.raises(ULIPAuthError):
        ULIPService.login(force=True)


# =========================================================================
# 3. VAHAN/04 LOOKUP & RESPONSE PARSING TESTS
# =========================================================================

@patch.object(settings, "ULIP_USERNAME", "test_user")
@patch.object(settings, "ULIP_PASSWORD", "test_pass")
@patch("app.services.ulip_service.ULIPService.post_authenticated")
def test_vahan_04_successful_lookup(mock_post_auth):
    mock_post_auth.return_value = (200, SAMPLE_VAHAN_04_SUCCESS_RESPONSE)

    res = VAHANService.query_vahan_04("UP91L0001")
    assert res["success"] is True
    assert res["status"] == "SUCCESS"
    assert res["source"] == "VAHAN via ULIP"
    data = res["data"]
    assert data["registration_number"] == "UP91L0001"
    assert data["maker_model"] == "HONDA ACTIVA"
    assert data["maker_description"] == "HONDA MOTORCYCLE AND SCOOTER INDIA (P) LTD"
    assert data["vehicle_class"] == "M-Cycle/Scooter"
    assert data["fuel_description"] == "PETROL"
    assert data["gvw_tons"] == 0.27 or data["gross_vehicle_weight_kg"] == 269.0
    assert data["vehicle_status"] == "ACTIVE"
    assert data["insurance_company"] == "HDFC ERGO General Insurance Company Ltd"

    # Privacy verification: verify personal info is excluded or properly masked
    assert "rc_owner_name" not in data
    assert "rc_permanent_address" not in data
    assert "rc_present_address" not in data


@patch.object(settings, "ULIP_USERNAME", "test_user")
@patch.object(settings, "ULIP_PASSWORD", "test_pass")
@patch("app.services.ulip_service.ULIPService.post_authenticated")
def test_vahan_04_vehicle_not_found(mock_post_auth):
    mock_post_auth.return_value = (200, SAMPLE_VAHAN_04_NOT_FOUND_RESPONSE)

    res = VAHANService.query_vahan_04("DL01AA0000")
    assert res["success"] is False
    assert res["status"] == "NOT_FOUND"
    assert res["message"] == "VEHICLE DETAILS NOT FOUND"
    assert res["data"] is None


@patch.object(settings, "ULIP_USERNAME", "")
@patch.object(settings, "ULIP_PASSWORD", "")
@patch.object(settings, "ULIP_TOKEN", "")
def test_vahan_04_unconfigured_state():
    res = VAHANService.query_vahan_04("UP91L0001")
    assert res["success"] is False
    assert res["status"] == "VAHAN_NOT_CONFIGURED"
    assert res["message"] == "VAHAN SERVICE NOT CONFIGURED"
    assert res["data"] is None


@patch.object(settings, "ULIP_USERNAME", "test_user")
@patch.object(settings, "ULIP_PASSWORD", "test_pass")
@patch("app.services.ulip_service.ULIPService.post_authenticated")
def test_vahan_04_auth_failed_state(mock_post_auth):
    mock_post_auth.side_effect = ULIPAuthError("401 Unauthorized")

    res = VAHANService.query_vahan_04("UP91L0001")
    assert res["success"] is False
    assert res["status"] == "AUTH_FAILED"
    assert "AUTHENTICATION FAILED" in res["message"]


@patch.object(settings, "ULIP_USERNAME", "test_user")
@patch.object(settings, "ULIP_PASSWORD", "test_pass")
@patch("app.services.ulip_service.ULIPService.post_authenticated")
def test_vahan_04_service_unavailable(mock_post_auth):
    mock_post_auth.side_effect = ULIPServiceUnavailableError("Connection timed out")

    res = VAHANService.query_vahan_04("UP91L0001")
    assert res["success"] is False
    assert res["status"] == "SERVICE_UNAVAILABLE"
    assert "UNAVAILABLE" in res["message"]


# =========================================================================
# 4. BRIDGE COMPLIANCE & READINESS ENGINE TESTS
# =========================================================================

def test_vahan_readiness_scoring():
    veh_data = {
        "registration_number": "UP91L0001",
        "vehicle_status": "ACTIVE",
        "fitness_upto": "25-Jan-2032",
        "insurance_upto": "25-Jan-2032",
        "blacklist_status": "",
        "gvw_tons": 25.0
    }

    readiness = VAHANService.evaluate_readiness(veh_data)
    assert readiness["readiness_verdict"] == "Operationally suitable"
    assert readiness["suitability_score"] >= 80.0
    assert "MoRTH VAHAN provides vehicle registry parameters only" in readiness["disclaimer"]


def test_vahan_readiness_expired_fitness():
    veh_data = {
        "registration_number": "UP91L0001",
        "vehicle_status": "ACTIVE",
        "fitness_upto": "01-Jan-2020",  # Expired
        "insurance_upto": "25-Jan-2032",
        "blacklist_status": "",
        "gvw_tons": 25.0
    }

    readiness = VAHANService.evaluate_readiness(veh_data)
    assert readiness["suitability_score"] < 80.0
    assert any("expired" in exp.lower() for exp in readiness["explanations"])


# =========================================================================
# 5. FASTAPI VAHAN ENDPOINTS TESTS
# =========================================================================

def test_get_vahan_status_endpoint():
    response = client.get("/api/v1/vahan/status")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "VAHAN via ULIP"
    assert "environment" in data
    assert "base_url" in data


@patch.object(settings, "ULIP_USERNAME", "test_user")
@patch.object(settings, "ULIP_PASSWORD", "test_pass")
@patch("app.services.ulip_service.ULIPService.post_authenticated")
def test_get_vahan_vehicle_endpoint_success(mock_post_auth):
    mock_post_auth.return_value = (200, SAMPLE_VAHAN_04_SUCCESS_RESPONSE)

    response = client.get("/api/v1/vahan/vehicle/UP91L0001")
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    assert res["status"] == "SUCCESS"
    assert res["data"]["registration_number"] == "UP91L0001"
    assert res["data"]["source"] == "VAHAN via ULIP"


@patch.object(settings, "ULIP_USERNAME", "test_user")
@patch.object(settings, "ULIP_PASSWORD", "test_pass")
@patch("app.services.ulip_service.ULIPService.post_authenticated")
def test_post_vahan_vehicle_lookup_endpoint(mock_post_auth):
    mock_post_auth.return_value = (200, SAMPLE_VAHAN_04_SUCCESS_RESPONSE)

    response = client.post("/api/v1/vahan/vehicle/lookup", json={"vehiclenumber": "UP91L0001"})
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    assert res["data"]["maker_model"] == "HONDA ACTIVA"


@patch.object(settings, "ULIP_USERNAME", "test_user")
@patch.object(settings, "ULIP_PASSWORD", "test_pass")
@patch("app.services.ulip_service.ULIPService.post_authenticated")
def test_verify_suitability_endpoint(mock_post_auth):
    mock_post_auth.return_value = (200, SAMPLE_VAHAN_04_SUCCESS_RESPONSE)

    payload = {
        "vehicle_number": "UP91L0001",
        "bridge_code": "BRG-NH27-01",
        "cargo_weight_tons": 5.0
    }
    response = client.post("/api/v1/vahan/verify-suitability", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "readiness_verdict" in data
    assert "suitability_score" in data
    assert "disclaimer" in data
