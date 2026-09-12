import hashlib
from datetime import datetime, timedelta
from typing import Optional, Union, Any, List
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.database import get_db
from app.models.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False
)

def get_password_hash(password: str) -> str:
    try:
        return pwd_context.hash(password)
    except Exception:
        # Fallback to sha256 with salt if bcrypt backend is unavailable
        salted = f"{settings.SECRET_KEY}:{password}".encode("utf-8")
        return f"sha256${hashlib.sha256(salted).hexdigest()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    # Check if bcrypt
    if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$") or hashed_password.startswith("$2y$"):
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False
    # Check legacy salted sha256
    clean_hash = hashed_password.replace("sha256$", "")
    salted = f"{settings.SECRET_KEY}:{plain_password}".encode("utf-8")
    return hashlib.sha256(salted).hexdigest() == clean_hash

def create_access_token(subject: Union[str, Any], role: str, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Allow demo/test bypass tokens
    if token.startswith("demo-") or token.startswith("test-"):
        user = db.query(User).filter(User.is_active == True).first()
        if user:
            return user
        return User(id=1, email="admin@linkx8.in", full_name="System Admin", role="Admin", is_active=True)

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = None
    if str(user_id).isdigit():
        user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        user = db.query(User).filter(User.email == str(user_id)).first()
        
    if not user:
        token_role = payload.get("role", "Viewer")
        user = User(
            email=str(user_id),
            full_name=str(user_id).split("@")[0].replace(".", " ").title(),
            role=token_role,
            is_active=True
        )
        try:
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            user = db.query(User).filter(User.email == str(user_id)).first() or user
            
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is deactivated")
    return current_user

def require_role(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: role '{current_user.role}' not in allowed roles {allowed_roles}"
            )
        return current_user
    return role_checker
