# Deploy backend to Railway

1. **Create a project** at [railway.app](https://railway.app) and install the GitHub integration if you want deploys from git.

2. **New service** → **Deploy from GitHub repo** (or “Empty service” and connect repo later). Choose this repo.

3. **Settings** for the service:
   - **Root Directory**: set to `backend` (so the build context is the backend folder and uses `backend/Dockerfile`).
   - **Builder**: Dockerfile (already set in `railway.toml`).

4. **Variables** (Railway dashboard → Variables): add at least:
   - `GEMINI_API_KEY` – from [Google AI Studio](https://aistudio.google.com/apikey)
   - `ELEVENLABS_API_KEY` – from [ElevenLabs](https://elevenlabs.io) (needed for YouTube transcription)
   - `CORS_ORIGINS` – `https://aurora-brief.lovable.app,http://localhost:8080` (Lovable app + local dev).

5. **Deploy**: push to the connected branch or trigger a deploy from the dashboard. Railway will build the Docker image and run it; the healthcheck hits `/health`.

6. **URL**: Frontend at https://aurora-brief.lovable.app uses API at https://aura-briefing-production.up.railway.app (default in code). In Lovable you can set `VITE_API_URL` to that Railway URL or leave unset.

7. **If you get 502 "connection refused"**: In the service **Settings** → **Networking**, check **Target port**. Leave it blank so Railway uses the `PORT` it injects (often 8080), or set it to match the port shown in your **Deploy logs** (e.g. "Starting on 0.0.0.0:8080"). The app must listen on that port.

---

## Global database on Railway (PostgreSQL)

By default the app uses SQLite in `/app/data`, which is **ephemeral** on Railway (data is lost on redeploy). For a persistent, global database:

1. **Add PostgreSQL** in the same Railway project:
   - In the project canvas, click **+ New** (or `Ctrl/Cmd + K`).
   - Choose **Database** → **PostgreSQL** (or use the [Postgres template](https://railway.com/template/postgres)).
   - Railway will create a Postgres service with a volume; it exposes `DATABASE_URL` and other `PG*` variables.

2. **Wire the backend to Postgres**:
   - Open your **backend service** (the one built from this repo).
   - Go to **Variables**.
   - Add a variable: **Name** `DATABASE_URL`, **Value** click **Add Reference** (or “Reference variable”) and select the **PostgreSQL** service → **DATABASE_URL**.
   - This makes the backend use the shared Postgres instance instead of SQLite.

3. **Redeploy** the backend (push a commit or trigger a deploy). On startup, the app will run migrations (create tables) against Postgres. The `/tables` debug endpoint works with both SQLite and PostgreSQL.

No code changes are required: the app reads `DATABASE_URL` from the environment and uses it with SQLAlchemy. Local development can keep using SQLite (omit `DATABASE_URL` or set it to `sqlite:///./data/newsletter.db`).
