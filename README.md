# Saathi — Reproductive Health Companion

Saathi (`ساتھی` — "companion" in Urdu) is a private, bilingual (Urdu/English) web app giving women in rural Pakistan a safe, stigma-free space to ask sexual and reproductive health questions. An AI chatbot answers questions grounded in a curated knowledge base; when confidence falls below 75%, the question is redirected to an anonymous community forum mediated by Lady Health Workers (LHWs).

**Live URL:** https://saathi-app-1046034871301.us-central1.run.app

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│                React + Vite + TypeScript SPA                     │
│                                                                  │
│   Landing · Home · Chatbot · Forum · LHW Portal                 │
│   AppShell · ProtectedRoute · AuthContext (localStorage)        │
└───────────────────────┬──────────────────────────────────────────┘
                        │ HTTPS  /api/*  (relative — same origin)
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│               Flask Backend  (Google Cloud Run)                  │
│                         app.py                                   │
│                                                                  │
│  /api/auth/register    /api/auth/login                          │
│  /api/lhw/login        /api/lhw/referral-codes                 │
│  /api/forum/posts      /api/forum/posts/:id/replies            │
│  /api/chat             /api/health                              │
│                                                                  │
│  ┌──────────────────┐       ┌──────────────────────────────┐   │
│  │  chat_service.py │──────▶│       llm_chat.py            │   │
│  │  Orchestration + │       │  google-genai SDK            │   │
│  │  smalltalk filter│       │  Gemini 2.0-flash-lite       │   │
│  └────────┬─────────┘       │  KB injected → system prompt │   │
│           │ on error        │  Returns JSON: confidence,   │   │
│           ▼                 │  can_answer, answer,         │   │
│  ┌──────────────────┐       │  matched_topic               │   │
│  │  chat_logic.py   │       └──────────────────────────────┘   │
│  │  Heuristic token │                    ▲                      │
│  │  overlap fallback│       ┌────────────┴─────────────────┐   │
│  └──────────────────┘       │     knowledge_base.txt       │   │
│                             │  WHO/CDC/NICHD sourced SRH   │   │
│                             │  contraception · abortion    │   │
│                             │  menstrual_health            │   │
│                             └──────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    SQLite / Cloud SQL                     │  │
│  │  users · lhw_users · referral_codes                      │  │
│  │  forum_posts · forum_replies                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  GCP Secret Manager ──▶ GEMINI_API_KEY (injected at runtime)   │
└──────────────────────────────────────────────────────────────────┘
```

### Chat request flow
1. `POST /api/chat` → `chat_service.run_chat()`
2. Greeting/smalltalk? → return immediately, no LLM call
3. `GEMINI_API_KEY` set → `llm_chat.complete_llm()` loads KB, injects into system prompt
4. Gemini returns `{ confidence, can_answer, answer, matched_topic }`
5. Server enforces threshold: `confidence >= 0.75 AND answer != null`
6. Pass → answer + disclaimer returned to frontend
7. Fail → `suggest_forum: true`, `forum_prefill` = original message
8. Any exception → silent fallback to heuristic scorer

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (free)

---

## Local Setup

### 1. Clone

```bash
git clone https://github.com/shreeyanallaboina/cs584-saathi.git
cd cs584-saathi
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment variables

```bash
export GEMINI_API_KEY="your-key-here"   # from aistudio.google.com
export SECRET_KEY="any-random-string"   # optional locally
```

> Without `GEMINI_API_KEY` the chatbot uses the heuristic keyword fallback — the app still runs fully, answers will just be less natural.

### 4. Start backend

```bash
python app.py
# Starts on http://127.0.0.1:5050
# macOS note: port 5000 is taken by AirPlay — app defaults to 5050
```

On first run, the DB seeds automatically:
- LHW account: `lhw_demo` / `lhw_demo_pass`
- Unused referral code: `DEMO1234`

### 5. Start frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
# Vite starts on http://localhost:5173
# /api/* proxied to http://127.0.0.1:5050
```

Open http://localhost:5173.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Recommended | — | Google AI Studio key. Falls back to heuristic if unset. |
| `GOOGLE_API_KEY` | Alternative | — | Alias — either name works. |
| `GEMINI_MODEL` | No | `gemini-2.0-flash-lite` | Override model name. |
| `SECRET_KEY` | Yes (prod) | `dev-change-in-production` | Flask session secret. |
| `DATABASE_URL` | No | SQLite | Cloud SQL PostgreSQL URL for persistent data. |
| `PORT` | No | `5050` | Flask listen port. Cloud Run sets this to `8080`. |

---

## Test Credentials

### New user registration
| Field | Value |
|-------|-------|
| Referral code | `DEMO1234` (single-use — generate a new one via LHW portal if already used) |
| Username | any (e.g. `testuser`) |
| Password | any (e.g. `password123`) |

### Returning user
Log in with whatever username/password you registered with above.

### LHW Portal (`/lhw`)
| Field | Value |
|-------|-------|
| Username | `lhw_demo` |
| Password | `lhw_demo_pass` |

---

## Project Structure

```
cs584-saathi/
├── Dockerfile                  # Multi-stage: Vite build → Gunicorn serve
├── .dockerignore
├── backend/
│   ├── app.py                  # Flask app + all REST endpoints
│   ├── chat_service.py         # Orchestration + greeting pre-filter
│   ├── chat_logic.py           # Heuristic token-overlap scorer (fallback)
│   ├── llm_chat.py             # Gemini integration (google-genai SDK)
│   ├── knowledge_base.txt      # Curated SRH KB — WHO/CDC/NICHD sourced
│   ├── requirements.txt
│   └── static/dist/            # Built frontend (Dockerfile populates this)
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Landing.tsx     # Login + register with referral code
    │   │   ├── Home.tsx
    │   │   ├── ChatbotPage.tsx
    │   │   ├── ForumPage.tsx
    │   │   ├── ForumNew.tsx
    │   │   └── LHWPortal.tsx
    │   ├── components/
    │   │   ├── AppShell.tsx    # Header + bottom nav + otter FAB
    │   │   └── ProtectedRoute.tsx
    │   ├── api.ts              # All fetch wrappers
    │   ├── auth.tsx            # AuthContext + localStorage
    │   └── App.tsx             # React Router routes
    ├── public/
    │   ├── logo.png
    │   └── otter.png
    └── vite.config.ts          # Proxies /api → Flask
```

---

## Docker (local)

```bash
docker build -t saathi .
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e GEMINI_API_KEY="your-key-here" \
  saathi
# Open http://localhost:8080
```

---

## Deploy to Cloud Run

```bash
# Store key in Secret Manager (once)
echo -n "your-gemini-key" | gcloud secrets create gemini-api-key --data-file=-

# Grant access
PROJECT_NUMBER=$(gcloud projects describe saathi-489500 --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Deploy
gcloud run deploy saathi-app \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --platform managed \
  --project saathi-489500 \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest"
```

To verify Gemini is active after deploy:
```bash
curl -s -X POST https://saathi-app-1046034871301.us-central1.run.app/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"is a 27-day cycle normal?"}' | python3 -m json.tool
# Look for "source": "llm" in the response
```

---

## Known Limitations

1. **PIN lock and icon picker not implemented.** Feature 1 of the SOW (discreet app security) is partially complete. The anonymous handle assignment works, but the per-session PIN prompt and neutral icon picker are not built. The app is currently identifiable as Saathi to anyone who opens it.

2. **SQLite is ephemeral on Cloud Run.** Data is lost when instances recycle. Set `DATABASE_URL` to a Cloud SQL PostgreSQL connection string for persistent production data.

3. **Gemini free-tier quota limits.** The free tier allows ~1,500 requests/day. Under heavy load the chatbot falls back silently to the heuristic scorer. Check Cloud Run logs for `429 RESOURCE_EXHAUSTED` if answers look generic (`"source": "heuristic"` in API response).

4. **No server-side session expiry.** Auth state lives in `localStorage`. Logging out on one device does not invalidate other sessions.

5. **Knowledge base is English-only.** The KB content is in English. Gemini is instructed to respond in the user's language, but Urdu-language questions may get weaker matches against English KB content.
