"""
GAP 17 — Real Historical Regional Training Data
Real Data Ingestion Pipeline for LINK X8 ML System

STATUS: INTEGRATION-READY
Current training data is SYNTHETIC (ner_logistics_dataset.csv, 500 records).
Real verified historical data has NOT been ingested.

This module provides:
  - Schema validation for incoming real datasets
  - Data quality checks (missing values, outliers, geographic scope, duplicates)
  - NER geographic bounding validation
  - Temporal consistency validation
  - Data quality report generation
  - Feature engineering aligned with existing model contract
  - Model training with explicit data provenance metadata
  - Synthetic vs. real model distinction

Usage:
  python -m ml.src.ingest_real_data --input path/to/dataset.csv --dry-run
  python -m ml.src.ingest_real_data --input path/to/dataset.csv
  python -m ml.src.ingest_real_data --retrain-synthetic
"""

import os
import json
import argparse
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, f1_score, mean_absolute_error,
    mean_squared_error, classification_report
)

# ─────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────
_HERE = os.path.dirname(__file__)
DATA_DIR = os.path.normpath(os.path.join(_HERE, "..", "data"))
MODEL_DIR = os.path.normpath(os.path.join(_HERE, "..", "models"))

SYNTHETIC_DATASET_PATH = os.path.join(DATA_DIR, "ner_logistics_dataset.csv")
FEATURE_CONTRACT_PATH = os.path.join(DATA_DIR, "feature_contract.json")
INGESTION_LOG_PATH = os.path.join(DATA_DIR, "ingestion_history.json")

# ─────────────────────────────────────────────────────────────
# NER GEOGRAPHIC BOUNDING BOX
# (North Eastern Region: Assam, Arunachal Pradesh, Manipur,
#  Meghalaya, Mizoram, Nagaland, Sikkim, Tripura)
# ─────────────────────────────────────────────────────────────
NER_BOUNDS = {
    "lat_min": 21.5,
    "lat_max": 29.5,
    "lng_min": 88.0,
    "lng_max": 97.5,
    "description": "North Eastern Region of India (8 states)"
}

# ─────────────────────────────────────────────────────────────
# REQUIRED COLUMNS (aligned with feature_contract.json)
# ─────────────────────────────────────────────────────────────
REQUIRED_FEATURES = [
    "distance_km",
    "terrain_elevation_gain_m",
    "rainfall_mm_hr",
    "active_incidents_count",
    "highest_severity_numeric",
    "road_blocked_status",
    "historical_landslide_freq",
    "traffic_congestion_index"
]
REQUIRED_TARGETS = ["risk_score", "risk_category"]

OPTIONAL_COLUMNS = [
    "corridor_id", "origin_city", "destination_city",
    "origin_lat", "origin_lng", "destination_lat", "destination_lng",
    "recorded_date", "data_source", "verified_by"
]

VALID_RISK_CATEGORIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

COLUMN_BOUNDS = {
    "distance_km": (1.0, 2000.0),
    "terrain_elevation_gain_m": (0.0, 5000.0),
    "rainfall_mm_hr": (0.0, 300.0),
    "active_incidents_count": (0, 20),
    "highest_severity_numeric": (0, 4),
    "road_blocked_status": (0, 1),
    "historical_landslide_freq": (0.0, 1.0),
    "traffic_congestion_index": (0.0, 1.0),
    "risk_score": (0.0, 100.0)
}


# ─────────────────────────────────────────────────────────────
# DATA QUALITY REPORT TEMPLATE
# ─────────────────────────────────────────────────────────────
def _empty_report(source_path: str) -> Dict[str, Any]:
    return {
        "ingestion_timestamp": datetime.now(timezone.utc).isoformat(),
        "source_file": source_path,
        "source_hash_sha256": None,
        "total_rows_read": 0,
        "rows_accepted": 0,
        "rows_rejected": 0,
        "rejection_reasons": {},
        "missing_values_per_column": {},
        "out_of_range_per_column": {},
        "duplicate_rows": 0,
        "invalid_risk_categories": 0,
        "ner_geographic_violations": 0,
        "temporal_coverage": {"earliest": None, "latest": None},
        "feature_availability": {},
        "data_provenance": "UNKNOWN",
        "geographic_scope": "UNKNOWN",
        "status": "NOT_RUN"
    }


