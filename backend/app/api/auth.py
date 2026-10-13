from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.models import User, AuditLog
from app.schemas.schemas import LoginRequest, Token, UserCreate, UserOut
from app.core.security import verify_password, get_password_hash, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    clean_identifier = (payload.email or "").strip().lower()
    
    # Try exact match first
    user = db.query(User).filter(User.email.ilike(clean_identifier)).first()
    
    # If not found and input has no '@', try appending default domains
    if not user and "@" not in clean_identifier:
        user = db.query(User).filter(User.email.ilike(f"{clean_identifier}@linkx8.in")).first()
        if not user:
            user = db.query(User).filter(User.email.ilike(f"{clean_identifier}@nerlogiai.in")).first()
            
    # If not found and input has '@linkx8.in', try '@nerlogiai.in' as fallback (and vice versa)
    if not user and clean_identifier.endswith("@linkx8.in"):
        prefix = clean_identifier.replace("@linkx8.in", "")
        user = db.query(User).filter(User.email.ilike(f"{prefix}@nerlogiai.in")).first()
    elif not user and clean_identifier.endswith("@nerlogiai.in"):
        prefix = clean_identifier.replace("@nerlogiai.in", "")
        user = db.query(User).filter(User.email.ilike(f"{prefix}@linkx8.in")).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is deactivated")

    access_token = create_access_token(subject=user.id, role=user.role)
    
    # Audit log
    audit = AuditLog(
        user_email=user.email,
        action="LOGIN",
        resource="UserSession",
        details=f"User {user.email} logged in with role {user.role}"
    )
    db.add(audit)
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role
        }
    }

@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=payload.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    audit = AuditLog(
        user_email=user.email,
        action="REGISTER",
        resource="User",
        details=f"Created new user account {user.email} with role {user.role}"
    )
    db.add(audit)
    db.commit()

    return user

@router.get("/me")
def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Returns the authenticated operator profile, resolving metadata from Supabase if active.
    """
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at
    }

@router.get("/supabase-status")
def get_supabase_health_status():
    """
    Returns the operational connectivity status of the Supabase cloud backend.
    """
    from app.core.supabase import supabase_client
    return supabase_client.get_health()
