# GladME Studio V4 — Complete Walkthrough

> Version 4.0.0 | April 2026

---

## What Changed from V3 to V4

### 6 Issues Fixed

| # | Issue | Fix | File |
|---|-------|-----|------|
| 1 | Docker sandbox missing pytest | Custom `Dockerfile.runner` pre-installs pytest, pytest-cov, pytest-json-report | `backend/sandbox/Dockerfile.runner` |
| 2 | Coverage paths inside container | `_parse_coverage()` rewrites `/workspace/` → project-relative paths | `backend/sandbox/docker_sandbox.py:_parse_coverage` |
| 3 | WebSocket doesn't support Depends() | Auth via query param `?token=<jwt>` using `get_ws_user()` | `backend/auth.py:get_ws_user`, `backend/main.py:ws_chat` |
| 4 | Chat history lost on refresh | `ChatMessage` DB table, persisted by `ChatEngine.chat()` | `backend/chat_engine.py`, `backend/database.py:ChatMessage` |
| 5 | LLM fallback not implemented | `LLMRouter` with full chain: Ollama → OpenAI → Anthropic → template | `backend/llm_router.py` |
| 6 | API key exposure to frontend | `get_provider_status()` returns only availability + model names, never keys | `backend/llm_router.py:get_provider_status`, `backend/main.py:health` |

### New Features Added

| Feature | Component | Files |
|---------|-----------|-------|
| JWT Authentication + RBAC | LoginScreen, auth.py, rbac.py | 5 backend + 2 frontend |
| Docker Containerized Sandbox | DockerSandbox, Dockerfile.runner | 3 backend |
| Input Validation + Rate Limiting | validation.py, ratelimit.py | 2 backend |
| Centralized Config (.env) | config.py, .env.example | 2 backend |
| Test Generation + Execution | test_engine.py, TestPanel.jsx | 1 backend + 1 frontend |
| Coverage Reporting | docker_sandbox.py:_parse_coverage, TestPanel.jsx | Integrated |
| Vibe Coding (Chat) | chat_engine.py, VibeChat.jsx | 1 backend + 1 frontend |
| Cloud LLM Routing | llm_router.py | 1 backend |
| Skills System | skill_registry.py, SkillMarketplace.jsx | 1 backend + 1 frontend |
| MCP Server | server.py | 1 backend |
| MCP Client | client.py | 1 backend |
| Provenance / SBOM | provenance.py, TrustPanel.jsx | 1 backend + 1 frontend |
| Provider-Aware Model Selector | App.jsx model dropdown | Integrated |

---

## Setup & Installation

### Prerequisites

- Python 3.12+
- Node.js 18+
- Docker Desktop (running)
- Ollama (optional, for AI features)

### Step 1: Backend Setup

```bash
cd V4/backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Edit .env and set JWT_SECRET
```

### Step 2: Build Docker Sandbox Image

```bash
cd V4/backend/sandbox
docker build -t gladme-runner:latest -f Dockerfile.runner .
```

Verify it works:
```bash
docker run --rm gladme-runner:latest python -c "import pytest; print(f'pytest {pytest.__version__}')"
```

### Step 3: Start Backend

```bash
cd V4/backend
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Backend starts at `http://localhost:8001`.

### Step 4: Frontend Setup

```bash
cd V4/frontend
npm install
npm run dev
```

Frontend starts at `http://localhost:5173`.

### Step 5: Create Account

1. Open `http://localhost:5173`
2. Click "Sign Up"
3. Enter email, name, password
4. You're logged in — the studio appears

---

## File Structure

