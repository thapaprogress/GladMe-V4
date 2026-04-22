@echo off
echo =======================================================
echo          Starting GladME Studio V4
echo =======================================================
echo.
echo Starting Backend (FastAPI) on port 8000...
start "GladME V4 Backend" cmd /k "cd backend && .\venv\Scripts\activate && python main.py"

echo Starting Frontend (Vite) on port 5173...
start "GladME V4 Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo Please wait a moment, then open your browser to:
echo http://localhost:5173
echo.
pause
