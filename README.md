# 🎬 TubeTranscript

> Paste a YouTube URL → get a clean, searchable transcript in seconds.

TubeTranscript fetches a video's existing captions when available and
**automatically falls back to local AI speech-to-text (OpenAI Whisper)** when
they aren't. It ships with a modern, responsive Next.js UI and a typed FastAPI
backend.

<p align="center"><em>Next.js 15 · TypeScript · Tailwind CSS · FastAPI · youtube-transcript-api · yt-dlp · Whisper · Docker</em></p>

---

## ✨ Features

- **Smart transcript retrieval** — uses [`youtube-transcript-api`](https://pypi.org/project/youtube-transcript-api/) for existing captions, falling back to **yt-dlp + Whisper** when captions are missing or disabled.
- **Any URL format** — `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/`, or a bare video ID.
- **Rich transcript viewer** — readable paragraph view **and** timestamped view, full-text **search with highlighting**, **jump-to-timestamp**, per-line **YouTube deep links**.
- **Video info** — title, channel, thumbnail and duration.
- **Export & share** — copy to clipboard, download **`.txt`**, export **PDF**, and **shareable links** (`?v=<id>`).
- **AI bonus features** — one-click **summary + key takeaways**, plus **translation** (requires an OpenAI key; degrades to a built-in extractive summary otherwise).
- **Dark mode** — system-aware, toggleable.
- **Production-minded backend** — transcript **caching**, **duplicate-request de-duplication**, **background jobs with live progress**, **rate limiting**, input validation, automatic temp-file cleanup, and friendly error handling for private/removed/region-blocked/caption-disabled videos.
- **Docker-first** — one command brings up the whole stack.

---

## 🏗️ Architecture

```
┌──────────────────────────┐         ┌─────────────────────────────────────────┐
│  Next.js 15 (frontend)   │  HTTP   │             FastAPI (backend)             │
│                          │ ──────▶ │                                           │
│  UrlForm                 │         │  POST /api/transcript         (sync)      │
│  useTranscript (poll)    │ ◀────── │  POST /api/transcript/async   (job id)    │
│  TranscriptViewer        │         │  GET  /api/transcript/jobs/{id}           │
│  SummaryPanel            │         │  POST /api/summary                        │
│  VideoInfoCard           │         │  GET  /api/health                         │
└──────────────────────────┘         │                                           │
                                      │  services/                                │
                                      │   ├─ captions  (youtube-transcript-api)   │
                                      │   ├─ ytdlp     (metadata + audio dl)      │
                                      │   ├─ whisper   (local STT fallback)       │
                                      │   ├─ cache     (memory + disk, TTL)       │
                                      │   ├─ jobs      (threadpool + dedup)       │
                                      │   └─ summary   (OpenAI / extractive)      │
                                      └─────────────────────────────────────────┘
```

The frontend uses the **async job flow** (`/async` → poll `/jobs/{id}`) for a
live progress bar; the synchronous `POST /api/transcript` is kept for scripting
and matches the documented API contract.

### Project structure

```
youtube-transcribe/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, CORS, error handlers
│   │   ├── config.py               # Pydantic settings (env-driven)
│   │   ├── models.py               # API request/response schemas
│   │   ├── exceptions.py           # Domain errors → HTTP mapping
│   │   ├── rate_limit.py           # slowapi limiter
│   │   ├── routers/                # transcript, summary, health
│   │   ├── services/               # captions, ytdlp, whisper, cache, jobs, summary
│   │   └── utils/                  # url_parser, text, files
│   ├── tests/                      # pytest
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/                        # App Router (layout, page, providers)
│   ├── components/                 # UI components
│   ├── hooks/useTranscript.ts      # job creation + polling state machine
│   ├── lib/                        # types, api client, utils, pdf, youtube
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## 🚀 Quick start (Docker — recommended)

**Prerequisites:** Docker + Docker Compose.

```bash
git clone <your-repo-url> youtube-transcribe
cd youtube-transcribe
cp .env.example .env          # optional: set OPENAI_API_KEY, WHISPER_MODEL, …
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend  → http://localhost:8000 (interactive docs at **/docs**)

> The first Whisper transcription downloads the model (cached in a Docker
> volume afterwards). `ffmpeg` is installed in the backend image automatically.

Stop with `docker compose down`.

---

## 🧑‍💻 Local development (without Docker)

**Prerequisites:** Python 3.11+, Node.js 20+, and **ffmpeg** on your PATH
(`brew install ffmpeg` / `sudo apt install ffmpeg`). ffmpeg is required by
Whisper and yt-dlp.

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt  # or requirements-dev.txt for tests/lint
cp .env.example .env

uvicorn app.main:app --reload --port 8000
```

> Installing `openai-whisper` pulls in PyTorch. On a CPU-only machine you can
> install the lighter CPU build first:
> `pip install torch --index-url https://download.pytorch.org/whl/cpu`

### 2) Frontend

```bash
cd frontend
npm install
cp .env.example .env.local       # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000.

### Using the Makefile

```bash
make install     # install backend + frontend deps
make backend     # run FastAPI (:8000)
make frontend    # run Next.js (:3000)
make test        # backend tests
make lint        # ruff + eslint
make docker-up   # full stack via Docker
```

---

## 🔌 API reference

### `POST /api/transcript`
Fetch a transcript synchronously.

```jsonc
// Request
{ "url": "https://youtu.be/dQw4w9WgXcQ", "language": "en", "force_whisper": false }

// Response
{
  "video_id": "dQw4w9WgXcQ",
  "title": "…",
  "channel": "…",
  "thumbnail": "https://i.ytimg.com/…",
  "duration": "3:33",
  "duration_seconds": 213,
  "source": "captions",            // "captions" | "whisper"
  "language": "en",
  "transcript": [
    { "text": "…", "start": 0.0, "duration": 4.1, "end": 4.1 }
  ],
  "text": "full transcript as plain text",
  "cached": false
}
```

### `POST /api/transcript/async` → `{ "job_id": "…" }`
Start a background job (best for long videos).

### `GET /api/transcript/jobs/{job_id}`
Poll a job:
```jsonc
{ "job_id":"…", "status":"transcribing", "progress":0.62, "message":"…",
  "result": null, "error": null }
```
`status ∈ queued | processing | downloading | transcribing | completed | failed`.

### `POST /api/summary`
```jsonc
{ "video_id": "dQw4w9WgXcQ", "text": "…", "target_language": "Spanish" }
// → { "summary": "…", "takeaways": ["…"], "source": "openai", "target_language": "Spanish" }
```

### `GET /api/health`
Returns service status and which optional features are enabled.

Errors are always returned as `{ "detail": "human message", "code": "machine_code" }`.

---

## ⚙️ Environment variables

### Backend (`backend/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | `development` / `production`. |
| `CORS_ORIGINS` | `http://localhost:3000,…` | Comma-separated allowed origins. |
| `CACHE_ENABLED` | `true` | Enable transcript caching. |
| `CACHE_TTL_SECONDS` | `604800` | Cache lifetime (7 days). |
| `CLEANUP_FILES` | `true` | Delete downloaded audio after use. |
| `WHISPER_ENABLED` | `true` | Allow the Whisper fallback. |
| `WHISPER_MODEL` | `base` | `tiny`/`base`/`small`/`medium`/`large`. |
| `WHISPER_DEVICE` | `auto` | `auto`/`cpu`/`cuda`. |
| `MAX_WHISPER_DURATION_SECONDS` | `3600` | Reject Whisper on longer videos. |
| `YTDLP_PROXY` | – | Optional outbound proxy for yt-dlp. |
| `YTDLP_COOKIEFILE` | – | Optional cookies file for restricted videos. |
| `RATE_LIMIT_ENABLED` | `true` | Toggle rate limiting. |
| `RATE_LIMIT` | `30/minute` | Default per-IP limit. |
| `RATE_LIMIT_TRANSCRIPT` | `10/minute` | Limit for transcript endpoints. |
| `MAX_CONCURRENT_JOBS` | `2` | Worker pool size. |
| `OPENAI_API_KEY` | – | Enables AI summaries + translation. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model used for summaries. |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL (browser-side). |

---

## ☁️ Deployment

### Frontend → Vercel

1. Import the repo into Vercel and set the **Root Directory** to `frontend/`.
2. Framework preset: **Next.js** (build `next build`, output auto-detected).
3. Add env var **`NEXT_PUBLIC_API_URL`** = your deployed backend URL
   (e.g. `https://tubetranscript-api.onrender.com`).
4. Deploy. (Remove `output: "standalone"` is **not** needed — Vercel handles it.)

### Backend → Render

1. **New → Web Service**, connect the repo, set **Root Directory** to `backend/`.
2. Environment: **Docker** (uses `backend/Dockerfile`, which includes ffmpeg).
3. Add env vars: `CORS_ORIGINS=https://your-vercel-app.vercel.app`, optionally
   `OPENAI_API_KEY`, and `WHISPER_MODEL=base` (use `tiny` on small instances).
4. Health check path: `/api/health`. Deploy.

> Whisper + PyTorch need memory. Use at least a 2 GB instance (or `WHISPER_MODEL=tiny`),
> or set `WHISPER_ENABLED=false` to run captions-only on tiny instances.

### Backend → Railway

1. **New Project → Deploy from Repo**; Railway detects `backend/Dockerfile`
   (set the service root to `backend/`).
2. Add the same env vars as above and expose port **8000**.
3. Generate a public domain and point the frontend's `NEXT_PUBLIC_API_URL` at it.

After deploying both, update the backend's `CORS_ORIGINS` to include the
frontend's production URL and redeploy.

---

## 🔒 Security notes

- All input is validated (Pydantic + URL parsing); only valid YouTube IDs are accepted.
- Per-IP **rate limiting** (slowapi), honouring `X-Forwarded-For` behind proxies.
- Downloaded audio is written to a temp dir and **removed after processing**.
- Containers run as a **non-root** user.
- CORS is locked to the origins you configure.

---

## 🧪 Testing & linting

```bash
cd backend && pytest            # unit tests (URL parsing, text utils, summary)
cd backend && ruff check app tests
cd frontend && npm run lint
```

---

## ⚠️ Disclaimer

TubeTranscript is for **personal and educational use**. Respect YouTube's Terms
of Service and content creators' copyright. You are responsible for how you use
downloaded/transcribed content.

## 📄 License

[MIT](./LICENSE)
