# HireADev

HireADev is an AI-assisted resume screening workflow for technical hiring. It takes a job brief plus a ZIP of resumes, runs a staged screening pipeline, ranks candidates, surfaces issues, exports shortlists as CSV, and can perform lean web research on the strongest candidates.

The current app is built as a React frontend plus a FastAPI backend. The backend is intentionally stateful for MVP speed: jobs, candidates, events, and research state are persisted to a local JSON file.

## What It Does

- Create a job from a title, keywords, and job description
- Upload a ZIP of resumes in PDF, DOCX, DOC, PNG, JPG, or JPEG format
- Extract text with PyMuPDF and OCR fallback
- Filter duplicates and obvious low-signal resumes
- Run a coarse AI screen before deeper scoring
- Rank candidates in a leaderboard with rationale, evidence, and flags
- Re-open older jobs and append more resumes
- Review issues, retry failed candidates, and shortlist candidates
- Export a shortlist as a downloadable CSV
- Run sequential deep research on top candidates with public web signals

## Pipeline

The current backend runs a five-stage pipeline:

1. Extraction
   Parse resume text from PDFs, Office docs, and images.
2. Spam / low-signal filter
   Drop duplicates and clearly invalid inputs early.
3. Coarse scoring
   Use a fast Groq model to filter out weak matches before deeper analysis.
4. Deep scoring
   Use a larger model to produce structured evaluation data.
5. Deep research
   Research top candidates one at a time using Groq Compound with a small prompt.

The research step is deliberately lean. It does not send one large multi-candidate prompt anymore. Instead, it researches one candidate, saves the result, then moves to the next.

## Stack

- Frontend: React 19, Vite, TypeScript, Tailwind CSS
- Backend: FastAPI, Python 3.12, `uv`, Uvicorn
- AI: Groq models for coarse scoring, deep scoring, and web research
- OCR / parsing: PyMuPDF, pytesseract, Pillow, python-docx
- Persistence: local JSON state in `backend/.data/local_state.json`

## Repo Layout

```text
.
├── backend/
│   ├── pipeline/         # extraction, spam filter, scoring, enrichment
│   ├── utils/            # Groq client, storage helpers, integrations
│   ├── server.py         # FastAPI app used in local/dev and MVP deploys
│   ├── Dockerfile        # backend container image
│   └── pyproject.toml
├── frontend/
│   ├── src/pages/        # landing, jobs, upload, dashboard, research
│   ├── src/lib/          # REST client + polling helpers
│   └── package.json
└── render.yaml           # Render backend deployment blueprint
```

## Product Flow

1. Open the landing page
2. Create a job context
3. Upload a ZIP of resumes
4. Watch the analyzing page update in real time
5. Search the leaderboard, review candidates, and shortlist
6. Export the shortlist as CSV
7. Trigger deep research on the strongest candidates

## Local Development

### Prerequisites

- Python 3.12+
- Node.js 20+
- `uv`
- `npm`
- `tesseract-ocr` installed on your machine if you want OCR fallback to work locally

### Backend

Create `backend/.env`:

```env
GROQ_API_KEY=your_groq_key
ALLOWED_ORIGINS=http://localhost:5173
DATA_DIR=./.data
```

Install and run:

```bash
cd backend
uv sync
uv run uvicorn server:app --host 0.0.0.0 --port 8000
```

Useful endpoint:

```text
GET /healthz
```

### Frontend

Create `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Install and run:

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server defaults to `http://localhost:5173`.

## Environment Variables

### Backend

- `GROQ_API_KEY`
  Required. Used for coarse scoring, deep scoring, and research.
- `ALLOWED_ORIGINS`
  Comma-separated CORS allowlist.
- `DATA_DIR`
  Path where local persistent state is stored.

### Frontend

- `VITE_API_BASE_URL`
  Base URL for the backend API.

## API Surface

Current FastAPI routes:

- `POST /create_job`
- `GET /list_jobs`
- `POST /append_resumes`
- `GET /get_job`
- `GET /get_leaderboard`
- `GET /get_in_progress`
- `GET /get_issues`
- `GET /get_events`
- `GET /get_deep_research`
- `POST /run_deep_research`
- `POST /shortlist_candidate`
- `POST /retry_candidate`
- `GET /export_shortlist`
- `GET /healthz`

## Deployment Notes

### Current MVP shape

The backend is a good fit for:

- a single VM
- a Docker container
- a Render web service

The current backend is not horizontally scalable yet because job state is file-backed. For MVPs, demos, and early production this is acceptable. For multi-instance deployments, move job state to a real datastore first.

### Proven deployment options

- Render backend via `render.yaml`
- AWS VM with Caddy or Nginx in front of Uvicorn
- Netlify frontend pointed at any reachable HTTPS backend URL

### Quick public tunnel options

For fast demos from a local machine:

- Cloudflare Tunnel
- localhost.run

In those cases, point `VITE_API_BASE_URL` at the public HTTPS tunnel URL and set backend `ALLOWED_ORIGINS` to your frontend URL.

## Current MVP Constraints

- State is stored locally, not in a managed database
- OCR depends on system `tesseract-ocr`
- Groq rate limits can affect deep research
- Deep research is sequential by design to control token usage

## Future Hardening

- Move state to Postgres or Appwrite
- Add auth and user-scoped jobs
- Add proper worker queues for long-running pipeline stages
- Add idempotency around uploads and research runs
- Replace polling with SSE or WebSockets if needed

## Commands

Backend:

```bash
cd backend
uv sync
uv run uvicorn server:app --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Production frontend build:

```bash
cd frontend
npm run build
```

## License

No license file is currently included in this repository.
