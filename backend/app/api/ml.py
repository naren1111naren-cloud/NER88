import os
import json
from fastapi import APIRouter
from app.schemas.schemas import RouteAnalysisRequest
from ml.src.predict import predict_route_risk
from ml.src.explain import explain_risk

router = APIRouter(prefix="/ml", tags=["AI Machine Learning Pipeline"])

ML_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml", "data")
ML_MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml", "models")

@router.get("/metadata")
def get_ml_metadata():
    path = os.path.join(ML_MODEL_DIR, "model_metadata.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return {"status": "Model metadata file pending"}

@router.get("/feature-contract")
def get_feature_contract():
    path = os.path.join(ML_DATA_DIR, "feature_contract.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return {"status": "Feature contract pending"}

@router.post("/predict")
def predict(payload: RouteAnalysisRequest):
    pred = predict_route_risk(payload.model_dump())
    exp = explain_risk(pred)
    return {
        "prediction": pred,
        "explanation": exp
    }
