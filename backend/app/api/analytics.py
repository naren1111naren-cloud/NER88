from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import Incident, Delivery, Vehicle, FieldReport

router = APIRouter(prefix="/analytics", tags=["Analytics & BI Intelligence"])

@router.get("")
def get_analytics_metrics(db: Session = Depends(get_db)):
    # Incidents by Type
    incidents = db.query(Incident).all()
    type_counts = {}
    severity_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for inc in incidents:
        type_counts[inc.incident_type] = type_counts.get(inc.incident_type, 0) + 1
        if inc.severity in severity_counts:
            severity_counts[inc.severity] += 1

    incidents_by_type = [{"type": k, "count": v} for k, v in type_counts.items()]
    incidents_by_severity = [{"severity": k, "count": v} for k, v in severity_counts.items()]

    # Deliveries by Status
    deliveries = db.query(Delivery).all()
    status_counts = {"IN_TRANSIT": 0, "PENDING": 0, "DELAYED": 0, "COMPLETED": 0}
    for d in deliveries:
        st = d.status if d.status in status_counts else "IN_TRANSIT"
        status_counts[st] += 1
    
    deliveries_by_status = [{"status": k, "count": v} for k, v in status_counts.items()]

    # Regional Corridor Reliability Metrics
    regional_accessibility = [
        {"region": "Assam Valleys (Guwahati-Nagaon)", "accessibility_score": 98.5, "status": "OPTIMAL"},
        {"region": "Meghalaya Plateau (Shillong-Jowai)", "accessibility_score": 88.0, "status": "MODERATE_RAIN"},
        {"region": "Barak Valley Corridor (Silchar-Jiribam)", "accessibility_score": 84.5, "status": "PASSABLE"},
        {"region": "Nagaland Pass (Dimapur-Kohima)", "accessibility_score": 72.0, "status": "CAUTION"},
        {"region": "Manipur Highway Corridor (Senapati-Imphal)", "accessibility_score": 28.0, "status": "CRITICAL_LANDSLIDE"}
    ]

    return {
        "incidents_by_type": incidents_by_type,
        "incidents_by_severity": incidents_by_severity,
        "deliveries_by_status": deliveries_by_status,
        "regional_accessibility": regional_accessibility,
        "historical_risk_trend": [
            {"day": "Mon", "risk_avg": 18.2, "incidents": 1},
            {"day": "Tue", "risk_avg": 22.4, "incidents": 2},
            {"day": "Wed", "risk_avg": 34.0, "incidents": 3},
            {"day": "Thu", "risk_avg": 41.5, "incidents": 4},
            {"day": "Fri", "risk_avg": 68.0, "incidents": 7},
            {"day": "Sat", "risk_avg": 82.0, "incidents": 9},
            {"day": "Sun", "risk_avg": 45.0, "incidents": 4}
        ]
    }
