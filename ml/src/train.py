import json
import os
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, f1_score, accuracy_score

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

def generate_synthetic_dataset():
    """Generates a structured, domain-realistic dataset for NER Logistics disruption."""
    np.random.seed(42)
    n_samples = 500

    distances = np.random.uniform(20, 600, n_samples)
    elevations = np.random.uniform(100, 3200, n_samples)
    rainfalls = np.random.exponential(scale=25, size=n_samples)
    rainfalls = np.clip(rainfalls, 0, 220)
    
    incidents_count = np.random.poisson(lam=1.2, size=n_samples)
    incidents_count = np.clip(incidents_count, 0, 8)

    severities = []
    for inc in incidents_count:
        if inc == 0:
            severities.append(0)
        else:
            severities.append(np.random.choice([1, 2, 3, 4], p=[0.3, 0.4, 0.2, 0.1]))
    severities = np.array(severities)

    blocked = []
    for sev in severities:
        if sev == 4:
            blocked.append(np.random.choice([0, 1], p=[0.1, 0.9]))
        elif sev == 3:
            blocked.append(np.random.choice([0, 1], p=[0.4, 0.6]))
        elif sev == 2:
            blocked.append(np.random.choice([0, 1], p=[0.85, 0.15]))
        else:
            blocked.append(0)
    blocked = np.array(blocked)

    landslide_freq = np.random.beta(a=2, b=5, size=n_samples)
    congestion = np.random.uniform(0.05, 0.95, n_samples)

    # Compute risk score with domain formula + noise
    base_risk = (
        (blocked * 45.0) +
        (severities * 8.5) +
        (rainfalls * 0.18) +
        (incidents_count * 4.0) +
        (landslide_freq * 15.0) +
        (elevations / 3000.0 * 8.0) +
        (congestion * 6.0)
    )
    
    risk_scores = np.clip(base_risk + np.random.normal(0, 3.0, n_samples), 0, 100)

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

    df = pd.DataFrame({
        "distance_km": np.round(distances, 1),
        "terrain_elevation_gain_m": np.round(elevations, 1),
        "rainfall_mm_hr": np.round(rainfalls, 1),
        "active_incidents_count": incidents_count,
        "highest_severity_numeric": severities,
        "road_blocked_status": blocked,
        "historical_landslide_freq": np.round(landslide_freq, 3),
        "traffic_congestion_index": np.round(congestion, 2),
        "risk_score": np.round(risk_scores, 1),
        "risk_category": categories
    })

    csv_path = os.path.join(DATA_DIR, "ner_logistics_dataset.csv")
    df.to_csv(csv_path, index=False)
    print(f"Generated synthetic dataset with {len(df)} records at {csv_path}")
    return df

def train_and_save_model():
    dataset_path = os.path.join(DATA_DIR, "ner_logistics_dataset.csv")
    if not os.path.exists(dataset_path):
        df = generate_synthetic_dataset()
    else:
        df = pd.read_csv(dataset_path)

    features = [
        "distance_km",
        "terrain_elevation_gain_m",
        "rainfall_mm_hr",
        "active_incidents_count",
        "highest_severity_numeric",
        "road_blocked_status",
        "historical_landslide_freq",
        "traffic_congestion_index"
    ]

    X = df[features]
    y_reg = df["risk_score"]
    y_cls = df["risk_category"]

    X_train, X_test, y_train_reg, y_test_reg, y_train_cls, y_test_cls = train_test_split(
        X, y_reg, y_cls, test_size=0.2, random_state=42, stratify=y_cls
    )

    reg_model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    reg_model.fit(X_train, y_train_reg)

    cls_model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    cls_model.fit(X_train, y_train_cls)

    y_pred_cls = cls_model.predict(X_test)
    acc = accuracy_score(y_test_cls, y_pred_cls)
    f1 = f1_score(y_test_cls, y_pred_cls, average="macro")

    print(f"Model Training Results:")
    print(f"Accuracy: {acc:.4f}, Macro F1: {f1:.4f}")

    importances = dict(zip(features, [round(float(v), 4) for v in reg_model.feature_importances_]))

    model_bundle = {
        "regressor": reg_model,
        "classifier": cls_model,
        "features": features,
        "feature_importances": importances,
        "version": "v1.0.0"
    }

    model_file = os.path.join(MODEL_DIR, "route_risk_model.joblib")
    joblib.dump(model_bundle, model_file)
    print(f"Saved trained model bundle to {model_file}")

    metadata = {
        "model_version": "v1.0.0",
        "trained_at": "2026-09-02T21:20:00Z",
        "algorithm": "RandomForest Ensemble (Regressor + Classifier)",
        "feature_contract_version": "1.0.0",
        "metrics": {
            "accuracy": round(float(acc), 4),
            "f1_macro": round(float(f1), 4)
        },
        "feature_importance": importances
    }

    with open(os.path.join(MODEL_DIR, "model_metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

if __name__ == "__main__":
    train_and_save_model()
