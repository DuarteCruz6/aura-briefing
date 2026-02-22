"""
Start uvicorn reading PORT from the environment (Railway injects this).
Logs the port so Railway logs show what we're binding to.
"""
import os
import sys

# Log immediately so Railway runtime logs show we started (before any slow imports).
print("[run.py] bootstrap", flush=True)
port = int(os.environ.get("PORT", "8080"))
host = "0.0.0.0"
print(f"[run.py] binding to {host}:{port} (PORT env={os.environ.get('PORT')!r})", flush=True)
sys.stdout.flush()
sys.stderr.flush()

import uvicorn
print(f"[run.py] starting uvicorn app.main:app", flush=True)
uvicorn.run(
    "app.main:app",
    host=host,
    port=port,
)
