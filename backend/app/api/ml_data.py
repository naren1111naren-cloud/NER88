"""
GAP 17 — Real Historical Regional Training Data
ML Data Ingestion & Model Registry API

Endpoints:
  GET  /api/v1/ml-data/registry           — Model registry (synthetic vs. real)
  GET  /api/v1/ml-data/ingestion-history  — History of all data ingestion runs
  POST /api/v1/ml-data/validate           — Validate a dataset without training
  GET  /api/v1/ml-data/quality-reports    — List available data quality reports
  GET  /api/v1/ml-data/status             — Gap 17 implementation status
"""

import os
import json
import glob
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

router = APIRouter(
    prefix="/ml-data",
    tags=["GAP 17 — Real Historical Regional Training Data"]
)

_HERE = os.path.dirname(__file__)
ML_DATA_DIR = os.path.normpath(os.path.join(_HERE, "..", "..", "..", "ml", "data"))
ML_MODEL_DIR = os.path.normpath(os.path.join(_HERE, "..", "..", "..", "ml", "models"))
INGESTION_LOG_PATH = os.path.join(ML_DATA_DIR, "ingestion_history.json")


# ─────────────────────────────────────────────────────────────
# GAP 17 STATUS
# ─────────────────────────────────────────────────────────────
GAP17_STATUS = {
    "gap": "GAP 17 — Real Historical Regional Training Data",
    "implementation_status": "INTEGRATION-READY",
    "current_training_data": {
        "type": "SYNTHETIC_DEMO",
        "file": "ner_logistics_dataset.csv",
        "records": 500,
        "provenance": "Programmatically generated with domain-realistic NER logistics parameters",
        "disclaimer": (
            "THIS IS NOT REAL HISTORICAL DATA. "
            "Current model metrics (accuracy, F1) reflect synthetic data only. "
            "Do NOT claim production-validated ML accuracy based on this model."
        )
    },
    "real_data_status": "NOT_INGESTED",
    "ingestion_pipeline": {
        "status": "OPERATIONAL",
        "script": "ml/src/ingest_real_data.py",
        "supports": ["CSV", "JSON", "JSONL"],
        "validates": [
            "Required column schema",
            "Coordinate bounds",
            "Numeric value ranges",
            "Risk category labels",
            "Duplicate records",
            "NER geographic scope",
            "Temporal consistency"
        ],
        "outputs": [
            "Cleaned/validated dataset",
            "Data quality report (JSON)",
            "Trained model (route_risk_model_real_data.joblib)",
            "Model metadata with provenance (model_metadata_real_data.json)",
            "Ingestion history log"
        ]
    },
    "how_to_ingest_real_data": {
        "step_1": "Obtain verified historical NER logistics/incident data from legitimate source",
        "step_2": "Ensure dataset contains required columns per feature_contract.json",
        "step_3": (
            "Run dry-run validation: "
            "python -m ml.src.ingest_real_data --input data.csv --source 'MDoNER Dataset 2023' --dry-run"
        ),
        "step_4": "Review data quality report at GET /api/v1/ml-data/quality-reports",
        "step_5": (
            "If validation passes: "
            "python -m ml.src.ingest_real_data --input data.csv --source 'MDoNER Dataset 2023'"
        ),
        "step_6": "New model route_risk_model_real_data.joblib will be trained and stored",
        "step_7": "Update inference to use real-data model via /api/v1/ml-data/activate-model"
    },
    "required_columns": [
        "distance_km",
        "terrain_elevation_gain_m",
        "rainfall_mm_hr",
        "active_incidents_count",
        "highest_severity_numeric",
        "road_blocked_status",
        "historical_landslide_freq",
        "traffic_congestion_index",
        "risk_score",
        "risk_category"
    ],
    "optional_columns": [
        "corridor_id",
        "origin_city",
        "destination_city",
        "origin_lat",
        "origin_lng",
        "destination_lat",
        "destination_lng",
        "recorded_date",
        "data_source",
        "verified_by"
    ],
    "legitimate_data_sources": [
        "MDoNER — Ministry of Development of North Eastern Region",
        "NITI Aayog North East Division",
        "State PWD (Public Works Department) road incident logs",
        "NDRF (National Disaster Response Force) monsoon disruption records",
        "NF Railway (NFR) disruption and delay logs",
        "BRTF (Border Roads Task Force) road condition reports",
        "IMD (India Meteorological Department) rainfall archives",
        "UNOCHA humanitarian logistics data (if applicable)"
    ],
    "model_distinction": {
        "synthetic_model": {
            "file": "route_risk_model.joblib",
            "label": "SYNTHETIC-DEMO",
            "use_for": "Prototype demonstration, UI testing, API integration testing"
        },
        "real_data_model": {
            "file": "route_risk_model_real_data.joblib",
            "label": "VERIFIED-HISTORICAL",
            "use_for": "Production deployment when real NER data is verified and ingested"
        }
    }
}


