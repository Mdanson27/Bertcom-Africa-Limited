#!/bin/sh
set -eu

echo "Applying database migrations..."
alembic upgrade head

echo "Starting SAQ worker..."
python -m saq app.core.worker.settings --workers 1 &
WORKER_PID=$!

shutdown() {
  kill "$WORKER_PID" 2>/dev/null || true
}

trap shutdown INT TERM EXIT

echo "Starting Bertcom API..."
exec granian   --interface asgi   app.main:app   --host 0.0.0.0   --port "${PORT:-8000}"   --access-log   --log-level info   --workers 1   --runtime-threads 2   --http auto   --backlog 512
