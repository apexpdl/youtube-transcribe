"""Application configuration loaded from environment variables.

All settings can be overridden via environment variables or a ``.env`` file.
See ``backend/.env.example`` for the full list of supported variables.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- General ----
    app_name: str = "TubeTranscript API"
    app_version: str = "1.0.0"
    environment: str = "development"
    debug: bool = True

    # Path prefix the API is mounted under behind a proxy (e.g. "/_/backend" on
    # Vercel multi-service). Leave empty for local/Docker. Routing tolerates the
    # prefix being present or already stripped by the proxy.
    root_path: str = ""

    # ---- CORS (comma separated list of allowed origins) ----
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ---- Caching ----
    cache_enabled: bool = True
    cache_dir: str = ".cache"
    cache_ttl_seconds: int = 60 * 60 * 24 * 7  # 7 days

    # ---- Temp files / downloads ----
    temp_dir: str = ".tmp"
    cleanup_files: bool = True

    # ---- Whisper (local speech-to-text fallback) ----
    whisper_enabled: bool = True
    whisper_model: str = "base"  # tiny | base | small | medium | large
    whisper_device: str = "auto"  # auto | cpu | cuda
    whisper_compute_language: str | None = None  # force a language, else autodetect
    # Refuse to run Whisper on videos longer than this (protects the server).
    max_whisper_duration_seconds: int = 60 * 60  # 1 hour

    # ---- yt-dlp ----
    ytdlp_format: str = "bestaudio/best"
    ytdlp_proxy: str | None = None
    ytdlp_cookiefile: str | None = None
    # Hard cap on audio download size (defensive). 0 disables the check.
    max_download_mb: int = 0

    # ---- Rate limiting ----
    rate_limit_enabled: bool = True
    rate_limit: str = "30/minute"
    rate_limit_transcript: str = "10/minute"

    # ---- Jobs ----
    job_ttl_seconds: int = 60 * 60  # keep finished jobs around for 1 hour
    max_concurrent_jobs: int = 2

    # ---- OpenAI (optional: summary / takeaways / translation) ----
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    summary_enabled: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse the comma separated ``cors_origins`` value into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def summary_available(self) -> bool:
        """Whether AI summaries can be generated (requires an OpenAI key)."""
        return bool(self.summary_enabled and self.openai_api_key)


@lru_cache
def get_settings() -> Settings:
    """Return a cached :class:`Settings` instance."""
    return Settings()


# Convenient module-level singleton.
settings = get_settings()