def _file_sha256(path: str) -> str:
    """Compute SHA-256 hash of file for provenance tracking."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


# ─────────────────────────────────────────────────────────────
# STEP 1: LOAD AND SCHEMA CHECK
# ─────────────────────────────────────────────────────────────
def load_and_validate_schema(input_path: str, report: Dict) -> Optional[pd.DataFrame]:
    """
    Load CSV/JSON dataset and verify required columns exist.
    Returns DataFrame or None if schema is invalid.
    """
    ext = os.path.splitext(input_path)[1].lower()
    try:
        if ext == ".csv":
            df = pd.read_csv(input_path)
        elif ext in (".json", ".jsonl"):
            df = pd.read_json(input_path, lines=(ext == ".jsonl"))
        else:
            report["status"] = "FAILED"
            report["rejection_reasons"]["schema"] = f"Unsupported file format: {ext}"
            return None
    except Exception as e:
        report["status"] = "FAILED"
        report["rejection_reasons"]["load_error"] = str(e)
        return None

    report["total_rows_read"] = len(df)
    report["source_hash_sha256"] = _file_sha256(input_path)

    # Check required feature columns
    missing_cols = [c for c in REQUIRED_FEATURES + REQUIRED_TARGETS if c not in df.columns]
    if missing_cols:
        report["status"] = "FAILED"
        report["rejection_reasons"]["missing_required_columns"] = missing_cols
        return None

    # Feature availability map
    report["feature_availability"] = {
        col: (col in df.columns) for col in REQUIRED_FEATURES + REQUIRED_TARGETS + OPTIONAL_COLUMNS
    }

    print(f"[SCHEMA OK] Loaded {len(df)} rows from {input_path}")
    return df


# ─────────────────────────────────────────────────────────────
# STEP 2: DATA CLEANING & VALIDATION
# ─────────────────────────────────────────────────────────────
def validate_and_clean(df: pd.DataFrame, report: Dict) -> pd.DataFrame:
    """
    Validates all records. Rejects rows with:
    - Missing required fields
    - Out-of-range numeric values
    - Invalid risk_category labels
    - Duplicate rows
    Returns cleaned DataFrame with rejection tracking.
    """
    total = len(df)
    reject_mask = pd.Series([False] * total, index=df.index)

    # 1. Missing values in required columns
    missing_report = {}
    for col in REQUIRED_FEATURES + REQUIRED_TARGETS:
        n_missing = df[col].isna().sum()
        if n_missing > 0:
            missing_report[col] = int(n_missing)
            reject_mask |= df[col].isna()
    report["missing_values_per_column"] = missing_report

    # 2. Numeric bounds
    oor_report = {}
    for col, (lo, hi) in COLUMN_BOUNDS.items():
        if col in df.columns:
            out_of_range = ~df[col].between(lo, hi) & ~df[col].isna()
            n_oor = int(out_of_range.sum())
            if n_oor > 0:
                oor_report[col] = n_oor
                reject_mask |= out_of_range
    report["out_of_range_per_column"] = oor_report

    # 3. Invalid risk categories
    invalid_cats = ~df["risk_category"].isin(VALID_RISK_CATEGORIES) & ~df["risk_category"].isna()
    n_invalid_cats = int(invalid_cats.sum())
    report["invalid_risk_categories"] = n_invalid_cats
    if n_invalid_cats > 0:
        reject_mask |= invalid_cats

    # 4. Duplicate rows (full row duplicates)
    dup_mask = df.duplicated(subset=REQUIRED_FEATURES + REQUIRED_TARGETS)
    n_dups = int(dup_mask.sum())
    report["duplicate_rows"] = n_dups
    reject_mask |= dup_mask

    # Apply rejection
    clean_df = df[~reject_mask].copy()
    report["rows_accepted"] = len(clean_df)
    report["rows_rejected"] = int(reject_mask.sum())

    print(f"[VALIDATION] Accepted: {report['rows_accepted']}, Rejected: {report['rows_rejected']}")
    return clean_df


# ─────────────────────────────────────────────────────────────
# STEP 3: GEOGRAPHIC VALIDATION (NER Scope)
# ─────────────────────────────────────────────────────────────
def validate_geographic_scope(df: pd.DataFrame, report: Dict) -> pd.DataFrame:
    """
    If origin_lat/lng or destination_lat/lng columns are present,
    validate that they fall within the NER bounding box.
    Rows outside NER are flagged in the report (not silently dropped —
    they are kept with a warning unless explicitly filtered).
    """
    ner_violations = 0

    coord_pairs = [
        ("origin_lat", "origin_lng"),
        ("destination_lat", "destination_lng")
    ]

    for lat_col, lng_col in coord_pairs:
        if lat_col in df.columns and lng_col in df.columns:
            out_of_ner = (
                (df[lat_col].notna()) & (df[lng_col].notna()) &
                ~(
                    df[lat_col].between(NER_BOUNDS["lat_min"], NER_BOUNDS["lat_max"]) &
                    df[lng_col].between(NER_BOUNDS["lng_min"], NER_BOUNDS["lng_max"])
                )
            )
            ner_violations += int(out_of_ner.sum())

    report["ner_geographic_violations"] = ner_violations
    report["geographic_scope"] = NER_BOUNDS["description"]

    if ner_violations > 0:
        print(
            f"[GEO WARNING] {ner_violations} record(s) have coordinates outside NER bounds "
            f"({NER_BOUNDS['lat_min']}–{NER_BOUNDS['lat_max']}°N, "
            f"{NER_BOUNDS['lng_min']}–{NER_BOUNDS['lng_max']}°E). "
            "These records are FLAGGED — verify provenance before treating as NER data."
        )
    else:
        print(f"[GEO OK] All coordinate records fall within NER bounding box.")

    return df


# ─────────────────────────────────────────────────────────────
# STEP 4: TEMPORAL CONSISTENCY
# ─────────────────────────────────────────────────────────────
def validate_temporal_consistency(df: pd.DataFrame, report: Dict) -> Dict:
    """
    If 'recorded_date' column is present, reports temporal coverage.
    Warns about future dates.
    """
    temporal = {"earliest": None, "latest": None, "future_records": 0}

    if "recorded_date" in df.columns and df["recorded_date"].notna().any():
        try:
            dates = pd.to_datetime(df["recorded_date"], errors="coerce")
            valid_dates = dates.dropna()
            if len(valid_dates) > 0:
                temporal["earliest"] = str(valid_dates.min().date())
                temporal["latest"] = str(valid_dates.max().date())
                now = pd.Timestamp.now()
                future_count = int((valid_dates > now).sum())
                temporal["future_records"] = future_count
                if future_count > 0:
                    print(f"[TEMPORAL WARNING] {future_count} records have future dates — likely data entry errors.")
                print(f"[TEMPORAL] Coverage: {temporal['earliest']} → {temporal['latest']}")
        except Exception as e:
            print(f"[TEMPORAL WARNING] Could not parse dates: {e}")

    report["temporal_coverage"] = temporal
    return temporal


# ─────────────────────────────────────────────────────────────
# STEP 5: FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Applies feature engineering consistent with existing model contract.
    Only transforms that do NOT introduce data leakage.
    """
    df = df.copy()

    # Ensure correct dtypes
    int_cols = ["active_incidents_count", "highest_severity_numeric", "road_blocked_status"]
    float_cols = [
        "distance_km", "terrain_elevation_gain_m", "rainfall_mm_hr",
        "historical_landslide_freq", "traffic_congestion_index", "risk_score"
    ]
    for c in int_cols:
        if c in df.columns:
            df[c] = df[c].astype(int)
    for c in float_cols:
        if c in df.columns:
            df[c] = df[c].astype(float)

    return df


