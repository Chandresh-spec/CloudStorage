from sqlalchemy.ext.asyncio import AsyncSession
from .database import get_db_async
from .models import User
from .auth import decode_token, get_db_user
from jose import JWTError
from fastapi import Depends, Cookie, HTTPException, status
import uuid

async def get_current_user(
    token: str | None = Cookie(None, alias="access_token"),
    db: AsyncSession = Depends(get_db_async)
) -> User:
    credential_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credential_exception

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credential_exception
        user_id_raw = payload.get("sub")
        if not user_id_raw:
            raise credential_exception
        user_id = uuid.UUID(str(user_id_raw))
    except (JWTError, ValueError, TypeError):
        raise credential_exception

    user = await get_db_user(db, user_id)
    if user is None:
        raise credential_exception

    return user
