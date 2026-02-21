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

# Railway injects PORT at runtime (e.g. 8080). Python reads it so no shell needed.
EXPOSE 8000
CMD ["python", "-u", "run.py"]
