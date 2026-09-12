"""
SIH GAP 17 — Real Historical Regional Training Data
Comprehensive Test Suite

Tests verify:
- Gap 17 status endpoint (correct provenance labelling)
- Model registry (synthetic model identified, real model absent)
- Feature contract availability
- Dataset schema availability
- Ingestion history tracking
- Real data ingestion pipeline (unit tests — no real file needed):
  * Schema validation catches missing columns
  * Bounds validation rejects out-of-range values
  * Duplicate detection works
  * Invalid risk category labels caught
  * Geographic validation flags non-NER coordinates
  * Temporal consistency validation works
  * Feature engineering produces correct dtypes
  * Data quality report generated correctly
  * Model metadata provenance is accurate
- Existing ML inference still works (regression)
- SHAP/explainability still works (regression)
"""

import os
import json
import tempfile
import pytest
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

_ML_DATA_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml", "data")
)
_ML_MODEL_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml", "models")
)


# ─────────────────────────────────────────────────────────────
# HELPER: Generate test dataframes
# ─────────────────────────────────────────────────────────────
def _make_valid_df(n=50) -> pd.DataFrame:
    """Creates a valid minimal dataset conforming to the feature contract."""
    np.random.seed(99)
    risk_scores = np.random.uniform(0, 100, n)
    categories = []
    for s in risk_scores:
        if s >= 75:
            categories.append("CRITICAL")
        elif s >= 50:
            categories.append("HIGH")
        elif s >= 25:
            categories.append("MEDIUM")
        else:
            categories.append("LOW")
    return pd.DataFrame({
        "distance_km": np.random.uniform(20, 600, n),
        "terrain_elevation_gain_m": np.random.uniform(100, 3000, n),
        "rainfall_mm_hr": np.random.uniform(0, 200, n),
        "active_incidents_count": np.random.randint(0, 8, n),
        "highest_severity_numeric": np.random.randint(0, 4, n),
        "road_blocked_status": np.random.randint(0, 2, n),
        "historical_landslide_freq": np.random.uniform(0.0, 1.0, n),
        "traffic_congestion_index": np.random.uniform(0.0, 1.0, n),
        "risk_score": np.round(risk_scores, 1),
        "risk_category": categories
    })


# ─────────────────────────────────────────────────────────────
# GAP 17.1: API ENDPOINTS
# ─────────────────────────────────────────────────────────────

def test_g17_01_status_endpoint_accessible():
    """GAP17-01: Gap 17 status endpoint is accessible."""
    res = client.get("/api/v1/ml-data/status")
    assert res.status_code == 200
    data = res.json()
    assert "implementation_status" in data
    assert "current_training_data" in data


def test_g17_02_status_labels_data_as_synthetic():
    """GAP17-02: Status endpoint correctly labels current data as SYNTHETIC_DEMO."""
    res = client.get("/api/v1/ml-data/status")
    assert res.status_code == 200
    data = res.json()
    current_data = data["current_training_data"]
    assert current_data["type"] == "SYNTHETIC_DEMO"
    # Must contain a disclaimer
    assert "disclaimer" in current_data
    disclaimer = current_data["disclaimer"].upper()
    assert "NOT REAL" in disclaimer or "SYNTHETIC" in disclaimer


def test_g17_03_status_real_data_not_ingested():
    """GAP17-03: Status honestly reports real data as NOT_INGESTED (unless it has been)."""
    res = client.get("/api/v1/ml-data/status")
    assert res.status_code == 200
    data = res.json()
    # Real data status must be explicitly stated
    assert "real_data_status" in data
    valid_statuses = {"NOT_INGESTED", "INGESTED_AND_TRAINED"}
    assert data["real_data_status"] in valid_statuses


def test_g17_04_status_contains_ingestion_procedure():
    """GAP17-04: Status provides step-by-step real data ingestion procedure."""
    res = client.get("/api/v1/ml-data/status")
    assert res.status_code == 200
    data = res.json()
    assert "how_to_ingest_real_data" in data
    procedure = data["how_to_ingest_real_data"]
    assert len(procedure) >= 3


def test_g17_05_status_lists_required_columns():
    """GAP17-05: Status lists required dataset columns."""
    res = client.get("/api/v1/ml-data/status")
    assert res.status_code == 200
    data = res.json()
    assert "required_columns" in data
    required = data["required_columns"]
    assert "distance_km" in required
    assert "risk_score" in required
    assert "risk_category" in required


def test_g17_06_registry_endpoint():
    """GAP17-06: Model registry endpoint is accessible."""
    res = client.get("/api/v1/ml-data/registry")
    assert res.status_code == 200
    data = res.json()
    # Registry should contain at least the synthetic model info
    assert "synthetic_model" in data or "active_inference_model" in data


