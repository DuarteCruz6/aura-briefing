# Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
# npm install tolerates lock file drift (e.g. different npm in image vs host); use npm ci for strict reproducibility
RUN npm install
COPY frontend/ ./
RUN npm run build

# Backend + serve frontend
FROM python:3.12-slim
WORKDIR /app

# FFmpeg for yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./static

RUN mkdir -p /app/data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
