# GladME Studio V4 — Startup Instructions

To ensure GladME Studio V4 runs smoothly without server or port conflicts, follow the instructions below. 

The application consists of two parts:
1. **Backend (FastAPI)**: Must run on `http://localhost:8000`
2. **Frontend (Vite/React)**: Runs on `http://localhost:5173` and proxies API requests to port `8000`.

---

## The Easiest Way to Start (Windows)
We have created a `start.bat` file in this directory. Simply double-click it to start both the backend and frontend simultaneously in separate windows. 

If you prefer to start them manually, follow the steps below.

---

## 1. Start the Backend Manually

Open a terminal or command prompt inside the `V4/backend` directory.

Activate the virtual environment and start the Python server:

```bash
cd backend
.\venv\Scripts\activate
python main.py
```
*Note: We have updated `main.py` so it automatically enforces port `8000`. You can also run `python -m uvicorn main:app --reload --port 8000`.*

---

## 2. Start the Frontend Manually

Open a *new* terminal or command prompt inside the `V4/frontend` directory.

Install dependencies (if you haven't already) and start the Vite development server:

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on port `5173`. 

---

## 3. Verify it is running
- Open your browser and navigate to: **[http://localhost:5173](http://localhost:5173)**
- Log in with your credentials (e.g., `dev@gladme.dev` / `GladME@2026`).

## Troubleshooting
- **API Connection Refused**: Ensure the backend terminal is running and listening explicitly on port `8000`. If it's running on 8001, Vite will not proxy requests correctly.
- **Database Locked Errors**: Stop the backend terminal (`Ctrl+C`), ensure no other instances of the backend are running in the background, and start it again.