# ─────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────

@router.get("/status")
def get_gap17_status():
    """
    Returns Gap 17 implementation status, current training data type,
    and instructions for ingesting verified real historical data.
    """
    # Check if real data model exists
    real_model_path = os.path.join(ML_MODEL_DIR, "route_risk_model_real_data.joblib")
    real_meta_path = os.path.join(ML_MODEL_DIR, "model_metadata_real_data.json")

    status_copy = dict(GAP17_STATUS)
    if os.path.exists(real_model_path) and os.path.exists(real_meta_path):
        status_copy["real_data_status"] = "INGESTED_AND_TRAINED"
        try:
            with open(real_meta_path) as f:
                status_copy["real_data_model_metadata"] = json.load(f)
        except Exception:
            pass

    return status_copy


@router.get("/registry")
def get_model_registry():
    """
    Returns the current model registry showing all trained models,
    their data provenance, and evaluation metrics.
    CRITICAL: Clearly distinguishes SYNTHETIC from VERIFIED_HISTORICAL models.
    """
    try:
        from ml.src.ingest_real_data import get_model_registry as _get_registry
        return _get_registry()
    except Exception as e:
        # Fallback: read files directly
        registry = {
            "synthetic_model": None,
            "real_data_model": None,
            "note": "Model registry module not available; reading metadata files directly"
        }
        for label, filename in [("synthetic_model", "model_metadata.json"),
                                  ("real_data_model", "model_metadata_real_data.json")]:
            path = os.path.join(ML_MODEL_DIR, filename)
            if os.path.exists(path):
                try:
                    with open(path) as f:
                        registry[label] = json.load(f)
                except Exception:
                    pass
        return registry


@router.get("/ingestion-history")
def get_ingestion_history():
    """
    Returns the complete history of all data ingestion runs with timestamps,
    record counts, and provenance information.
    """
    if not os.path.exists(INGESTION_LOG_PATH):
        return {
            "history": [],
            "message": "No ingestion events recorded yet. Real data has not been ingested.",
            "current_data_type": "SYNTHETIC_DEMO"
        }
    try:
        with open(INGESTION_LOG_PATH) as f:
            history = json.load(f)
        return {"history": history, "total_events": len(history)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read ingestion history: {e}")


@router.get("/quality-reports")
def list_quality_reports():
    """
    Lists all data quality reports generated during ingestion runs.
    Each report documents data provenance, validation results, and rejection reasons.
    """
    pattern = os.path.join(ML_DATA_DIR, "data_quality_report_*.json")
    report_files = sorted(glob.glob(pattern), reverse=True)

    reports = []
    for path in report_files:
        try:
            with open(path) as f:
                report = json.load(f)
            reports.append({
                "filename": os.path.basename(path),
                "status": report.get("status"),
                "source_file": report.get("source_file"),
                "data_provenance": report.get("data_provenance"),
                "rows_accepted": report.get("rows_accepted"),
                "rows_rejected": report.get("rows_rejected"),
                "ingestion_timestamp": report.get("ingestion_timestamp"),
                "ner_geographic_violations": report.get("ner_geographic_violations", 0)
            })
        except Exception:
            continue

    return {
        "total_reports": len(reports),
        "reports": reports,
        "note": "Full report details available by reading the file from ml/data/"
    }


@router.get("/feature-contract")
def get_feature_contract():
    """
    Returns the feature contract that any real dataset must conform to.
    Use this to understand required columns and value ranges.
    """
    path = os.path.join(ML_DATA_DIR, "feature_contract.json")
    if os.path.exists(path):
        with open(path) as f:
            contract = json.load(f)
        contract["_note"] = (
            "This is the feature contract for the existing Random Forest model. "
            "Real historical datasets MUST contain these columns. "
            "See /api/v1/ml-data/status for the full ingestion procedure."
        )
        return contract
    raise HTTPException(status_code=404, detail="Feature contract file not found")


@router.get("/dataset-schema")
def get_dataset_schema():
    """
    Returns the full dataset schema including optional provenance columns.
    """
    path = os.path.join(ML_DATA_DIR, "dataset_schema.json")
    if os.path.exists(path):
        with open(path) as f:
            schema = json.load(f)
        schema["_disclaimer"] = (
            "Current dataset is SYNTHETIC_DEMO. "
            "See /api/v1/ml-data/status for real data ingestion procedure."
        )
        return schema
    raise HTTPException(status_code=404, detail="Dataset schema file not found")
