from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.services.assistant_service import Assistant88Service

router = APIRouter(prefix="/assistant", tags=["Assistant 88 — Operational Intelligence Layer"])


class AssistantChatContext(BaseModel):
    state: Optional[str] = Field(None, description="Currently selected state")
    district: Optional[str] = Field(None, description="Currently selected district name")
    district_name: Optional[str] = Field(None, description="Alias for district")
    corridor: Optional[str] = Field(None, description="Currently selected corridor code or name")
    delivery_code: Optional[str] = Field(None, description="Currently selected delivery code")
    coordinates: Optional[List[float]] = Field(None, description="Current map center [lat, lng]")
    active_tab: Optional[str] = Field(None, description="Current dashboard view or tab")


class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User prompt or operational query")
    context: Optional[AssistantChatContext] = Field(default_factory=AssistantChatContext, description="Command center active UI context")
    language: Optional[str] = Field("en", description="Target ISO language code (e.g. en, hi, as, bn, mni, kha, lus, ne, brx, grt)")


class AssistantAction(BaseModel):
    type: str = Field(..., description="Action type: FOCUS_DISTRICT, FOCUS_CORRIDOR, FILTER_MAP, NAVIGATE, VIEW_INCIDENT")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Action specific parameters")


class AssistantChatResponse(BaseModel):
    message: str
    sources: List[str] = Field(default_factory=list, description="Data provenance tags (e.g. DATABASE, OPEN_METEO_LIVE, ACCESSIBILITY_ENGINE)")
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Extracted numerical indicators")
    recommendations: List[str] = Field(default_factory=list, description="Actionable operational advice")
    actions: List[AssistantAction] = Field(default_factory=list, description="Interactive map or UI actions")
    context: Dict[str, Any] = Field(default_factory=dict, description="Echo of contextual variables")


@router.post("/chat", response_model=AssistantChatResponse)
def chat_with_assistant_88(
    payload: AssistantChatRequest,
    db: Session = Depends(get_db)
):
    """
    Assistant 88 Primary Operational Intelligence Endpoint.
    
    Processes questions on North Eastern logistics accessibility, road conditions,
    weather hazards, bridges, routes, active alerts, and contextually selected entities.
    """
    try:
        ctx_dict = (payload.context.model_dump() if hasattr(payload.context, "model_dump") else payload.context.dict()) if payload.context else {}
        response = Assistant88Service.process_query(
            message=payload.message,
            context=ctx_dict,
            db=db,
            language=payload.language or "en"
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Assistant 88 intelligence processing failed: {str(e)}"
        )


@router.get("/health")
def assistant_health_check(db: Session = Depends(get_db)):
    """
    Health check for Assistant 88 connectivity & data availability.
    """
    try:
        from app.models.models import District, Corridor, Incident, Alert
        district_count = db.query(District).count()
        corridor_count = db.query(Corridor).count()
        incident_count = db.query(Incident).count()
        alert_count = db.query(Alert).count()

        return {
            "status": "ONLINE",
            "assistant": "Assistant 88",
            "identity": "NER88 Operational Intelligence Assistant",
            "capabilities": [
                "NER Logistics Risk Assessment",
                "Accessibility Score Mathematical Breakdown",
                "Open-Meteo Live Atmospheric Hazard Tracking",
                "Bailey Bridge & River Crossing Weight Clearance",
                "Highway Corridor Routing & Blockage Detection",
                "Context-Aware Map Synchronized Intelligence",
                "Real-Time IST System Clock",
                "NER Regional Geography & Factual Knowledge"
            ],
            "data_indices": {
                "districts_monitored": district_count,
                "corridors_monitored": corridor_count,
                "active_incidents": incident_count,
                "alerts_active": alert_count
            }
        }
    except Exception as e:
        return {
            "status": "DEGRADED",
            "assistant": "Assistant 88",
            "error": str(e)
        }


@router.get("/quick-actions")
def get_quick_actions():
    """
    Returns predefined operational prompt chips for Command Center users (Section 4 & 22).
    """
    return [
        {
            "id": "network_status",
            "label": "Network Status",
            "prompt": "What is the current network status?",
            "category": "accessibility"
        },
        {
            "id": "restricted_corridors",
            "label": "Restricted Corridors",
            "prompt": "Which corridors are restricted?",
            "category": "route"
        },
        {
            "id": "active_incidents",
            "label": "Active Incidents",
            "prompt": "Show active incidents",
            "category": "alerts"
        },
        {
            "id": "weather_risk",
            "label": "Weather Risk",
            "prompt": "What is the weather risk?",
            "category": "weather"
        },
        {
            "id": "affected_vehicles",
            "label": "Affected Vehicles",
            "prompt": "How many vehicles are affected?",
            "category": "risk"
        },
        {
            "id": "general_factual",
            "label": "Nagaland Capital",
            "prompt": "What is the capital of Nagaland?",
            "category": "context"
        }
    ]