```
V4/
├── backend/
│   ├── main.py                  # FastAPI app — all 25+ endpoints
│   ├── config.py                # Centralized .env configuration
│   ├── auth.py                  # JWT auth + WebSocket auth (Issue #3)
│   ├── rbac.py                  # Role-based access control
│   ├── database.py              # SQLAlchemy ORM — 9 models (incl. User, ChatMessage)
│   ├── verifier.py              # FSM verification engine (upgraded for tests phase)
│   ├── test_engine.py           # Test generation via LLM
│   ├── chat_engine.py           # Chat engine with DB persistence (Issue #4)
│   ├── llm_router.py            # Full fallback chain (Issue #5, #6)
│   ├── requirements.txt
│   ├── .env.example
│   ├── sandbox/
│   │   ├── __init__.py
│   │   ├── docker_sandbox.py    # Docker + subprocess sandbox (Issues #1, #2)
│   │   ├── Dockerfile.runner    # Custom image with pytest (Issue #1)
│   │   └── sandbox_config.py
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── validation.py        # Input sanitization + length checks
│   │   └── ratelimit.py         # Per-IP rate limiting
│   ├── skills/
│   │   ├── __init__.py
│   │   ├── skill_registry.py    # Skill CRUD + execution
│   │   └── builtin/
│   │       ├── __init__.py
│   │       ├── generate_tests/
│   │       ├── generate_docs/
│   │       ├── security_scan/
│   │       └── generate_dockerfile/
│   ├── mcp/
│   │   ├── __init__.py
│   │   ├── server.py            # MCP tool definitions
│   │   └── client.py            # External MCP connections
│   └── provenance/
│       ├── __init__.py
│       └── provenance.py        # SBOM + artifact hashing + compliance
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # Root shell with auth gate
│       ├── index.css            # Design system (from V3)
│       ├── services/
│       │   └── api.js           # All API calls with JWT + Issue #6 fix
│       └── components/
│           ├── LoginScreen.jsx  # NEW: Auth UI
│           ├── Sidebar.jsx      # UPDATED: Skills, Trust, Logout
│           ├── PhaseStepper.jsx # From V3
│           ├── VisualWorkflow.jsx # From V3
│           ├── Workspace.jsx    # From V3
│           ├── MonitoringPanel.jsx # From V3
│           ├── EvolutionPanel.jsx  # From V3
│           ├── ArchitectureTable.jsx # From V3
│           ├── ActivityLog.jsx  # From V3
│           ├── TestPanel.jsx    # NEW: Test + Coverage UI
│           ├── VibeChat.jsx     # NEW: Chat interface
│           ├── SkillMarketplace.jsx # NEW: Skill browser
│           └── TrustPanel.jsx   # NEW: Compliance + SBOM
```

---

## API Endpoints (V4)

### Authentication
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/me` | Yes | Get current user |

### System
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Health + provider status (no keys) |

### Projects
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/projects` | Yes | List user's projects |
| POST | `/api/projects` | Yes | Create project |
| DELETE | `/api/projects/:id` | Yes | Delete project + all data |
| GET | `/api/projects/:id/state` | Yes | Get project state |
| PUT | `/api/projects/:id/state` | Yes | Update state + hash artifacts |
| GET | `/api/projects/:id/export` | Yes | Export as ZIP |
| GET | `/api/projects/:id/sbom` | Yes | Get SBOM |
| GET | `/api/projects/:id/compliance` | Yes | Get compliance report |
| GET | `/api/projects/:id/versions` | Yes | List versions |
| POST | `/api/projects/:id/versions` | Yes | Create version snapshot |
| GET | `/api/projects/:id/versions/:vid` | Yes | Get version detail |

### AI Generation
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/generate/plan` | Yes | Generate plan (with fallback) |
| POST | `/api/generate/code` | Yes | Generate code (with fallback) |
| POST | `/api/generate/evolution` | Yes | Evolution suggestions (with fallback) |
| POST | `/api/generate/tests` | Yes | Generate test cases (with fallback) |

### Verification & Execution
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/verify` | Yes | FSM verification (now checks tests) |
| POST | `/api/execute` | Yes | Run code in Docker sandbox |
| POST | `/api/execute/tests` | Yes | Run tests in Docker + coverage |

### Chat
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/chat` | Yes | Send chat message (persisted) |
| GET | `/api/chat/history/:id` | Yes | Get chat history |
| DELETE | `/api/chat/history/:id` | Yes | Clear chat history |
| WS | `/ws/chat?token=X` | Query param | Streaming chat (Issue #3) |
| WS | `/ws/execute?token=X` | Query param | Streaming execution (Issue #3) |

### Skills
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/skills` | Yes | List all skills |
| GET | `/api/skills/:name` | Yes | Get skill manifest |
| POST | `/api/skills/install` | Yes | Install custom skill |
| DELETE | `/api/skills/:name` | Yes | Uninstall skill |
| POST | `/api/skills/execute` | Yes | Execute a skill |

### MCP
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/mcp/tools` | Yes | List GladME MCP tools |
| GET | `/api/mcp/resources` | Yes | List GladME MCP resources |
| GET | `/api/mcp/servers` | Yes | List external MCP servers |
| GET | `/api/mcp/servers/:name/tools` | Yes | List external server tools |
| POST | `/api/mcp/call` | Yes | Call external MCP tool |

### Logs
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/logs` | Yes | Get activity logs |
| POST | `/api/logs` | Yes | Create log entry |

