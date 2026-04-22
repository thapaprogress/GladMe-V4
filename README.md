# GladME Studio V4 🚀

**The Next Generation Agentic IDE for Intelligent Software Engineering**

GladME Studio V4 is a high-fidelity, production-ready Agentic Integrated Development Environment. It automates the software development lifecycle by integrating multi-modal AI agents with a secure, containerized execution environment.

![GladME Studio V4 Banner](https://raw.githubusercontent.com/thapaprogress/GladMe-V4/main/screenshots/banner.png)

## 🌟 What's New in V4?

V4 is a major evolution from previous versions, focusing on **Security**, **Reliability**, and **Developer Productivity**.

*   **JWT Authentication & RBAC:** Secure project access with role-based permissions.
*   **Docker Containerized Sandbox:** Safe code execution in isolated environments (Pytest + Coverage integrated).
*   **LLM Fallback Routing:** Intelligent routing between Ollama, OpenAI, and Anthropic to ensure zero downtime.
*   **Vibe Coding (Chat):** Persistent chat interface for real-time code evolution.
*   **MCP Support:** Native integration with the Model Context Protocol (Server & Client).
*   **Trust & Provenance:** Automated SBOM generation and artifact hashing for compliance.

## 🏗️ Architecture

GladME V4 follows a modern client-server architecture:

*   **Backend:** FastAPI (Python 3.12+) with SQLAlchemy ORM and Docker SDK.
*   **Frontend:** Vite + React 18 with Monaco Editor, React Flow, and Recharts.
*   **Intelligence:** Multi-provider LLM Router (Ollama, OpenAI, Anthropic).

## 🚀 Quick Start

### Prerequisites

*   [Python 3.12+](https://www.python.org/downloads/)
*   [Node.js 18+](https://nodejs.org/)
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Running)
*   [Ollama](https://ollama.com/) (Optional, for local AI)

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

pip install -r requirements.txt
cp .env.example .env
# Edit .env and set your JWT_SECRET and API Keys
```

### 2. Build Docker Runner

```bash
cd backend/sandbox
docker build -t gladme-runner:latest -f Dockerfile.runner .
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Launch

Run both servers and visit `http://localhost:5173`.

## 📸 Screenshots

| Dashboard | Visual Workflow |
| :---: | :---: |
| ![Dashboard](https://raw.githubusercontent.com/thapaprogress/GladMe-V4/main/screenshots/dashboard.png) | ![Workflow](https://raw.githubusercontent.com/thapaprogress/GladMe-V4/main/screenshots/workflow.png) |

| Vibe Chat | Trust & Provenance |
| :---: | :---: |
| ![Chat](https://raw.githubusercontent.com/thapaprogress/GladMe-V4/main/screenshots/chat.png) | ![Trust](https://raw.githubusercontent.com/thapaprogress/GladMe-V4/main/screenshots/trust.png) |

## 🛠️ Tech Stack

*   **Frameworks:** FastAPI, React (Vite)
*   **UI Components:** Tailwind CSS, Framer Motion
*   **Editor:** Monaco Editor
*   **Diagrams:** React Flow
*   **Database:** SQLite / PostgreSQL (via SQLAlchemy)
*   **Containerization:** Docker

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by the GladME Team.
