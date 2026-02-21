"""
Start uvicorn reading PORT from the environment (Railway injects this).
Logs the port so Railway logs show what we're binding to.
"""
import os
import sys

port = int(os.environ.get("PORT", "8000"))
host = "0.0.0.0"
print(f"Starting on {host}:{port}", flush=True)
sys.stdout.flush()
sys.stderr.flush()

import uvicorn
uvicorn.run(
    "app.main:app",
    host=host,
    port=port,
)
