# TubeTranscript — Frontend

Next.js 15 (App Router) + TypeScript + Tailwind CSS UI for TubeTranscript.

## Develop

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL if your backend isn't on :8000
npm run dev                  # http://localhost:3000
```

## Scripts

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start the dev server                 |
| `npm run build` | Production build (`.next/standalone`)|
| `npm run start` | Serve the production build           |
| `npm run lint`  | Lint with ESLint                     |

## Environment variables

| Variable              | Default                 | Description                                  |
| --------------------- | ----------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL of the FastAPI backend (browser-side). |

> `NEXT_PUBLIC_*` variables are inlined at **build time**. When building the
> Docker image, pass it as a build arg (see the root `docker-compose.yml`).

## Structure

```
app/         App Router entry (layout, page, providers, globals)
components/  UI: UrlForm, VideoInfoCard, TranscriptViewer, SummaryPanel, …
hooks/       useTranscript — job creation + polling state machine
lib/         types, api client, youtube/url helpers, utils, pdf export
```
