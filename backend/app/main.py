import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, sync_engine
from .models import User
from .routers import authentication

logger = logging.getLogger("chatbot")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables exist if connection is available
    try:
        Base.metadata.create_all(bind=sync_engine)
        logger.info("Database tables verified/created successfully.")
    except Exception as exc:
        logger.warning(f"Could not connect to database on startup: {exc}")
    yield

app = FastAPI(
    title="Chatbot Authentication & RAG API",
    version="1.0.0",
    lifespan=lifespan
)

# Explicit origins allowed to make credentialed requests
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

# Support additional custom origins via environment variable if needed
env_origins = os.getenv("CORS_ORIGINS", "")
if env_origins:
    for item in env_origins.split(","):
        item = item.strip()
        if item and item not in origins:
            origins.append(item)

# CORS configuration:
# Note: When allow_credentials=True, allow_origins cannot be ["*"].
# allow_origin_regex covers any port on localhost or 127.0.0.1.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok", "message": "Chatbot API is operational"}

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "chatbot_backend"}

app.include_router(authentication.auth_router)