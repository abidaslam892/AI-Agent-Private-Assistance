from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.db.models import User, AuditEvent
from app.schemas.auth import Token, UserResponse, UserCreate
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    query = select(User).where(
        or_(User.username == form_data.username, User.email == form_data.username)
    )
    result = await db.execute(query)
    user = result.scalars().first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")

    access_token = create_access_token(subject=user.id)
    
    # Audit log
    audit = AuditEvent(
        user_id=user.id,
        action="USER_LOGIN",
        resource_type="auth",
        resource_id=str(user.id),
        details={"username": user.username}
    )
    db.add(audit)
    await db.commit()

    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        username=user.username,
        role=user.role
    )

@router.get("/me", response_model=UserResponse)
async def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/register", response_model=UserResponse)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    # Check if username or email already exists
    existing = await db.execute(
        select(User).where(or_(User.username == user_in.username, User.email == user_in.email))
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=400,
            detail="User with this username or email already exists."
        )
    
    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role if user_in.role in ["user", "admin"] else "user",
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
