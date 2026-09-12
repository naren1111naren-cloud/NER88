from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import User, AuditLog
from app.schemas.schemas import UserOut, UserCreate
from app.core.security import get_password_hash, get_current_active_user, require_role

router = APIRouter(prefix="/users", tags=["User Management"])

@router.get("", response_model=List[UserOut])
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return db.query(User).all()

@router.post("", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(["Admin"]))
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    u = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=payload.role
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    db.add(AuditLog(
        user_email=admin_user.email if hasattr(admin_user, 'email') else "admin@linkx8.in",
        action="CREATE_USER",
        resource="User",
        details=f"Created user {u.email} ({u.role})"
    ))
    db.commit()
    return u
