# Deploy backend to Railway

1. **Create a project** at [railway.app](https://railway.app) and install the GitHub integration if you want deploys from git.

2. **New service** → **Deploy from GitHub repo** (or “Empty service” and connect repo later). Choose this repo.

3. **Settings** for the service:
   - **Root Directory**: set to `backend` (so the build context is the backend folder and uses `backend/Dockerfile`).
   - **Builder**: Dockerfile (already set in `railway.toml`).

4. **Variables** (Railway dashboard → Variables): add at least:
   - `GEMINI_API_KEY` – from [Google AI Studio](https://aistudio.google.com/apikey)
   - `ELEVENLABS_API_KEY` – from [ElevenLabs](https://elevenlabs.io) (needed for YouTube transcription)
   - `CORS_ORIGINS` – your frontend URL(s), comma-separated, e.g. `https://your-app.vercel.app`

5. **Deploy**: push to the connected branch or trigger a deploy from the dashboard. Railway will build the Docker image and run it; the healthcheck hits `/health`.

6. **URL**: Use the generated Railway URL (e.g. `https://your-service.up.railway.app`) as the API base in your frontend.

7. **If you get 502 "connection refused"**: In the service **Settings** → **Networking**, check **Target port**. Leave it blank so Railway uses the `PORT` it injects (often 8080), or set it to match the port shown in your **Deploy logs** (e.g. "Starting on 0.0.0.0:8080"). The app must listen on that port.

**Note:** The app uses SQLite stored in `/app/data`. On Railway this is ephemeral unless you add a volume; for production you may want to switch to a hosted database and set `DATABASE_URL`.
