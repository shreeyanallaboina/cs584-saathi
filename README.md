# Saathi — prototype web portal

Mobile-first web app for private reproductive health information (contraception, menstrual health, general abortion-related education) with:

- **Returning users:** username and password.
- **New users:** referral code from a Lady Health Worker (LHW), then account creation.
- **LHW portal:** separate flow to log in and generate single-use referral codes.
- **Chatbot:** answers only when library-match **confidence ≥ 75%**; otherwise offers to post the same question to the **anonymous forum** (prefilled).
- **Forum:** posts and replies show only **auto-generated anonymous handles** (not login usernames). Topics are limited to `contraception`, `abortion`, and `menstrual_health`.
- **Branding:** pink `#F88389`, green `#005030`, otter FAB (bottom-right) opens the chatbot; logo in header.

## Stack (aligned with your SOW)

- **Frontend:** React (Vite + TypeScript).
- **Backend:** Flask, SQLAlchemy, SQLite (`saathi.db` beside `app.py`).
- **Chat:** curated `knowledge_base.txt` is injected into the model’s system prompt. With **`GEMINI_API_KEY`** (or **`GOOGLE_API_KEY`**) set, **`/api/chat`** uses **Google Gemini** (default model `gemini-2.0-flash`), returns **JSON-grounded** answers, and the server **only accepts answers when confidence ≥ 0.75** (SOW). Without an API key, the same endpoint **falls back** to the built-in overlap heuristic (for local dev).

## API keys (Google Gemini for SOW / production)

1. Create a key in [Google AI Studio](https://aistudio.google.com/apikey) (or Google Cloud Vertex if you use that billing path).
2. **Local:** `export GEMINI_API_KEY=...` then run `python app.py`. (`GOOGLE_API_KEY` also works.)
3. **Cloud Run:** store the key in **Secret Manager**, then attach it to the service, for example:
   ```bash
   # Create secret (once): echo -n 'YOUR_KEY' | gcloud secrets create gemini-api-key --data-file=-
   gcloud run deploy saathi-app \
     --source . \
     --region us-central1 \
     --project saathi-489500 \
     --allow-unauthenticated \
     --set-secrets "GEMINI_API_KEY=gemini-api-key:latest"
   ```
   (Adjust secret name/version to match your project.)

**Optional:** `GEMINI_MODEL` (default `gemini-2.0-flash`) to switch models (e.g. `gemini-1.5-flash`).

**Expand grounding:** edit `backend/knowledge_base.txt` — the model is only allowed to use what you put there, so richer vetted text improves answers while staying in scope.

## Quick start

**1. Backend**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

API listens on `http://127.0.0.1:5000`. First run seeds:

- LHW login: **`lhw_demo`** / **`lhw_demo_pass`**
- One unused referral code: **`DEMO1234`**

**2. Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`). The Vite dev server proxies `/api` to the Flask app.

## Docker & Google Cloud Run

The repo root `Dockerfile` builds the frontend, copies `dist` into `backend/static/dist`, and runs **Gunicorn** on **`PORT`** (Cloud Run sets this, usually `8080`). One container serves both the SPA and `/api/*`, so your public URL (for example [your Cloud Run service](https://saathi-app-1046034871301.us-central1.run.app)) needs **no separate API host** and the frontend keeps using relative `/api/...` calls.

**Build and run locally**

```bash
cd /path/to/Final
docker build -t saathi .
docker run --rm -p 8080:8080 -e PORT=8080 saathi
```

Open `http://localhost:8080`. Health check: `GET /api/health`.

**Deploy to Cloud Run** (replace `PROJECT_ID` and adjust the service name if yours differs)

```bash
gcloud config set project PROJECT_ID
gcloud builds submit --tag gcr.io/PROJECT_ID/saathi
gcloud run deploy saathi-app \
  --image gcr.io/PROJECT_ID/saathi \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "SECRET_KEY=$(openssl rand -hex 32)"
```

After deploy, Cloud Run shows the service URL (e.g. `https://saathi-app-1046034871301.us-central1.run.app`). No `VITE_*` API URL is required because the UI talks to the same origin.

**SQLite on Cloud Run:** The app defaults to `sqlite:////tmp/saathi.db` when `K_SERVICE` is set (Cloud Run injects this). Data is **ephemeral** (lost when instances recycle). For a real pilot, point `DATABASE_URL` at **Cloud SQL (PostgreSQL)** as in your SOW.

## Assets

Logo and otter images live under `frontend/public/` as `logo.png` and `otter.png`.

## Production notes

- Set a strong `SECRET_KEY` in Cloud Run (never commit it). Use `DATABASE_URL` for PostgreSQL when you outgrow ephemeral SQLite.
- Replace prototype chat scoring with your validated RAG + model JSON (`confidence` / `can_answer`) when you add the OpenAI SDK.