def test_g17_07_feature_contract_accessible():
    """GAP17-07: Feature contract endpoint serves feature spec."""
    res = client.get("/api/v1/ml-data/feature-contract")
    assert res.status_code == 200
    data = res.json()
    assert "feature_order" in data
    assert "feature_specifications" in data
    assert "distance_km" in data["feature_order"]


def test_g17_08_dataset_schema_accessible():
    """GAP17-08: Dataset schema endpoint is accessible."""
    res = client.get("/api/v1/ml-data/dataset-schema")
    assert res.status_code == 200
    data = res.json()
    assert "columns" in data or "_disclaimer" in data


def test_g17_09_ingestion_history_accessible():
    """GAP17-09: Ingestion history endpoint is accessible."""
    res = client.get("/api/v1/ml-data/ingestion-history")
    assert res.status_code == 200
    data = res.json()
    assert "history" in data


def test_g17_10_quality_reports_accessible():
    """GAP17-10: Quality reports list endpoint is accessible."""
    res = client.get("/api/v1/ml-data/quality-reports")
    assert res.status_code == 200
    data = res.json()
    assert "total_reports" in data
    assert "reports" in data


# ─────────────────────────────────────────────────────────────
# GAP 17.2: INGESTION PIPELINE UNIT TESTS
# ─────────────────────────────────────────────────────────────

def test_g17_11_schema_validation_catches_missing_columns():
    """GAP17-11: Schema validator rejects datasets missing required columns."""
    from ml.src.ingest_real_data import load_and_validate_schema, _empty_report

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w") as f:
        # Missing 'risk_score' and 'risk_category'
        f.write("distance_km,terrain_elevation_gain_m\n")
        f.write("100,500\n")
        path = f.name

    report = _empty_report(path)
    df = load_and_validate_schema(path, report)
    assert df is None
    assert "missing_required_columns" in report["rejection_reasons"]
    os.unlink(path)


def test_g17_12_schema_validation_accepts_valid_dataset():
    """GAP17-12: Schema validator accepts a dataset with all required columns."""
    from ml.src.ingest_real_data import load_and_validate_schema, _empty_report

    valid_df = _make_valid_df(20)
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w") as f:
        valid_df.to_csv(f, index=False)
        path = f.name

    report = _empty_report(path)
    df = load_and_validate_schema(path, report)
    assert df is not None
    assert report["total_rows_read"] == 20
    os.unlink(path)


def test_g17_13_bounds_validation_rejects_out_of_range():
    """GAP17-13: Bounds validator rejects records with out-of-range values."""
    from ml.src.ingest_real_data import validate_and_clean, _empty_report

    df = _make_valid_df(20)
    # Inject 3 invalid records
    df.loc[0, "rainfall_mm_hr"] = 999.0   # Max is 300
    df.loc[1, "risk_score"] = 150.0        # Max is 100
    df.loc[2, "road_blocked_status"] = 5   # Must be 0 or 1

    report = _empty_report("test")
    report["total_rows_read"] = len(df)
    clean_df = validate_and_clean(df, report)

    assert report["rows_rejected"] >= 3
    assert report["rows_accepted"] == len(df) - report["rows_rejected"]


def test_g17_14_invalid_risk_categories_rejected():
    """GAP17-14: Invalid risk_category labels cause row rejection."""
    from ml.src.ingest_real_data import validate_and_clean, _empty_report

    df = _make_valid_df(15)
    df.loc[0, "risk_category"] = "UNKNOWN_LABEL"
    df.loc[1, "risk_category"] = "EXTREME"

    report = _empty_report("test")
    report["total_rows_read"] = len(df)
    clean_df = validate_and_clean(df, report)

    assert report["invalid_risk_categories"] >= 2
    assert report["rows_rejected"] >= 2


def test_g17_15_duplicate_rows_rejected():
    """GAP17-15: Duplicate rows (same feature values) are detected and removed."""
    from ml.src.ingest_real_data import validate_and_clean, _empty_report

    df = _make_valid_df(10)
    # Add 3 duplicate rows
    dup = df.iloc[0:3].copy()
    df = pd.concat([df, dup], ignore_index=True)

    report = _empty_report("test")
    report["total_rows_read"] = len(df)
    clean_df = validate_and_clean(df, report)

    assert report["duplicate_rows"] >= 3


def test_g17_16_missing_values_tracked():
    """GAP17-16: Missing values in required columns are counted per-column."""
    from ml.src.ingest_real_data import validate_and_clean, _empty_report

    df = _make_valid_df(20)
    df.loc[0:4, "rainfall_mm_hr"] = float("nan")
    df.loc[2:3, "distance_km"] = float("nan")

    report = _empty_report("test")
    report["total_rows_read"] = len(df)
    validate_and_clean(df, report)

    assert "rainfall_mm_hr" in report["missing_values_per_column"]
    assert report["missing_values_per_column"]["rainfall_mm_hr"] >= 5


