#!/bin/sh
# Railway sets PORT; ensure we listen on it (default 8000 for local Docker)
port="${PORT:-8000}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$port"
