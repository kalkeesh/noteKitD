@echo off
echo Starting NoteKit Services...

cd /d "%~dp0"

echo Starting core backend...
start "NoteKit Core Backend" cmd /c "cd backend-core && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo Starting Budgetify backend...
start "NoteKit Budgetify Backend" cmd /c "cd backend-budgetify && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001"

echo Starting frontend...
start "NoteKit Frontend" cmd /c "cd frontend && npx expo start --lan -c"

echo Core backend, Budgetify backend, and frontend are starting in separate windows!
pause
