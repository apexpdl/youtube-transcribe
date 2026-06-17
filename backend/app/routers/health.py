"""Health & readiness endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.models import HealthResponse
from app.services import whisper_service

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Report service health and which optional features are available."""
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        whisper_enabled=whisper_service.is_available(),
        summary_available=settings.summary_available,
    )
