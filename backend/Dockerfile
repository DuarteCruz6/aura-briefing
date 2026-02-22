# Backend-only image for Railway (or any Docker host)
FROM python:3.12-slim

WORKDIR /app

# FFmpeg for yt-dlp; libpq for PostgreSQL (psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /app/data

# Railway injects PORT at runtime (e.g. 8080). Default 8080 so health check port matches when unset.
ENV PORT=8080
EXPOSE 8080
CMD ["python", "-u", "run.py"]