---

## Walkthrough: Using GladME Studio V4

### 1. Login
Open `http://localhost:5173`. You see the Login screen. Create an account or sign in.

### 2. Create a Project
Click "+" in the sidebar. Type "Inventory Management API" and press Enter.

### 3. Define Goal & Logic
In the Workspace, type:
- **Goal**: "Build a REST API for inventory management with CRUD operations, input validation, and error handling"
- **Logic**: "Input → Validate → Store → Respond. Endpoints: GET /items, POST /items, PUT /items/:id, DELETE /items/:id"

### 4. Generate Plan
Click "Generate Plan". The AI creates a structured plan with architecture, modules, data flow, and steps.

### 5. Generate Code
Click "Generate Code". The AI produces a Python implementation.

### 6. Run Code
Click "Run Code" in the Execution Output panel. The code runs in a Docker container (no subprocess on host).

### 7. Generate & Run Tests
Click "Generate Tests" in the Test Panel. Then click "Run Tests". Tests execute in Docker with pytest pre-installed (Issue #1 fix). Coverage paths are mapped correctly (Issue #2 fix).

### 8. Vibe Coding
Switch to the Vibe Chat panel at the bottom. Type "Add a search endpoint that filters items by name". The AI responds with code. Chat history persists across page refreshes (Issue #4 fix).

### 9. Verify
Click "Run Workflow Verification" to check the FSM lifecycle. Now also validates that tests exist.

### 10. Save Version
Click "Save Version" to create an immutable snapshot.

### 11. Run Skills
Click "Skills" in the sidebar. Run:
- **security-scan**: Checks for SQL injection, hardcoded secrets
- **generate-docs**: Creates README + API docs
- **generate-dockerfile**: Creates Docker configuration

### 12. Check Trust & Provenance
Click "Trust" in the sidebar. See:
- Compliance report (8 checks, trust score)
- SBOM with artifact hashes
- LLM provenance (which model + provider was used)

### 13. Model Provider Switching
In the top bar, the model dropdown shows all available providers:
- `gemma4:latest (ollama)` — local
- `gpt-4o-mini (openai)` — if API key set
- `claude-3-5-sonnet (anthropic)` — if API key set

If Ollama goes offline, the system automatically falls back to the next available provider (Issue #5 fix). API keys are never sent to the frontend (Issue #6 fix).

### 14. Export
Click "Export ZIP" to download the project with all artifacts including `test_main.py`.

---

## Database Schema (V4)

```
users           — id, email, name, password_hash, role, created_at
sessions        — id, user_id, token, expires_at, created_at
projects        — id, title, owner_id, created_at, current_phase
project_states  — id, project_id, goal, logic, plan, code, evolution, tests, current_phase, updated_at
project_versions — id, project_id, version_number, goal, logic, plan, code, evolution, tests, current_phase, created_at
activity_logs   — id, project_id, action, module, result, timestamp
chat_messages   — id, project_id, role, content, timestamp          (NEW - Issue #4)
installed_skills — id, name, version, category, manifest_json, installed_at
artifact_hashes — id, project_id, phase, hash_sha256, computed_at   (NEW - Provenance)
```

---

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | required | Token signing key |
| `DATABASE_URL` | sqlite:///./gladme_v4.db | Database connection |
| `OLLAMA_BASE_URL` | http://localhost:11434 | Ollama service URL |
| `DEFAULT_MODEL` | gemma4:latest | Default AI model |
| `CORS_ORIGINS` | http://localhost:5173 | Allowed origins |
| `SANDBOX_TYPE` | docker | "docker" or "subprocess" |
| `RATE_LIMIT_PER_MINUTE` | 30 | API rate limit |
| `OPENAI_API_KEY` | empty | Optional cloud LLM |
| `ANTHROPIC_API_KEY` | empty | Optional cloud LLM |
| `MCP_SERVERS` | empty | External MCP servers |

---

## What's Next (V5 Roadmap)

1. **Streaming AI Generation** — SSE/WebSocket token streaming
2. **VS Code Extension** — Full MCP client extension
3. **Tauri Desktop App** — Native wrapper
4. **CLI Tool** — `gladme init`, `gladme plan`, `gladme code`
5. **Alembic Migrations** — Schema versioning
6. **Collaborative Mode** — CRDT-based multi-user editing



# GladME Studio V4 — Complete Walkthrough
> Version 4.0.0 | April 2026
---
## What Changed from V3 to V4
### 6 Issues Fixed
| # | Issue | Fix | File |
|---|-------|-----|------|
| 1 | Docker sandbox missing pytest | Custom `Dockerfile.runner` pre-installs pytest, pytest-cov, pytest-json-report | `backend/sandbox/Dockerfile.runner` |
| 2 | Coverage paths inside container | `_parse_coverage()` rewrites `/workspace/` → project-relative paths | `backend/sandbox/docker_sandbox.py:_parse_coverage` |
| 3 | WebSocket doesn't support Depends() | Auth via query param `?token=<jwt>` using `get_ws_user()` | `backend/auth.py:get_ws_user`, `backend/main.py:ws_chat` |
| 4 | Chat history lost on refresh | `ChatMessage` DB table, persisted by `ChatEngine.chat()` | `backend/chat_engine.py`, `backend/database.py:ChatMessage` |
| 5 | LLM fallback not implemented | `LLMRouter` with full chain: Ollama → OpenAI → Anthropic → template | `backend/llm_router.py` |
| 6 | API key exposure to frontend | `get_provider_status()` returns only availability + model names, never keys | `backend/llm_router.py:get_provider_status`, `backend/main.py:health` |
### New Features Added
| Feature | Component | Files |
|---------|-----------|-------|
| JWT Authentication + RBAC | LoginScreen, auth.py, rbac.py | 5 backend + 2 frontend |
| Docker Containerized Sandbox | DockerSandbox, Dockerfile.runner | 3 backend |
| Input Validation + Rate Limiting | validation.py, ratelimit.py | 2 backend |
| Centralized Config (.env) | config.py, .env.example | 2 backend |
| Test Generation + Execution | test_engine.py, TestPanel.jsx | 1 backend + 1 frontend |
| Coverage Reporting | docker_sandbox.py:_parse_coverage, TestPanel.jsx | Integrated |
| Vibe Coding (Chat) | chat_engine.py, VibeChat.jsx | 1 backend + 1 frontend |
| Cloud LLM Routing | llm_router.py | 1 backend |
| Skills System | skill_registry.py, SkillMarketplace.jsx | 1 backend + 1 frontend |
| MCP Server | server.py | 1 backend |
| MCP Client | client.py | 1 backend |
| Provenance / SBOM | provenance.py, TrustPanel.jsx | 1 backend + 1 frontend |
| Provider-Aware Model Selector | App.jsx model dropdown | Integrated |
---
## Setup & Installation
### Prerequisites
- Python 3.12+
- Node.js 18+
- Docker Desktop (running)
- Ollama (optional, for AI features)
### Step 1: Backend Setup
```bash
cd V4/backend
# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac
# Install dependencies
pip install -r requirements.txt
# Create .env from template
cp .env.example .env
# Edit .env and set JWT_SECRET
```
### Step 2: Build Docker Sandbox Image
```bash
cd V4/backend/sandbox
docker build -t gladme-runner:latest -f Dockerfile.runner .
```
Verify it works:
```bash
docker run --rm gladme-runner:latest python -c "import pytest; print(f'pytest {pytest.__version__}')"
```
### Step 3: Start Backend
```bash
cd cd..
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```
Backend starts at `http://localhost:8001`.
### Step 4: Frontend Setup
```bash
cd V4/frontend
npm install
npm run dev
```
Frontend starts at `http://localhost:5173`.
### Step 5: Create Account
1. Open `http://localhost:5173`
2. Click "Sign Up"
3. Enter email, name, password
4. You're logged in — the studio appears
---
## File Structure
```
V4/
├── backend/
│   ├── main.py                  # FastAPI app — all 25+ endpoints
│   ├── config.py                # Centralized .env configuration
│   ├── auth.py                  # JWT auth + WebSocket auth (Issue #3)
│   ├── rbac.py                  # Role-based access control
│   ├── database.py              # SQLAlchemy ORM — 9 models (incl. User, ChatMessage)
│   ├── verifier.py              # FSM verification engine (upgraded for tests phase)
│   ├── test_engine.py           # Test generation via LLM
│   ├── chat_engine.py           # Chat engine with DB persistence (Issue #4)
│   ├── llm_router.py            # Full fallback chain (Issue #5, #6)
│   ├── requirements.txt
│   ├── .env.example
│   ├── sandbox/
│   │   ├── __init__.py
│   │   ├── docker_sandbox.py    # Docker + subprocess sandbox (Issues #1, #2)
│   │   ├── Dockerfile.runner    # Custom image with pytest (Issue #1)
│   │   └── sandbox_config.py
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── validation.py        # Input sanitization + length checks
│   │   └── ratelimit.py         # Per-IP rate limiting
│   ├── skills/
│   │   ├── __init__.py
│   │   ├── skill_registry.py    # Skill CRUD + execution
│   │   └── builtin/
│   │       ├── __init__.py
│   │       ├── generate_tests/
│   │       ├── generate_docs/
│   │       ├── security_scan/
│   │       └── generate_dockerfile/
│   ├── mcp/
│   │   ├── __init__.py
│   │   ├── server.py            # MCP tool definitions
│   │   └── client.py            # External MCP connections
│   └── provenance/
│       ├── __init__.py
│       └── provenance.py        # SBOM + artifact hashing + compliance
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # Root shell with auth gate
│       ├── index.css            # Design system (from V3)
│       ├── services/
│       │   └── api.js           # All API calls with JWT + Issue #6 fix
│       └── components/
│           ├── LoginScreen.jsx  # NEW: Auth UI
│           ├── Sidebar.jsx      # UPDATED: Skills, Trust, Logout
│           ├── PhaseStepper.jsx # From V3
│           ├── VisualWorkflow.jsx # From V3
│           ├── Workspace.jsx    # From V3
│           ├── MonitoringPanel.jsx # From V3
│           ├── EvolutionPanel.jsx  # From V3
│           ├── ArchitectureTable.jsx # From V3
│           ├── ActivityLog.jsx  # From V3
│           ├── TestPanel.jsx    # NEW: Test + Coverage UI
│           ├── VibeChat.jsx     # NEW: Chat interface
│           ├── SkillMarketplace.jsx # NEW: Skill browser
│           └── TrustPanel.jsx   # NEW: Compliance + SBOM
```
---
## API Endpoints (V4)
### Authentication
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/me` | Yes | Get current user |
### System
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Health + provider status (no keys) |
### Projects
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/projects` | Yes | List user's projects |
| POST | `/api/projects` | Yes | Create project |
| DELETE | `/api/projects/:id` | Yes | Delete project + all data |
| GET | `/api/projects/:id/state` | Yes | Get project state |
| PUT | `/api/projects/:id/state` | Yes | Update state + hash artifacts |
| GET | `/api/projects/:id/export` | Yes | Export as ZIP |
| GET | `/api/projects/:id/sbom` | Yes | Get SBOM |
| GET | `/api/projects/:id/compliance` | Yes | Get compliance report |
| GET | `/api/projects/:id/versions` | Yes | List versions |
| POST | `/api/projects/:id/versions` | Yes | Create version snapshot |
| GET | `/api/projects/:id/versions/:vid` | Yes | Get version detail |
### AI Generation
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/generate/plan` | Yes | Generate plan (with fallback) |
| POST | `/api/generate/code` | Yes | Generate code (with fallback) |
| POST | `/api/generate/evolution` | Yes | Evolution suggestions (with fallback) |
| POST | `/api/generate/tests` | Yes | Generate test cases (with fallback) |
### Verification & Execution
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/verify` | Yes | FSM verification (now checks tests) |
| POST | `/api/execute` | Yes | Run code in Docker sandbox |
| POST | `/api/execute/tests` | Yes | Run tests in Docker + coverage |
### Chat
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/chat` | Yes | Send chat message (persisted) |
| GET | `/api/chat/history/:id` | Yes | Get chat history |
| DELETE | `/api/chat/history/:id` | Yes | Clear chat history |
| WS | `/ws/chat?token=X` | Query param | Streaming chat (Issue #3) |
| WS | `/ws/execute?token=X` | Query param | Streaming execution (Issue #3) |
### Skills
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/skills` | Yes | List all skills |
| GET | `/api/skills/:name` | Yes | Get skill manifest |
| POST | `/api/skills/install` | Yes | Install custom skill |
| DELETE | `/api/skills/:name` | Yes | Uninstall skill |
| POST | `/api/skills/execute` | Yes | Execute a skill |
### MCP
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/mcp/tools` | Yes | List GladME MCP tools |
| GET | `/api/mcp/resources` | Yes | List GladME MCP resources |
| GET | `/api/mcp/servers` | Yes | List external MCP servers |
| GET | `/api/mcp/servers/:name/tools` | Yes | List external server tools |
| POST | `/api/mcp/call` | Yes | Call external MCP tool |
### Logs
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/logs` | Yes | Get activity logs |
| POST | `/api/logs` | Yes | Create log entry |
---
## Walkthrough: Using GladME Studio V4
### 1. Login
Open `http://localhost:5173`. You see the Login screen. Create an account or sign in.
### 2. Create a Project
Click "+" in the sidebar. Type "Inventory Management API" and press Enter.
### 3. Define Goal & Logic
In the Workspace, type:
- **Goal**: "Build a REST API for inventory management with CRUD operations, input validation, and error handling"
- **Logic**: "Input → Validate → Store → Respond. Endpoints: GET /items, POST /items, PUT /items/:id, DELETE /items/:id"
### 4. Generate Plan
Click "Generate Plan". The AI creates a structured plan with architecture, modules, data flow, and steps.
### 5. Generate Code
Click "Generate Code". The AI produces a Python implementation.
### 6. Run Code
Click "Run Code" in the Execution Output panel. The code runs in a Docker container (no subprocess on host).
### 7. Generate & Run Tests
Click "Generate Tests" in the Test Panel. Then click "Run Tests". Tests execute in Docker with pytest pre-installed (Issue #1 fix). Coverage paths are mapped correctly (Issue #2 fix).
### 8. Vibe Coding
Switch to the Vibe Chat panel at the bottom. Type "Add a search endpoint that filters items by name". The AI responds with code. Chat history persists across page refreshes (Issue #4 fix).
### 9. Verify
Click "Run Workflow Verification" to check the FSM lifecycle. Now also validates that tests exist.
### 10. Save Version
Click "Save Version" to create an immutable snapshot.
### 11. Run Skills
Click "Skills" in the sidebar. Run:
- **security-scan**: Checks for SQL injection, hardcoded secrets
- **generate-docs**: Creates README + API docs
- **generate-dockerfile**: Creates Docker configuration
### 12. Check Trust & Provenance
Click "Trust" in the sidebar. See:
- Compliance report (8 checks, trust score)
- SBOM with artifact hashes
- LLM provenance (which model + provider was used)
### 13. Model Provider Switching
In the top bar, the model dropdown shows all available providers:
- `gemma4:latest (ollama)` — local
- `gpt-4o-mini (openai)` — if API key set
- `claude-3-5-sonnet (anthropic)` — if API key set
If Ollama goes offline, the system automatically falls back to the next available provider (Issue #5 fix). API keys are never sent to the frontend (Issue #6 fix).
### 14. Export
Click "Export ZIP" to download the project with all artifacts including `test_main.py`.
---
## Database Schema (V4)
```
users           — id, email, name, password_hash, role, created_at
sessions        — id, user_id, token, expires_at, created_at
projects        — id, title, owner_id, created_at, current_phase
project_states  — id, project_id, goal, logic, plan, code, evolution, tests, current_phase, updated_at
project_versions — id, project_id, version_number, goal, logic, plan, code, evolution, tests, current_phase, created_at
activity_logs   — id, project_id, action, module, result, timestamp
chat_messages   — id, project_id, role, content, timestamp          (NEW - Issue #4)
installed_skills — id, name, version, category, manifest_json, installed_at
artifact_hashes — id, project_id, phase, hash_sha256, computed_at   (NEW - Provenance)
```
---
## Configuration Reference
| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | required | Token signing key |
| `DATABASE_URL` | sqlite:///./gladme_v4.db | Database connection |
| `OLLAMA_BASE_URL` | http://localhost:11434 | Ollama service URL |
| `DEFAULT_MODEL` | gemma4:latest | Default AI model |
| `CORS_ORIGINS` | http://localhost:5173 | Allowed origins |
| `SANDBOX_TYPE` | docker | "docker" or "subprocess" |
| `RATE_LIMIT_PER_MINUTE` | 30 | API rate limit |
| `OPENAI_API_KEY` | empty | Optional cloud LLM |
| `ANTHROPIC_API_KEY` | empty | Optional cloud LLM |
| `MCP_SERVERS` | empty | External MCP servers |
---
## What's Next (V5 Roadmap)
1. **Streaming AI Generation** — SSE/WebSocket token streaming
2. **VS Code Extension** — Full MCP client extension
3. **Tauri Desktop App** — Native wrapper
4. **CLI Tool** — `gladme init`, `gladme plan`, `gladme code`
5. **Alembic Migrations** — Schema versioning
6. **Collaborative Mode** — CRDT-based multi-user editing


- Email: dev@gladme.dev
- Password: GladME@2026
