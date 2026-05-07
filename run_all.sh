#!/bin/bash
echo "Starting NoteKit Services..."

cd "$(dirname "$0")" || exit

echo "Starting core backend..."
(cd backend-core && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000) &
CORE_PID=$!

echo "Starting Budgetify backend..."
(cd backend-budgetify && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001) &
BUDGETIFY_PID=$!

echo "Starting frontend..."
(cd frontend && npx expo start --lan -c) &
FRONTEND_PID=$!

echo "Core backend, Budgetify backend, and frontend are starting!"
echo "Press Ctrl+C to stop all services."

trap "kill $CORE_PID $BUDGETIFY_PID $FRONTEND_PID 2>/dev/null" SIGINT

wait
