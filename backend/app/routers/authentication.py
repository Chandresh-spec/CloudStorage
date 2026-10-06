import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie

from ..models import User, statusChoice
from ..database import get_db_async
from ..schemas import RegisterInput, LoginInputSchema, UserResponse, VerifyIn, ResendIn
from ..auth import (
    hash_password,
    verify_password,
    generate_access_token,
    generate_refresh_token,
    decode_token,
    get_db_user,
)
from ..deps import get_current_user
from ..config import settings
from jose import JWTError
from ..core.otpservice import OtpService, RateLimitException, VerifyResult, get_otp_service

logger = logging.getLogger("chatbot.auth")

auth_router = APIRouter(
    prefix='/api/auth',
    tags=['auth']
)


async def issue_and_send(email: str, svc: OtpService) -> str:
    try:
        otp = await svc.issue(email)
        logger.info(f"[DEV MODE] Generated OTP for {email}: {otp}")
    except RateLimitException as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many requests. Try again in {e.retry_after}s",
            headers={"Retry-After": str(e.retry_after)},
        )
    return otp


@auth_router.post('/verify-otp')
async def verify_otp(
    body: VerifyIn,
    db: AsyncSession = Depends(get_db_async),
    svc: OtpService = Depends(get_otp_service),
):
    email = body.email.lower().strip()
    result = await svc.verify(email, body.otp)

    if result == VerifyResult.LOCKED:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")
    if result == VerifyResult.EXPIRED:
        raise HTTPException(status_code=400, detail="Code expired or not requested")
    if result == VerifyResult.WRONG:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    user = await db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=404, detail="Account not found for this email")

    user.is_verified = True
    await db.commit()
    await db.refresh(user)

    return {
        "status": "success",
        "message": "Email verified successfully! You can now sign in.",
        "detail": "Email verified successfully! You can now sign in.",
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "status": user.status,
            "is_verified": user.is_verified,
        },
    }


@auth_router.post("/resend-otp", status_code=202)
async def resend_otp(
    body: ResendIn,
    db: AsyncSession = Depends(get_db_async),
    svc: OtpService = Depends(get_otp_service),
):
    email = body.email.lower().strip()
    user = await db.scalar(select(User).where(User.email == email))

    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email")

    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email is already verified. Please sign in.")

    otp = await issue_and_send(email, svc)
    return {
        "status": "success",
        "message": "A new verification code has been generated (Dev Mode).",
        "detail": "A new verification code has been generated (Dev Mode).",
        "email": email,
        "otp": otp,
        "dev_otp": otp,
        "expires_in": settings.otp_ttl_seconds,
        "cooldown": settings.otp_cooldown,
    }


@auth_router.post('/register', status_code=status.HTTP_201_CREATED)
async def register(
    user_input: RegisterInput,
    db: AsyncSession = Depends(get_db_async),
    svc: OtpService = Depends(get_otp_service),
):
    email = user_input.email.lower().strip()
    name = user_input.name.strip()

    # Check if username or email already exists
    stmt = select(User).where((User.email == email) | (User.name == name))
    existing = await db.execute(stmt)
    existing_users = existing.scalars().all()

    for existing_user in existing_users:
        if existing_user.email == email:
            # If the same email exists but is still unverified, update password & issue a new OTP
            if not existing_user.is_verified:
                existing_user.password = hash_password(user_input.password)
                if existing_user.name == name or not any(u.name == name and u.id != existing_user.id for u in existing_users):
                    existing_user.name = name
                await db.commit()
                await db.refresh(existing_user)
                otp = await issue_and_send(email, svc)
                return {
                    "status": "success",
                    "message": "Account pending verification. New development OTP generated.",
                    "detail": "Account pending verification. New development OTP generated.",
                    "requires_verification": True,
                    "email": existing_user.email,
                    "otp": otp,
                    "dev_otp": otp,
                    "expires_in": settings.otp_ttl_seconds,
                    "cooldown": settings.otp_cooldown,
                    "user": {
                        "id": str(existing_user.id),
                        "name": existing_user.name,
                        "email": existing_user.email,
                        "status": existing_user.status,
                        "is_verified": existing_user.is_verified,
                    },
                }
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"field": "email", "message": "Email Already Exists"}
            )
        if existing_user.name == name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"field": "username", "message": "Username Must be Unique"}
            )

    user = User(
        email=email,
        name=name,
        password=hash_password(user_input.password),
        status=statusChoice.INACTIVE,
    )

    db.add(user)

    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError as exc:
        await db.rollback()
        error_msg = str(exc).lower()
        if 'uq_users_username' in error_msg or 'username' in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"field": "username", "message": "Username Must be Unique"}
            )
        elif 'uq_user_email' in error_msg or 'email' in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"field": "email", "message": "Email Already Exists"}
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"field": "general", "message": "User with this name or email already exists"}
        )

    otp = await issue_and_send(email, svc)

    return {
        "status": "success",
        "message": "User Created Successfully. Please verify your email with the OTP.",
        "detail": "User Created Successfully. Please verify your email with the OTP.",
        "requires_verification": True,
        "email": user.email,
        "otp": otp,
        "dev_otp": otp,
        "expires_in": settings.otp_ttl_seconds,
        "cooldown": settings.otp_cooldown,
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "status": user.status,
            "is_verified": user.is_verified,
        },
    }