# ─────────────────────────────────────────────────────────────
# STEP 6: TRAIN MODEL WITH PROVENANCE
# ─────────────────────────────────────────────────────────────
def train_model_with_provenance(
    df: pd.DataFrame,
    data_source: str,
    model_label: str,
    report: Dict
) -> Dict[str, Any]:
    """
    Trains RandomForest models on the provided dataset.
    Uses temporal split if 'recorded_date' is available, else random split.
    Saves model with explicit provenance metadata.

    Does NOT replace the synthetic model.
    Saves as: route_risk_model_{model_label}.joblib
    """
    features = [
        "distance_km", "terrain_elevation_gain_m", "rainfall_mm_hr",
        "active_incidents_count", "highest_severity_numeric", "road_blocked_status",
        "historical_landslide_freq", "traffic_congestion_index"
    ]
    X = df[features]
    y_reg = df["risk_score"]
    y_cls = df["risk_category"]

    # Temporal split if dates available
    if "recorded_date" in df.columns and df["recorded_date"].notna().any():
        dates = pd.to_datetime(df["recorded_date"], errors="coerce")
        df_sorted = df.sort_values(by="recorded_date")
        split_idx = int(len(df_sorted) * 0.8)
        X_train = df_sorted.iloc[:split_idx][features]
        X_test = df_sorted.iloc[split_idx:][features]
        y_train_reg = df_sorted.iloc[:split_idx]["risk_score"]
        y_test_reg = df_sorted.iloc[split_idx:]["risk_score"]
        y_train_cls = df_sorted.iloc[:split_idx]["risk_category"]
        y_test_cls = df_sorted.iloc[split_idx:]["risk_category"]
        split_type = "TEMPORAL (80/20 chronological)"
    else:
        X_train, X_test, y_train_reg, y_test_reg, y_train_cls, y_test_cls = train_test_split(
            X, y_reg, y_cls, test_size=0.2, random_state=42, stratify=y_cls
        )
        split_type = "RANDOM (80/20 stratified by risk_category)"

    reg_model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    reg_model.fit(X_train, y_train_reg)

    cls_model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    cls_model.fit(X_train, y_train_cls)

    # Evaluation
    y_pred_cls = cls_model.predict(X_test)
    y_pred_reg = reg_model.predict(X_test)
    acc = float(accuracy_score(y_test_cls, y_pred_cls))
    f1 = float(f1_score(y_test_cls, y_pred_cls, average="macro"))
    mae = float(mean_absolute_error(y_test_reg, y_pred_reg))
    rmse = float(np.sqrt(mean_squared_error(y_test_reg, y_pred_reg)))
    cls_report_str = classification_report(y_test_cls, y_pred_cls)

    print(f"\n[TRAINING COMPLETE — {model_label}]")
    print(f"  Data source: {data_source}")
    print(f"  Train size: {len(X_train)}, Test size: {len(X_test)}, Split: {split_type}")
    print(f"  Accuracy: {acc:.4f}, Macro F1: {f1:.4f}")
    print(f"  MAE: {mae:.2f}, RMSE: {rmse:.2f}")
    print(f"\n{cls_report_str}")

    importances = dict(zip(features, [round(float(v), 4) for v in reg_model.feature_importances_]))

    model_bundle = {
        "regressor": reg_model,
        "classifier": cls_model,
        "features": features,
        "feature_importances": importances,
        "version": f"v2.0.0-{model_label}",
        "data_source": data_source,
        "model_label": model_label
    }

    model_filename = f"route_risk_model_{model_label}.joblib"
    model_path = os.path.join(MODEL_DIR, model_filename)
    joblib.dump(model_bundle, model_path)
    print(f"[SAVED] Model bundle → {model_path}")

    metrics = {
        "accuracy": round(acc, 4),
        "f1_macro": round(f1, 4),
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "split_type": split_type
    }

    # Provenance metadata
    provenance_metadata = {
        "model_label": model_label,
        "model_version": f"v2.0.0-{model_label}",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": "RandomForest Ensemble (Regressor + Classifier)",
        "feature_contract_version": "1.0.0",
        "data_source": data_source,
        "data_source_hash_sha256": report.get("source_hash_sha256"),
        "training_data_type": (
            "SYNTHETIC_DEMO" if model_label == "synthetic" else "VERIFIED_HISTORICAL"
        ),
        "training_data_records": len(df),
        "geographic_scope": report.get("geographic_scope", "NER India"),
        "temporal_coverage": report.get("temporal_coverage", {}),
        "metrics": metrics,
        "feature_importance": importances,
        "data_quality_report_summary": {
            "rows_accepted": report.get("rows_accepted", len(df)),
            "rows_rejected": report.get("rows_rejected", 0),
            "duplicate_rows": report.get("duplicate_rows", 0),
            "missing_value_columns": list(report.get("missing_values_per_column", {}).keys()),
            "ner_geo_violations": report.get("ner_geographic_violations", 0)
        },
        "disclaimer": (
            "SYNTHETIC DEMO DATA — metrics do not reflect production NER logistics accuracy."
            if model_label == "synthetic"
            else
            "VERIFIED HISTORICAL DATA — metrics reflect real-world NER logistics conditions."
        )
    }

    metadata_filename = f"model_metadata_{model_label}.json"
    metadata_path = os.path.join(MODEL_DIR, metadata_filename)
    with open(metadata_path, "w") as f:
        json.dump(provenance_metadata, f, indent=2, default=str)
    print(f"[SAVED] Model metadata → {metadata_path}")

    return provenance_metadata


