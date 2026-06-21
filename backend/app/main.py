"""TubeTranscript FastAPI application entrypoint.

Run locally with:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.exceptions import TubeTranscriptError
from app.logging_config import configure_logging, get_logger
from app.rate_limit import limiter
from app.routers import health, summary, transcript
from app.services.jobs import job_manager

configure_logging("DEBUG" if settings.debug else "INFO")
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    logger.info(
        "Starting %s v%s (%s)", settings.app_name, settings.app_version, settings.environment
    )
    logger.info(
        "Whisper: %s | Summaries: %s | Cache: %s",
        "on" if settings.whisper_enabled else "off",
        "openai" if settings.summary_available else "extractive",
        "on" if settings.cache_enabled else "off",
    )
    try:
        yield
    finally:
        logger.info("Shutting down — stopping background jobs.")
        job_manager.shutdown()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Fetch YouTube transcripts via captions, with an AI (Whisper) fallback.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    # When set (e.g. "/_/backend" on Vercel), Starlette strips this prefix from
    # incoming paths before matching routes, so the same app works locally and
    # behind a path-based proxy.
    root_path=settings.root_path,
)

# ---- Rate limiting (decorator-based; see app/rate_limit.py) ----
app.state.limiter = limiter

# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Exception handlers — every error becomes a clean ``{detail, code}`` payload.
# --------------------------------------------------------------------------- #
@app.exception_handler(TubeTranscriptError)
async def handle_app_error(request: Request, exc: TubeTranscriptError) -> JSONResponse:
    if exc.status_code >= 500:
        logger.warning("App error (%s) on %s: %s", exc.code, request.url.path, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "code": exc.code},
    )


@app.exception_handler(RateLimitExceeded)
async def handle_rate_limit(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": "You're sending requests too quickly. Please wait a moment and try again.",
            "code": "rate_limited",
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred.", "code": "internal_error"},
    )


# ---- Routers (all under /api) ----
app.include_router(health.router, prefix="/api")
app.include_router(transcript.router, prefix="/api")
app.include_router(summary.router, prefix="/api")


@app.get("/", include_in_schema=False)
async def root() -> dict:
    """Friendly root with pointers to the docs and health check."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/health",
    }