@auth_router.post('/login')
async def login(user_input: LoginInputSchema, response: Response, db: AsyncSession = Depends(get_db_async)):
    credential_exception = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid Credentials"
    )

    db_user = None
    if user_input.email:
        stmt = select(User).where(User.email == user_input.email.lower().strip())
        res = await db.execute(stmt)
        db_user = res.scalar_one_or_none()
    elif user_input.name:
        stmt = select(User).where(User.name == user_input.name.strip())
        res = await db.execute(stmt)
        db_user = res.scalar_one_or_none()

    if not db_user:
        raise credential_exception

    if not verify_password(user_input.password, db_user.password):
        raise credential_exception

    if not db_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "EMAIL_NOT_VERIFIED",
                "email": db_user.email,
                "message": "Email not verified. Please verify your email using the OTP code.",
            },
        )

    access_token = generate_access_token(data={'sub': str(db_user.id)})
    refresh_token = generate_refresh_token(data={'sub': str(db_user.id)})

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=settings.httponly,
        secure=settings.secure,
        samesite=settings.samesite,
        max_age=settings.access_max_age,
        path=settings.access_path
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=settings.httponly,
        secure=settings.secure,
        samesite=settings.samesite,
        max_age=settings.refresh_max_age,
        path=settings.refresh_path
    )

    return {
        "status": "success",
        "message": "Login Successful",
        "detail": "Login Successful",
        "user": {
            "id": str(db_user.id),
            "name": db_user.name,
            "email": db_user.email,
            "status": db_user.status,
            "is_verified": db_user.is_verified,
        }
    }

@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path=settings.access_path)
    response.delete_cookie(key="refresh_token", path=settings.refresh_path)
    return {"status": "success", "message": "Logged out successfully"}

@auth_router.post("/refresh")
async def refresh_token(
    response: Response,
    token: str | None = Cookie(None, alias="refresh_token"),
    db: AsyncSession = Depends(get_db_async)
):
    credential_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token"
    )

    if not token:
        raise credential_exception

    try:
        payload = decode_token(token)
        if payload.get('type') != "refresh":
            raise credential_exception

        sub = payload.get('sub')
        if not sub:
            raise credential_exception
        user_id = uuid.UUID(str(sub))
    except (JWTError, ValueError, TypeError):
        raise credential_exception

    user = await get_db_user(db, user_id)
    if user is None:
        raise credential_exception

    new_access_token = generate_access_token(data={"sub": str(user.id)})

    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=settings.httponly,
        secure=settings.secure,
        samesite=settings.samesite,
        max_age=settings.access_max_age,
        path=settings.access_path
    )

    return {
        "status": "success",
        "message": "Token Refreshed Successfully",
        "detail": "Token Refreshed Successfully"
    }

@auth_router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "status": current_user.status
    }








