from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import Corridor, AuditLog
from app.schemas.schemas import CorridorOut, APIResponse

router = APIRouter(prefix="/corridors", tags=["Transport Corridor Monitoring"])

@router.get("", response_model=List[CorridorOut])
def get_all_corridors(db: Session = Depends(get_db)):
    return db.query(Corridor).order_by(Corridor.corridor_code.asc()).all()

@router.get("/{corridor_id}", response_model=CorridorOut)
def get_corridor(corridor_id: int, db: Session = Depends(get_db)):
    c = db.query(Corridor).filter(Corridor.id == corridor_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Corridor not found")
    return c

@router.put("/{corridor_id}/status", response_model=CorridorOut)
def update_corridor_status(corridor_id: int, status: str, risk_level: str = "MEDIUM", db: Session = Depends(get_db)):
    c = db.query(Corridor).filter(Corridor.id == corridor_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Corridor not found")
    
    c.status = status.upper()
    c.risk_level = risk_level.upper()
    db.add(AuditLog(
        user_email="dispatcher@linkx8.in",
        action="UPDATE_CORRIDOR_STATUS",
        resource="Corridor",
        details=f"Updated corridor {c.corridor_code} status to {c.status} ({c.risk_level})"
    ))
    db.commit()
    db.refresh(c)
    return c
