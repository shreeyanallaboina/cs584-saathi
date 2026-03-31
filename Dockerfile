# Single Cloud Run service: Vite build served by Flask; API at /api/*
# Build from repo root: docker build -t saathi .

FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

COPY backend/requirements.txt /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.txt gunicorn

COPY backend/ /app/backend/
COPY --from=frontend-build /build/dist /app/backend/static/dist

WORKDIR /app/backend
# SQLite: one worker avoids cross-process DB locking; threads still handle concurrency.
CMD exec gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 4 --timeout 120 app:app
