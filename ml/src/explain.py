import os
import joblib

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

def explain_risk(prediction_result):
    """Generates explainable human-readable breakdown and actionable operational recommendation for route risk decision."""
    features = prediction_result.get("validated_features", {})
    risk_score = prediction_result.get("risk_score", 0.0)
    category = prediction_result.get("risk_category", "LOW")

    model_path = os.path.join(MODEL_DIR, "route_risk_model.joblib")
    importances = {}
    if os.path.exists(model_path):
        bundle = joblib.load(model_path)
        importances = bundle.get("feature_importances", {})

    reasons = []

    # Feature 1: Road Blockage
    if features.get("road_blocked_status", 0) == 1:
        reasons.append({
            "factor": "Road Segment Blocked",
            "impact": "CRITICAL",
            "description": "Active road blockage reported on corridor pass. Passage impassable."
        })

    # Feature 2: High Severity Incidents
    sev = features.get("highest_severity_numeric", 0)
    if sev >= 3:
        sev_label = "HIGH" if sev == 3 else "CRITICAL"
        reasons.append({
            "factor": f"High Severity Incident ({sev_label})",
            "impact": "HIGH",
            "description": f"Field reported severity level {sev} incident active along corridor."
        })

    # Feature 3: Heavy Rainfall
    rain = features.get("rainfall_mm_hr", 0.0)
    if rain > 50:
        reasons.append({
            "factor": f"Heavy Precipitation ({rain} mm/hr)",
            "impact": "HIGH" if rain > 80 else "MEDIUM",
            "description": f"Monsoon rainfall exceeds safe threshold ({rain} mm/hr), escalating flash flood & mudslide probability."
        })
    elif rain > 20:
        reasons.append({
            "factor": f"Moderate Rain ({rain} mm/hr)",
            "impact": "LOW",
            "description": "Monsoon rain reducing visibility and vehicle speeds."
        })

    # Feature 4: Landslide frequency & elevation
    landslide = features.get("historical_landslide_freq", 0.0)
    elevation = features.get("terrain_elevation_gain_m", 0.0)
    if landslide > 0.4 and elevation > 1000:
        reasons.append({
            "factor": "High Monsoon Landslide Vulnerability",
            "impact": "HIGH",
            "description": f"Elevation gain of {int(elevation)}m in high landslide frequency sector ({int(landslide*100)}% historical probability)."
        })

    # Feature 5: Active Incidents Count
    inc_count = features.get("active_incidents_count", 0)
    if inc_count >= 2:
        reasons.append({
            "factor": f"Multiple Active Incidents ({inc_count})",
            "impact": "MEDIUM",
            "description": f"{inc_count} concurrent traffic/road obstruction reports logged on route."
        })

    if not reasons:
        reasons.append({
            "factor": "Normal Operating Conditions",
            "impact": "LOW",
            "description": "Corridor parameters within standard safety thresholds."
        })

    # Formulate Actionable Operational Recommendation
    if category in ["HIGH", "CRITICAL"] or features.get("road_blocked_status", 0) == 1:
        recommended_action = "MANDATORY REROUTE: Do not dispatch heavy logistics through affected corridor pass. Immediately reroute via safer alternative corridor B (via Silchar / Jiribam - NH37)."
    elif category == "MEDIUM":
        recommended_action = "PROCEED WITH CAUTION: Issue speed restriction advisory (max 30 km/h). Monitor field reporting updates closely."
    else:
        recommended_action = "PROCEED AS SCHEDULED: Corridor operating normally. Maintain standard delivery schedule."

    return {
        "risk_score": risk_score,
        "risk_category": category,
        "primary_reasons": reasons,
        "recommended_action": recommended_action,
        "feature_importance_weights": importances,
        "explanation_type": "SHAP_PROXIMAL_FEATURE_WEIGHTS"
    }
