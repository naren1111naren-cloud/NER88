from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import SystemSettings, AuditLog

router = APIRouter(prefix="/settings", tags=["System Settings"])

@router.get("")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(SystemSettings).all()
    if not settings:
        default_settings = [
            {"setting_key": "RISK_THRESHOLD_LOW", "setting_value": "24", "description": "Upper bound for LOW risk category (0-24)"},
            {"setting_key": "RISK_THRESHOLD_MEDIUM", "setting_value": "49", "description": "Upper bound for MEDIUM risk category (25-49)"},
            {"setting_key": "RISK_THRESHOLD_HIGH", "setting_value": "74", "description": "Upper bound for HIGH risk category (50-74)"},
            {"setting_key": "RISK_THRESHOLD_CRITICAL", "setting_value": "100", "description": "Upper bound for CRITICAL risk category (75-100)"},
            {"setting_key": "AUTO_REROUTE_ENABLED", "setting_value": "true", "description": "Enable automated alternate route recommendation"},
            {"setting_key": "DEMO_MODE_ACTIVE", "setting_value": "true", "description": "Flag indicating active hackathon simulation mode"}
        ]
        for ds in default_settings:
            db.add(SystemSettings(**ds))
        db.commit()
        settings = db.query(SystemSettings).all()
    return settings