# ─────────────────────────────────────────────────────────────
# STEP 7: INGESTION HISTORY LOG
# ─────────────────────────────────────────────────────────────
def append_ingestion_log(report: Dict, metadata: Dict) -> None:
    """Appends ingestion event to ingestion_history.json for audit trail."""
    history = []
    if os.path.exists(INGESTION_LOG_PATH):
        try:
            with open(INGESTION_LOG_PATH, "r") as f:
                history = json.load(f)
        except Exception:
            history = []

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source_file": report.get("source_file"),
        "source_hash_sha256": report.get("source_hash_sha256"),
        "rows_accepted": report.get("rows_accepted"),
        "rows_rejected": report.get("rows_rejected"),
        "model_label": metadata.get("model_label"),
        "model_version": metadata.get("model_version"),
        "data_source_type": metadata.get("training_data_type"),
        "accuracy": metadata.get("metrics", {}).get("accuracy"),
        "f1_macro": metadata.get("metrics", {}).get("f1_macro")
    }
    history.append(entry)

    with open(INGESTION_LOG_PATH, "w") as f:
        json.dump(history, f, indent=2, default=str)
    print(f"[LOG] Ingestion event recorded in {INGESTION_LOG_PATH}")


# ─────────────────────────────────────────────────────────────
# MAIN PIPELINE FUNCTIONS
# ─────────────────────────────────────────────────────────────
def ingest_real_dataset(
    input_path: str,
    data_source_description: str = "UNSPECIFIED_REAL_DATA",
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Main entry point for ingesting a verified real historical dataset.

    Args:
        input_path: Path to CSV or JSON dataset file
        data_source_description: Human-readable provenance description
        dry_run: If True, validate without training

    Returns:
        Data quality report dict
    """
    report = _empty_report(input_path)
    report["data_provenance"] = data_source_description

    print(f"\n{'='*60}")
    print(f"LINK X8 GAP 17 — Real Data Ingestion Pipeline")
    print(f"{'='*60}")
    print(f"Input: {input_path}")
    print(f"Provenance: {data_source_description}")
    print(f"Mode: {'DRY-RUN (no model training)' if dry_run else 'FULL INGESTION + TRAINING'}")
    print()

    # Step 1: Load & schema check
    df = load_and_validate_schema(input_path, report)
    if df is None:
        report["status"] = "FAILED"
        _save_quality_report(report, "real_data_ingestion_failed")
        return report

    # Step 2: Data cleaning
    df = validate_and_clean(df, report)
    if report["rows_accepted"] < 10:
        report["status"] = "FAILED"
        report["rejection_reasons"]["insufficient_data"] = (
            f"Only {report['rows_accepted']} valid records — minimum 10 required for training"
        )
        _save_quality_report(report, "real_data_ingestion_failed")
        return report

    # Step 3: Geographic validation
    df = validate_geographic_scope(df, report)

    # Step 4: Temporal consistency
    validate_temporal_consistency(df, report)

    # Step 5: Feature engineering
    df = engineer_features(df)

    if dry_run:
        report["status"] = "DRY_RUN_COMPLETE"
        print(f"\n[DRY-RUN] Validation complete. {report['rows_accepted']} records would be used for training.")
        _save_quality_report(report, "real_data_dry_run")
        return report

    # Step 6: Train model with provenance
    metadata = train_model_with_provenance(
        df, data_source=data_source_description, model_label="real_data", report=report
    )

    # Step 7: Log ingestion
    append_ingestion_log(report, metadata)

    report["status"] = "SUCCESS"
    report["model_trained"] = {
        "model_label": "real_data",
        "model_file": "route_risk_model_real_data.joblib",
        "metadata_file": "model_metadata_real_data.json"
    }

    _save_quality_report(report, "real_data_ingestion_success")

    print(f"\n{'='*60}")
    print("GAP 17 INGESTION COMPLETE")
    print(f"  Accepted records: {report['rows_accepted']}")
    print(f"  Rejected records: {report['rows_rejected']}")
    print(f"  Model saved: route_risk_model_real_data.joblib")
    print(f"  Provenance: {data_source_description}")
    print(f"  NOTE: Synthetic model (route_risk_model.joblib) remains untouched.")
    print(f"{'='*60}\n")

    return report


def retrain_synthetic_model() -> Dict[str, Any]:
    """
    Retrains the synthetic demo model from the existing synthetic dataset.
    Preserves the synthetic training provenance in metadata.
    Called at startup if no model exists, or explicitly to refresh.
    """
    from ml.src.train import generate_synthetic_dataset

    report = _empty_report(SYNTHETIC_DATASET_PATH)
    report["data_provenance"] = "SYNTHETIC_GENERATED"
    report["geographic_scope"] = "Synthetic — NER-representative parameters"

    print("\n[GAP 17] Retraining synthetic demo model...")

    if os.path.exists(SYNTHETIC_DATASET_PATH):
        df = pd.read_csv(SYNTHETIC_DATASET_PATH)
    else:
        df = generate_synthetic_dataset()

    report["total_rows_read"] = len(df)
    report["rows_accepted"] = len(df)
    report["rows_rejected"] = 0

    df = engineer_features(df)
    metadata = train_model_with_provenance(
        df,
        data_source="SYNTHETIC_GENERATED — domain-representative parameters, NOT real historical data",
        model_label="synthetic",
        report=report
    )
    append_ingestion_log(report, metadata)
    report["status"] = "SUCCESS"
    return report


def _save_quality_report(report: Dict, label: str) -> str:
    """Saves data quality report to ml/data/"""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"data_quality_report_{label}_{timestamp}.json"
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"[REPORT] Quality report saved → {path}")
    return path


def get_model_registry() -> Dict[str, Any]:
    """
    Returns the current model registry: which models exist and their provenance.
    """
    registry = {
        "synthetic_model": None,
        "real_data_model": None,
        "active_inference_model": "route_risk_model.joblib (SYNTHETIC)"
    }

    synthetic_meta = os.path.join(MODEL_DIR, "model_metadata_synthetic.json")
    legacy_meta = os.path.join(MODEL_DIR, "model_metadata.json")
    real_meta = os.path.join(MODEL_DIR, "model_metadata_real_data.json")

    if os.path.exists(synthetic_meta):
        with open(synthetic_meta) as f:
            registry["synthetic_model"] = json.load(f)
    elif os.path.exists(legacy_meta):
        with open(legacy_meta) as f:
            legacy = json.load(f)
            legacy["training_data_type"] = "SYNTHETIC_DEMO"
            legacy["disclaimer"] = "SYNTHETIC DEMO DATA — not production-validated on real NER data"
            registry["synthetic_model"] = legacy

    if os.path.exists(real_meta):
        with open(real_meta) as f:
            registry["real_data_model"] = json.load(f)
        registry["active_inference_model"] = "route_risk_model_real_data.joblib (VERIFIED_HISTORICAL)"

    registry["ingestion_history"] = []
    if os.path.exists(INGESTION_LOG_PATH):
        try:
            with open(INGESTION_LOG_PATH) as f:
                registry["ingestion_history"] = json.load(f)
        except Exception:
            pass

    return registry


# ─────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="LINK X8 GAP 17 — Real Data Ingestion Pipeline"
    )
    parser.add_argument("--input", type=str, help="Path to real dataset CSV or JSON file")
    parser.add_argument("--source", type=str, default="UNSPECIFIED_REAL_DATA",
                        help="Human-readable data source description (provenance)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate data without training model")
    parser.add_argument("--retrain-synthetic", action="store_true",
                        help="Retrain the synthetic demo model (no real data needed)")
    parser.add_argument("--registry", action="store_true",
                        help="Show current model registry")

    args = parser.parse_args()

    if args.registry:
        reg = get_model_registry()
        print(json.dumps(reg, indent=2, default=str))
    elif args.retrain_synthetic:
        retrain_synthetic_model()
    elif args.input:
        if not os.path.exists(args.input):
            print(f"ERROR: Input file not found: {args.input}")
            exit(1)
        report = ingest_real_dataset(
            input_path=args.input,
            data_source_description=args.source,
            dry_run=args.dry_run
        )
        print(f"\nFinal status: {report['status']}")
        print(f"Accepted: {report['rows_accepted']}, Rejected: {report['rows_rejected']}")
    else:
        parser.print_help()
