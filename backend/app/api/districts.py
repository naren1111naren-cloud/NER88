from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import District, Incident
from app.schemas.schemas import DistrictOut

router = APIRouter(prefix="/districts", tags=["District-Wise Accessibility Intelligence"])

@router.get("", response_model=List[DistrictOut])
def get_all_districts(db: Session = Depends(get_db)):
    districts = db.query(District).order_by(District.name.asc()).all()
    # Dynamic recalculation of active incident count per district
    for d in districts:
        inc_cnt = db.query(Incident).filter(
            Incident.location_name.contains(d.name) | (Incident.district_name == d.name)
        ).count()
        d.active_incidents_count = inc_cnt
        if inc_cnt > 0:
            d.accessibility_index = max(15.0, round(90.0 - (inc_cnt * 35.0), 1))
            d.status = "Severely Inaccessible" if d.accessibility_index < 25 else "Poor"
        else:
            d.accessibility_index = 85.0 if d.name != "Kamrup Metropolitan" else 96.5
            d.status = "Good" if d.accessibility_index < 90 else "Highly Accessible"
    db.commit()
    return districts

@router.get("/{district_name}", response_model=DistrictOut)
def get_district_details(district_name: str, db: Session = Depends(get_db)):
    d = db.query(District).filter(District.name.ilike(f"%{district_name}%")).first()
    if not d:
        raise HTTPException(status_code=404, detail="District not found")
    return d
