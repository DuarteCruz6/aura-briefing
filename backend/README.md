# Backend

FastAPI backend for **Pastel de Data**: personal agent newsletter (track sources → fetch updates → summarize → TTS podcast).

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- **Health:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- **Transcribe (YouTube → text):** `POST /transcribe` with body `{"url": "https://www.youtube.com/watch?v=..."}`. Requires `ELEVENLABS_API_KEY` in `.env`. Returns `{ "channel", "title", "description", "text" }`.

## Docker

From the `backend/` directory:

1. **Create a `.env` file** with required API keys (see `.env.example`):

   ```bash
   cp .env.example .env
   # Edit .env and set:
   # - ELEVENLABS_API_KEY=... (https://elevenlabs.io) — STT/TTS
   # - GEMINI_API_KEY=... (https://aistudio.google.com/apikey) — LLM summaries
   ```

2. **Run:**

   ```bash
   docker compose up --build
   ```

- App: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- SQLite data is stored in a named volume `newsletter_data` so it persists between restarts.
- Env vars are loaded from `backend/.env` (see `env_file` in `docker-compose.yml`).

## Database

- **Engine:** SQLite by default; file at `./data/newsletter.db` (created on first run).
- **ORM:** SQLAlchemy 2.x. Tables are created automatically on app startup (`init_db()`).

### Schema overview

| Table      | Purpose |
|-----------|---------|
| **users** | One row per user (Google OAuth). `google_id` unique. |
| **sources** | What each user tracks: type (youtube, x, linkedin, news, podcast), `url`, `frequency` (daily, weekly, etc.), `last_fetched_at`. |
| **items** | Fetched content: one row per video/post/article/episode. `source_id`, `external_id` (e.g. video id), `title`, `link`, `content` (for LLM), `published_at`. Unique on `(source_id, external_id)`. |
| **runs** | One digest run per user: `status` (pending → fetching → summarizing → generating_audio → completed/failed), `started_at`, `finished_at`, optional `error_message`. |
| **run_items** | Many-to-many: which items were included in a given run. |
| **summaries** | One per run: `content` (text sent to TTS). |
| **audio** | One per summary: `storage_path`, optional `url`, `duration_seconds` (ElevenLabs output). |

### Relationships

- **User** → many **Source**; **User** → many **Run**.
- **Source** → many **Item**.
- **Run** → many **RunItem** → **Item**; **Run** → one **Summary** → one **Audio**.

### Enums

- **SourceType:** `youtube`, `x`, `linkedin`, `news`, `podcast`
- **FetchFrequency:** `daily`, `every_3_days`, `weekly`, `biweekly`, `manual`
- **RunStatus:** `pending`, `fetching`, `summarizing`, `generating_audio`, `completed`, `failed`

## Config

Optional `.env` in `backend/`:

- `DATABASE_URL` – default `sqlite:///./data/newsletter.db`
- `ENVIRONMENT` – e.g. `development` (enables SQL echo)

## Next steps

- Auth: Google OAuth and `get_current_user` dependency.
- APIs: CRUD for sources, list runs/summaries/audio for in-app consumption.
- Workers: scheduled fetch (RSS etc.) → create run + items → LLM summary → ElevenLabs TTS → save audio.
