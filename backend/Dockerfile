# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Whisper and yt-dlp both need ffmpeg available on the PATH.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the CPU build of torch first so Whisper doesn't pull the huge CUDA
# wheels. Then install the rest of the requirements.
COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install --index-url https://download.pytorch.org/whl/cpu torch \
    && pip install -r requirements.txt

# Copy the application code.
COPY app ./app

# Create writable cache/temp dirs and drop privileges.
RUN mkdir -p /app/.cache /app/.tmp \
    && useradd --create-home --uid 1001 appuser \
    && chown -R appuser:appuser /app
USER appuser

ENV CACHE_DIR=/app/.cache \
    TEMP_DIR=/app/.tmp \
    HOST=0.0.0.0 \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health').status==200 else 1)" || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
