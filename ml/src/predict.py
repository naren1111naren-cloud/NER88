import os
import json
import joblib
import pandas as pd
import numpy as np

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

def load_feature_contract():
    contract_path = os.path.join(DATA_DIR, "feature_contract.json")
    with open(contract_path, "r") as f:
        return json.load(f)

def validate_features(feature_dict):
    contract = load_feature_contract()
    specs = contract["feature_specifications"]
    validated = {}

    for feature_name in contract["feature_order"]:
        spec = specs.get(feature_name, {})
        val = feature_dict.get(feature_name)

        if val is None:
            val = spec.get("default", 0.0)

        try:
            if spec.get("type") == "integer":
                val = int(val)
            else:
                val = float(val)
        except Exception:
            val = spec.get("default", 0.0)

        min_val = spec.get("min")
        max_val = spec.get("max")
        if min_val is not None:
            val = max(min_val, val)
        if max_val is not None:
            val = min(max_val, val)

        validated[feature_name] = val

    return validated

def calc_category(score):
    if score >= 75:
        return "CRITICAL"
    elif score >= 50:
        return "HIGH"
    elif score >= 25:
        return "MEDIUM"
    else:
        return "LOW"

def predict_route_risk(feature_dict):
    """Predicts continuous risk score (0-100), categories, 24h forecast horizons, and disruption probabilities."""
    validated = validate_features(feature_dict)
    model_path = os.path.join(MODEL_DIR, "route_risk_model.joblib")

    if not os.path.exists(model_path):
        from ml.src.train import train_and_save_model
        train_and_save_model()

    bundle = joblib.load(model_path)
    reg_model = bundle["regressor"]
    cls_model = bundle["classifier"]
    features_order = bundle["features"]

    df = pd.DataFrame([validated])[features_order]

    risk_score = float(reg_model.predict(df)[0])
    risk_score = round(max(0.0, min(100.0, risk_score)), 1)
    category = calc_category(risk_score)

    # Disruption probability estimates based on model features
    rain = validated.get("rainfall_mm_hr", 0.0)
    landslide_freq = validated.get("historical_landslide_freq", 0.0)
    blocked = validated.get("road_blocked_status", 0)
    traffic = validated.get("traffic_congestion_index", 0.0)
    sev = validated.get("highest_severity_numeric", 0)

    p_landslide = min(1.0, round((landslide_freq * 0.5) + (rain / 120.0) + (0.4 if blocked else 0.0), 2))
    p_flood = min(1.0, round((rain / 100.0) * 0.8, 2))
    p_road_damage = min(1.0, round((sev / 4.0) * 0.7 + (0.3 if blocked else 0.0), 2))
    p_congestion = min(1.0, round(traffic, 2))

    if blocked == 1:
        primary_disruption = "Corridor Closure Risk / Active Blockage"
    elif p_landslide > 0.6:
        primary_disruption = "Monsoon Landslide Risk"
    elif p_flood > 0.6:
        primary_disruption = "Flash Flood & Inundation Risk"
    elif p_road_damage > 0.5:
        primary_disruption = "Mountain Road Damage Risk"
    elif p_congestion > 0.6:
        primary_disruption = "Severe Traffic Congestion"
    else:
        primary_disruption = "No Severe Disruption Expected"

    # Horizon forecasts (+6h, +12h, +24h) assuming monsoon rain trend projection
    h_6h_score = round(max(0.0, min(100.0, risk_score + (rain * 0.15))), 1)
    h_12h_score = round(max(0.0, min(100.0, risk_score + (rain * 0.25))), 1)
    h_24h_score = round(max(0.0, min(100.0, max(15.0, risk_score - 10.0))), 1) # Expected post-monsoon clearing

    return {
        "risk_score": risk_score,
        "risk_category": category,
        "primary_predicted_disruption": primary_disruption,
        "disruption_probabilities": {
            "landslide_prob": int(p_landslide * 100),
            "flood_prob": int(p_flood * 100),
            "road_damage_prob": int(p_road_damage * 100),
            "congestion_prob": int(p_congestion * 100)
        },
        "prediction_horizons": {
            "current": {"risk_score": risk_score, "category": category},
            "next_6h": {"risk_score": h_6h_score, "category": calc_category(h_6h_score)},
            "next_12h": {"risk_score": h_12h_score, "category": calc_category(h_12h_score)},
            "next_24h": {"risk_score": h_24h_score, "category": calc_category(h_24h_score)}
        },
        "data_provenance": {
            "type": "AI_MODEL_PREDICTION",
            "observed": "Weather sensors & Field officer telemetry",
            "predicted": "Scikit-Learn Random Forest Regressor/Classifier",
            "simulated": "Monsoon rain escalation parameters"
        },
        "validated_features": validated,
        "model_version": bundle.get("version", "v1.0.0")
    }

if __name__ == "__main__":
    sample = {
        "distance_km": 280,
        "terrain_elevation_gain_m": 1850,
        "rainfall_mm_hr": 75,
        "active_incidents_count": 2,
        "highest_severity_numeric": 3,
        "road_blocked_status": 1,
        "historical_landslide_freq": 0.65,
        "traffic_congestion_index": 0.4
    }
    res = predict_route_risk(sample)
    print("Prediction Result:", json.dumps(res, indent=2))
