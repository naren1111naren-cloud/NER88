from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import Vehicle, AuditLog
from app.schemas.schemas import VehicleOut, VehicleCreate

router = APIRouter(prefix="/vehicles", tags=["Vehicles Fleet"])

@router.get("", response_model=List[VehicleOut])
def get_vehicles(db: Session = Depends(get_db)):
    return db.query(Vehicle).all()

@router.post("", response_model=VehicleOut)
def create_vehicle(payload: VehicleCreate, db: Session = Depends(get_db)):
    existing = db.query(Vehicle).filter(Vehicle.vehicle_code == payload.vehicle_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vehicle code already exists")
    
    v = Vehicle(**payload.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)

    db.add(AuditLog(user_email="system@linkx8.in", action="CREATE_VEHICLE", resource="Vehicle", details=f"Added vehicle {v.vehicle_code}"))
    db.commit()
    return v

@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return v
