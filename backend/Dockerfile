# Backend-only image for Railway (or any Docker host)
FROM python:3.12-slim

WORKDIR /app

# FFmpeg for yt-dlp (YouTube audio)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /app/data

# Railway sets PORT; default 8000 for local Docker
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