def test_g17_17_ner_geographic_validation():
    """GAP17-17: Coordinates outside NER bounding box are flagged."""
    from ml.src.ingest_real_data import validate_geographic_scope, _empty_report

    df = _make_valid_df(10)
    # Add non-NER coordinates (Mumbai)
    df["origin_lat"] = 26.1445   # Valid NER
    df["origin_lng"] = 91.7362
    df.loc[0, "origin_lat"] = 19.0  # Mumbai — outside NER
    df.loc[0, "origin_lng"] = 72.8

    report = _empty_report("test")
    validate_geographic_scope(df, report)

    assert report["ner_geographic_violations"] >= 1


def test_g17_18_valid_ner_coordinates_pass():
    """GAP17-18: Valid NER coordinates produce zero geographic violations."""
    from ml.src.ingest_real_data import validate_geographic_scope, _empty_report

    df = _make_valid_df(10)
    df["origin_lat"] = 26.1445  # Guwahati
    df["origin_lng"] = 91.7362

    report = _empty_report("test")
    validate_geographic_scope(df, report)

    assert report["ner_geographic_violations"] == 0


def test_g17_19_temporal_consistency_coverage():
    """GAP17-19: Temporal validation reports date coverage when recorded_date is present."""
    from ml.src.ingest_real_data import validate_temporal_consistency, _empty_report

    df = _make_valid_df(10)
    df["recorded_date"] = pd.date_range("2023-06-01", periods=10, freq="30D")

    report = _empty_report("test")
    temporal = validate_temporal_consistency(df, report)

    assert temporal["earliest"] is not None
    assert temporal["latest"] is not None
    assert temporal["future_records"] == 0


def test_g17_20_feature_engineering_correct_dtypes():
    """GAP17-20: Feature engineering produces correct dtypes per contract."""
    from ml.src.ingest_real_data import engineer_features

    df = _make_valid_df(10)
    engineered = engineer_features(df)

    # Integer columns
    for col in ["active_incidents_count", "highest_severity_numeric", "road_blocked_status"]:
        assert engineered[col].dtype in [int, "int32", "int64"], f"{col} should be integer"

    # Float columns
    for col in ["distance_km", "rainfall_mm_hr", "risk_score"]:
        assert engineered[col].dtype in [float, "float32", "float64"], f"{col} should be float"


# ─────────────────────────────────────────────────────────────
# GAP 17.3: PROVENANCE & MODEL METADATA
# ─────────────────────────────────────────────────────────────

def test_g17_21_existing_model_metadata_has_no_fake_accuracy():
    """GAP17-21: Existing model_metadata.json does not claim production-level accuracy."""
    meta_path = os.path.join(_ML_MODEL_DIR, "model_metadata.json")
    if not os.path.exists(meta_path):
        pytest.skip("model_metadata.json not found — model not trained yet")

    with open(meta_path) as f:
        meta = json.load(f)

    # Accuracy should be a real number from actual training, not a claimed 1.0
    acc = meta.get("metrics", {}).get("accuracy", None)
    if acc is not None:
        assert 0.0 < acc < 1.0, "Accuracy must be between 0 and 1 (not fabricated as 1.0)"


def test_g17_22_feature_contract_matches_training_features():
    """GAP17-22: feature_contract.json matches the actual features used in train.py."""
    contract_path = os.path.join(_ML_DATA_DIR, "feature_contract.json")
    assert os.path.exists(contract_path), "feature_contract.json must exist"

    with open(contract_path) as f:
        contract = json.load(f)

    expected_features = [
        "distance_km", "terrain_elevation_gain_m", "rainfall_mm_hr",
        "active_incidents_count", "highest_severity_numeric", "road_blocked_status",
        "historical_landslide_freq", "traffic_congestion_index"
    ]
    for feat in expected_features:
        assert feat in contract["feature_order"], f"Feature {feat} missing from contract"


def test_g17_23_dataset_schema_labels_data_as_simulated():
    """GAP17-23: dataset_schema.json explicitly labels data type."""
    schema_path = os.path.join(_ML_DATA_DIR, "dataset_schema.json")
    assert os.path.exists(schema_path), "dataset_schema.json must exist"

    with open(schema_path) as f:
        schema = json.load(f)

    # data_type must be present and honest
    assert "data_type" in schema
    assert "SIMULATED" in schema["data_type"].upper() or "SYNTHETIC" in schema["data_type"].upper()


def test_g17_24_ingestion_log_structure():
    """GAP17-24: Ingestion history log has correct structure when it exists."""
    log_path = os.path.join(_ML_DATA_DIR, "ingestion_history.json")
    if not os.path.exists(log_path):
        pytest.skip("ingestion_history.json not yet created — no ingestion has occurred")

    with open(log_path) as f:
        history = json.load(f)

    assert isinstance(history, list)
    if history:
        entry = history[0]
        assert "timestamp" in entry
        assert "rows_accepted" in entry
        assert "data_source_type" in entry


# ─────────────────────────────────────────────────────────────
# GAP 17.4: REGRESSION — EXISTING ML INFERENCE STILL WORKS
# ─────────────────────────────────────────────────────────────

def test_g17_25_ml_predict_still_works():
    """GAP17-25: Existing /api/v1/ml/predict endpoint still works after gap 17 additions."""
    payload = {
        "origin_city": "Guwahati",
        "destination_city": "Imphal",
        "distance_km": 280,
        "terrain_elevation_gain_m": 1850,
        "rainfall_mm_hr": 75,
        "active_incidents_count": 2,
        "highest_severity_numeric": 3,
        "road_blocked_status": 1,
        "historical_landslide_freq": 0.65,
        "traffic_congestion_index": 0.4
    }
    res = client.post("/api/v1/ml/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "prediction" in data
    assert "explanation" in data
    pred = data["prediction"]
    assert "risk_score" in pred
    assert "risk_category" in pred
    assert pred["risk_category"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert 0.0 <= pred["risk_score"] <= 100.0


def test_g17_26_ml_predict_provenance_included():
    """GAP17-26: ML prediction result includes data provenance information."""
    payload = {
        "origin_city": "Guwahati",
        "destination_city": "Shillong",
        "distance_km": 150,
        "terrain_elevation_gain_m": 800,
        "rainfall_mm_hr": 30,
        "active_incidents_count": 0,
        "highest_severity_numeric": 0,
        "road_blocked_status": 0,
        "historical_landslide_freq": 0.2,
        "traffic_congestion_index": 0.3
    }
    res = client.post("/api/v1/ml/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    pred = data["prediction"]
    assert "data_provenance" in pred


def test_g17_27_ml_metadata_endpoint_returns_version():
    """GAP17-27: /api/v1/ml/metadata returns model version information."""
    res = client.get("/api/v1/ml/metadata")
    assert res.status_code == 200
    data = res.json()
    assert "model_version" in data or "status" in data


def test_g17_28_ml_explainability_still_works():
    """GAP17-28: SHAP/explainability still returns feature-tied reasons after gap 17."""
    payload = {
        "origin_city": "Silchar",
        "destination_city": "Aizawl",
        "distance_km": 280,
        "terrain_elevation_gain_m": 1850,
        "rainfall_mm_hr": 90,
        "active_incidents_count": 3,
        "highest_severity_numeric": 4,
        "road_blocked_status": 1,
        "historical_landslide_freq": 0.75,
        "traffic_congestion_index": 0.6
    }
    res = client.post("/api/v1/ml/predict", json=payload)
    assert res.status_code == 200
    explanation = res.json()["explanation"]
    assert "primary_reasons" in explanation
    assert len(explanation["primary_reasons"]) > 0
    assert "recommended_action" in explanation
    assert "feature_importance_weights" in explanation


def test_g17_29_dry_run_pipeline_with_valid_file():
    """GAP17-29: Dry-run validation of a valid dataset completes successfully."""
    from ml.src.ingest_real_data import ingest_real_dataset

    df = _make_valid_df(50)
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w") as f:
        df.to_csv(f, index=False)
        path = f.name

    report = ingest_real_dataset(
        input_path=path,
        data_source_description="TEST_SYNTHETIC_PROXY",
        dry_run=True
    )

    assert report["status"] == "DRY_RUN_COMPLETE"
    assert report["rows_accepted"] >= 40  # Most of 50 should pass
    assert report["rows_rejected"] >= 0
    os.unlink(path)


def test_g17_30_model_registry_distinguishes_synthetic_from_real():
    """GAP17-30: Model registry clearly separates synthetic and real models."""
    res = client.get("/api/v1/ml-data/registry")
    assert res.status_code == 200
    data = res.json()
    # Registry should have synthetic_model key
    assert "synthetic_model" in data
    # If real model exists, it should be in a separate key
    if data.get("real_data_model"):
        # Both should have explicit training_data_type
        real_meta = data["real_data_model"]
        if "training_data_type" in real_meta:
            assert "VERIFIED" in real_meta["training_data_type"] or "REAL" in real_meta["training_data_type"]
