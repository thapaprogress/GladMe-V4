"""
GladME Studio V4 — Main FastAPI Application
All endpoints, WebSocket handlers, with fixes for Issues #1-6.
"""

from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from string import Template
import asyncio
import io
import json
import zipfile

from config import settings
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_ws_user,
)
from database import (
    get_db, SessionLocal,
    User, Session as SessionModel, Project, ProjectState, ProjectVersion,
    ActivityLog, ChatMessage, InstalledSkill, ArtifactHash,
)
from sandbox.docker_sandbox import get_sandbox
from middleware.validation import sanitize_input, validate_project_data
from middleware.ratelimit import limiter
from llm_router import llm_router
from verifier import verify_project_state
from test_engine import generate_tests
from chat_engine import ChatEngine
from skills.skill_registry import (
    get_all_skills, get_skill, execute_skill, install_skill, uninstall_skill,
)
from mcp.server import get_mcp_tools_list, get_mcp_resources_list
from mcp.client import mcp_client
from provenance.provenance import (
    store_artifact_hash, verify_artifact_integrity,
    generate_sbom, generate_compliance_report,
)

app = FastAPI(title="GladME Studio V4", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.state.limiter = limiter


# ══════════════════════════════════════════════
# Pydantic Schemas
# ══════════════════════════════════════════════

class AuthRegister(BaseModel):
    email: str
    password: str
    name: str

class AuthLogin(BaseModel):
    email: str
    password: str

class ProjectCreate(BaseModel):
    title: str

class ProjectStateUpdate(BaseModel):
    goal: Optional[str] = ""
    logic: Optional[str] = ""
    plan: Optional[str] = ""
    code: Optional[str] = ""
    evolution: Optional[str] = ""
    tests: Optional[str] = ""
    current_phase: Optional[str] = "Goal"

class GenerateRequest(BaseModel):
    goal: str
    logic: str
    plan: Optional[str] = ""
    code: Optional[str] = ""
    model: Optional[str] = "gemma4:latest"
    provider: Optional[str] = None

class VerifyRequest(BaseModel):
    goal: str = ""
    logic: str = ""
    plan: str = ""
    code: str = ""
    tests: str = ""

class ExecuteRequest(BaseModel):
    code: str
    timeout: Optional[int] = 30

class ExecuteTestsRequest(BaseModel):
    code: str
    tests: str
    timeout: Optional[int] = 45

class ChatRequest(BaseModel):
    message: str
    goal: Optional[str] = ""
    logic: Optional[str] = ""
    plan: Optional[str] = ""
    code: Optional[str] = ""
    model: Optional[str] = "gemma4:latest"
    provider: Optional[str] = None

class LogCreate(BaseModel):
    project_id: Optional[int] = None
    action: str
    module: Optional[str] = "System"
    result: Optional[str] = "OK"

class SkillInstallRequest(BaseModel):
    manifest_json: str

class SkillExecuteRequest(BaseModel):
    skill_name: str
    project_state: dict
    model: Optional[str] = "gemma4:latest"
    provider: Optional[str] = None

class MCPCallRequest(BaseModel):
    server_name: str
    tool_name: str
    arguments: dict


# ══════════════════════════════════════════════
# Auth Endpoints
# ══════════════════════════════════════════════

@app.post("/api/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, data: AuthRegister):
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")
        user = User(
            email=data.email,
            name=data.name,
            password_hash=hash_password(data.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(user.id, user.role)
        return {"user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}, "token": token}
    finally:
        db.close()


@app.post("/api/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, data: AuthLogin):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == data.email).first()
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_access_token(user.id, user.role)
        return {"user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}, "token": token}
    finally:
        db.close()


@app.get("/api/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ══════════════════════════════════════════════
# System / Health — Issue #6 FIX: no API keys exposed
# ══════════════════════════════════════════════

@app.get("/api/health")
async def health():
    provider_status = await llm_router.get_provider_status()
    return {
        "status": "ok",
        "version": "4.0.0",
        "providers": provider_status,
    }


# ══════════════════════════════════════════════
# Project CRUD (auth-protected)
# ══════════════════════════════════════════════

@app.get("/api/projects")
def get_projects(user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        projects = db.query(Project).filter(Project.owner_id == user["id"]).order_by(Project.created_at.desc()).all()
        return [
            {"id": p.id, "title": p.title, "currentPhase": p.current_phase,
             "createdAt": p.created_at.isoformat() if p.created_at else None}
            for p in projects
        ]
    finally:
        db.close()


@app.post("/api/projects")
def create_project(data: ProjectCreate, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        project = Project(title=data.title, owner_id=user["id"])
        db.add(project)
        db.commit()
        db.refresh(project)
        state = ProjectState(project_id=project.id)
        db.add(state)
        log = ActivityLog(project_id=project.id, action=f"Project '{data.title}' created", module="ProjectManager")
        db.add(log)
        db.commit()
        return {"id": project.id, "title": project.title, "currentPhase": project.current_phase}
    finally:
        db.close()


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id, Project.owner_id == user["id"]).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        db.query(ProjectState).filter(ProjectState.project_id == project_id).delete()
        db.query(ProjectVersion).filter(ProjectVersion.project_id == project_id).delete()
        db.query(ActivityLog).filter(ActivityLog.project_id == project_id).delete()
        db.query(ChatMessage).filter(ChatMessage.project_id == project_id).delete()
        db.query(ArtifactHash).filter(ArtifactHash.project_id == project_id).delete()
        db.delete(project)
        db.commit()
        return {"status": "deleted", "id": project_id}
    finally:
        db.close()


# ══════════════════════════════════════════════
# Project State
# ══════════════════════════════════════════════

def _verify_project_owner(project_id: int, user: dict, db):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == user["id"]).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.get("/api/projects/{project_id}/state")
def get_project_state(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
        state = db.query(ProjectState).filter(ProjectState.project_id == project_id).first()
        if not state:
            return {"goal": "", "logic": "", "plan": "", "code": "", "evolution": "", "tests": "", "currentPhase": "Goal"}
        return {
            "goal": state.goal or "", "logic": state.logic or "",
            "plan": state.plan or "", "code": state.code or "",
            "evolution": state.evolution or "", "tests": state.tests or "",
            "currentPhase": state.current_phase or "Goal",
        }
    finally:
        db.close()


@app.put("/api/projects/{project_id}/state")
def update_project_state(project_id: int, data: ProjectStateUpdate, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
        errors = validate_project_data(data.dict())
        if errors:
            raise HTTPException(status_code=422, detail=errors)

        state = db.query(ProjectState).filter(ProjectState.project_id == project_id).first()
        if not state:
            state = ProjectState(project_id=project_id)
            db.add(state)

        state.goal = sanitize_input(data.goal)
        state.logic = sanitize_input(data.logic)
        state.plan = sanitize_input(data.plan)
        state.code = sanitize_input(data.code)
        state.evolution = sanitize_input(data.evolution)
        state.tests = sanitize_input(data.tests)
        state.current_phase = sanitize_input(data.current_phase)
        state.updated_at = datetime.now(timezone.utc)

        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            project.current_phase = data.current_phase

        for phase_name, content in [("goal", data.goal), ("logic", data.logic),
                                     ("plan", data.plan), ("code", data.code),
                                     ("tests", data.tests)]:
            if content and content.strip():
                store_artifact_hash(project_id, phase_name, content)

        db.commit()
        return {"status": "saved"}
    finally:
        db.close()


# ══════════════════════════════════════════════
# AI Generation — Issue #5 FIX: Full fallback chain
# ══════════════════════════════════════════════

PLAN_PROMPT = Template("""You are an expert software architect using the GladME framework.
Given the following Goal and Logic, generate a detailed, structured development plan.

## Goal
$goal

## Logic
$logic

Create a plan with: Architecture Overview, Module Breakdown, Data Flow, Implementation Steps, Tech Stack, Risk Assessment.
Be specific, actionable, and thorough. Format with markdown.""")

CODE_PROMPT = Template("""You are an expert software developer using the GladME framework.
Given the Goal, Logic, and Plan below, generate production-quality Python code.

## Goal
$goal

## Logic
$logic

## Plan
$plan

Include: imports, classes with docstrings, main entry point, error handling, type hints.
Output ONLY Python code, no explanations.""")

EVOLUTION_PROMPT = Template("""You are the Evolution Agent in the GladME framework.
Analyze the current project and suggest improvements.

## Goal
$goal

## Logic
$logic

## Plan Summary
$plan

## Code Summary
$code

Suggest: Performance Improvements, Architecture Refinements, New Features, Bug Prevention, Next Evolution Note.
Be concise and actionable.""")


@app.post("/api/generate/plan")
@limiter.limit("15/minute")
async def api_generate_plan(request: Request, data: GenerateRequest, user=Depends(get_current_user)):
    prompt = PLAN_PROMPT.safe_substitute(goal=data.goal, logic=data.logic)
    result, provider = await llm_router.generate(prompt, data.model, data.provider)
    return {"plan": result, "model": data.model, "provider": provider}


@app.post("/api/generate/code")
@limiter.limit("15/minute")
async def api_generate_code(request: Request, data: GenerateRequest, user=Depends(get_current_user)):
    prompt = CODE_PROMPT.safe_substitute(goal=data.goal, logic=data.logic, plan=data.plan)
    result, provider = await llm_router.generate(prompt, data.model, data.provider)
    return {"code": result, "model": data.model, "provider": provider}


@app.post("/api/generate/evolution")
@limiter.limit("15/minute")
async def api_suggest_evolution(request: Request, data: GenerateRequest, user=Depends(get_current_user)):
    prompt = EVOLUTION_PROMPT.safe_substitute(
        goal=data.goal, logic=data.logic,
        plan=data.plan[:1000], code=data.code[:1000],
    )
    result, provider = await llm_router.generate(prompt, data.model, data.provider)
    return {"suggestions": result, "model": data.model, "provider": provider}


@app.post("/api/generate/tests")
@limiter.limit("15/minute")
async def api_generate_tests(request: Request, data: GenerateRequest, user=Depends(get_current_user)):
    result, provider = await generate_tests(
        data.goal, data.logic, data.plan, data.code, data.model, data.provider,
    )
    return {"tests": result, "model": data.model, "provider": provider}


# ══════════════════════════════════════════════
# Verification
# ══════════════════════════════════════════════

@app.post("/api/verify")
async def api_verify(data: VerifyRequest, user=Depends(get_current_user)):
    return verify_project_state(data.goal, data.logic, data.plan, data.code, data.tests)


# ══════════════════════════════════════════════
# Code Execution — Issue #1 FIX: Docker sandbox with pytest
# ══════════════════════════════════════════════

@app.post("/api/execute")
async def execute_code(data: ExecuteRequest, user=Depends(get_current_user)):
    sandbox = get_sandbox()
    return await sandbox.execute(data.code, data.timeout)


@app.post("/api/execute/tests")
async def execute_tests(data: ExecuteTestsRequest, user=Depends(get_current_user)):
    sandbox = get_sandbox()
    if hasattr(sandbox, "execute_tests"):
        return await sandbox.execute_tests(data.code, data.tests, data.timeout)
    return {"stdout": "", "stderr": "Test execution requires Docker sandbox", "exit_code": -1, "status": "error",
            "test_results": None, "coverage": None}


# ══════════════════════════════════════════════
# Chat — Issue #3 FIX: WebSocket auth via query param
# ══════════════════════════════════════════════

@app.post("/api/chat")
async def api_chat(data: ChatRequest, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.owner_id == user["id"]).order_by(Project.id.desc()).first()
        project_id = project.id if project else 0
    finally:
        db.close()

    if project_id == 0:
        raise HTTPException(status_code=400, detail="No project found. Create a project first.")

    engine = ChatEngine(project_id)
    response, provider = await engine.chat(
        data.message, data.goal, data.logic, data.plan, data.code, data.model, data.provider,
    )
    return {"response": response, "provider": provider}


@app.get("/api/chat/history/{project_id}")
async def api_chat_history(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
    finally:
        db.close()
    engine = ChatEngine(project_id)
    return {"messages": engine.get_history()}


@app.delete("/api/chat/history/{project_id}")
async def api_chat_clear(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
    finally:
        db.close()
    engine = ChatEngine(project_id)
    engine.clear_history()
    return {"status": "cleared"}


@app.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket, token: str = Query(default="")):
    """
    Issue #3 FIX: WebSocket authentication via query parameter token.
    Example: ws://localhost:8001/ws/chat?token=<jwt_token>
    """
    user = await get_ws_user(token)
    if not user:
        await websocket.close(code=4001, reason="Authentication required")
        return

    await websocket.accept()
    project_id = 0

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue
            user_msg = payload.get("message", "")
            goal = payload.get("goal", "")
            logic = payload.get("logic", "")
            plan = payload.get("plan", "")
            code = payload.get("code", "")
            model = payload.get("model", "gemma4:latest")
            provider = payload.get("provider")

            pid = payload.get("projectId", 0)
            if pid:
                db_check = SessionLocal()
                try:
                    own = db_check.query(Project).filter(Project.id == pid, Project.owner_id == user["id"]).first()
                    if not own:
                        await websocket.send_json({"type": "error", "message": "Project not found"})
                        continue
                finally:
                    db_check.close()
                project_id = pid

            engine = ChatEngine(project_id)
            response, used_provider = await engine.chat(
                user_msg, goal, logic, plan, code, model, provider,
            )

            await websocket.send_json({
                "type": "message",
                "content": response,
                "provider": used_provider,
            })
            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        pass


@app.websocket("/ws/execute")
async def ws_execute(websocket: WebSocket, token: str = Query(default="")):
    """
    Issue #3 FIX: WebSocket auth via query param.
    """
    user = await get_ws_user(token)
    if not user:
        await websocket.close(code=4001, reason="Authentication required")
        return

    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue
            code = payload.get("code", "")

            sandbox = get_sandbox()
            result = await sandbox.execute(code, timeout=15)
            await websocket.send_json({
                "type": "result",
                "stdout": result.get("stdout", ""),
                "stderr": result.get("stderr", ""),
                "exit_code": result.get("exit_code", -1),
                "status": result.get("status", "error"),
            })
    except WebSocketDisconnect:
        pass


# ══════════════════════════════════════════════
# Versions
# ══════════════════════════════════════════════

@app.get("/api/projects/{project_id}/versions")
def get_versions(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
        versions = db.query(ProjectVersion).filter(
            ProjectVersion.project_id == project_id,
        ).order_by(ProjectVersion.version_number.desc()).all()
        return [
            {"id": v.id, "versionNumber": v.version_number, "currentPhase": v.current_phase,
             "evolution": v.evolution, "createdAt": v.created_at.isoformat() if v.created_at else None}
            for v in versions
        ]
    finally:
        db.close()


@app.post("/api/projects/{project_id}/versions")
def create_version(project_id: int, data: ProjectStateUpdate, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
        latest = db.query(ProjectVersion).filter(
            ProjectVersion.project_id == project_id,
        ).order_by(ProjectVersion.version_number.desc()).first()
        next_num = (latest.version_number + 1) if latest else 1

        version = ProjectVersion(
            project_id=project_id, version_number=next_num,
            goal=data.goal, logic=data.logic, plan=data.plan,
            code=data.code, evolution=data.evolution, tests=data.tests,
            current_phase=data.current_phase,
        )
        db.add(version)
        log = ActivityLog(project_id=project_id, action=f"Version v{next_num} saved",
                          module="EvolutionEngine", result="Success")
        db.add(log)
        db.commit()
        db.refresh(version)
        return {"id": version.id, "versionNumber": next_num}
    finally:
        db.close()


@app.get("/api/projects/{project_id}/versions/{version_id}")
def get_version_detail(project_id: int, version_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        _verify_project_owner(project_id, user, db)
        v = db.query(ProjectVersion).filter(
            ProjectVersion.project_id == project_id,
            ProjectVersion.id == version_id,
        ).first()
        if not v:
            raise HTTPException(status_code=404, detail="Version not found")
        return {
            "id": v.id, "versionNumber": v.version_number,
            "goal": v.goal, "logic": v.logic, "plan": v.plan,
            "code": v.code, "evolution": v.evolution, "tests": v.tests,
            "currentPhase": v.current_phase,
            "createdAt": v.created_at.isoformat() if v.created_at else None,
        }
    finally:
        db.close()


# ══════════════════════════════════════════════
# Activity Logs
# ══════════════════════════════════════════════

@app.get("/api/logs")
def get_logs(project_id: Optional[int] = None, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        query = db.query(ActivityLog).order_by(ActivityLog.timestamp.desc())
        if project_id:
            query = query.filter(ActivityLog.project_id == project_id)
        logs = query.limit(100).all()
        return [
            {"id": l.id, "projectId": l.project_id, "action": l.action,
             "module": l.module, "result": l.result,
             "timestamp": l.timestamp.isoformat() if l.timestamp else None}
            for l in logs
        ]
    finally:
        db.close()


@app.post("/api/logs")
def create_log(data: LogCreate, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        log = ActivityLog(project_id=data.project_id, action=data.action,
                          module=data.module, result=data.result)
        db.add(log)
        db.commit()
        return {"status": "logged"}
    finally:
        db.close()


# ══════════════════════════════════════════════
# Export
# ══════════════════════════════════════════════

@app.get("/api/projects/{project_id}/export")
def export_project(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        project = _verify_project_owner(project_id, user, db)
        state = db.query(ProjectState).filter(ProjectState.project_id == project_id).first()

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("goal.md", f"# Goal\n\n{state.goal if state else ''}")
            z.writestr("logic.md", f"# Logic\n\n{state.logic if state else ''}")
            z.writestr("plan.md", f"# Plan\n\n{state.plan if state else ''}")
            z.writestr("main.py", state.code if state else "# No code generated yet")
            if state and state.tests:
                z.writestr("test_main.py", state.tests)
            z.writestr("evolution.md", f"# Evolution Notes\n\n{state.evolution if state else ''}")
            z.writestr("README.md", f"# {project.title}\n\nGenerated by GladME Studio V4\n\nPhase: {state.current_phase if state else 'Goal'}")
        buf.seek(0)
        return StreamingResponse(
            buf, media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=gladme_{project.title.replace(' ', '_')}.zip"},
        )
    finally:
        db.close()


# ══════════════════════════════════════════════
# Skills Endpoints
# ══════════════════════════════════════════════

@app.get("/api/skills")
def api_list_skills(user=Depends(get_current_user)):
    return get_all_skills()


@app.get("/api/skills/{skill_name}")
def api_get_skill(skill_name: str, user=Depends(get_current_user)):
    skill = get_skill(skill_name)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill.to_dict()


@app.post("/api/skills/install")
def api_install_skill(data: SkillInstallRequest, user=Depends(get_current_user)):
    result = install_skill(data.manifest_json)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.delete("/api/skills/{skill_name}")
def api_uninstall_skill(skill_name: str, user=Depends(get_current_user)):
    result = uninstall_skill(skill_name)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/api/skills/execute")
async def api_execute_skill(data: SkillExecuteRequest, user=Depends(get_current_user)):
    result = await execute_skill(data.skill_name, data.project_state, data.model, data.provider)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ══════════════════════════════════════════════
# MCP Endpoints
# ══════════════════════════════════════════════

@app.get("/api/mcp/tools")
def api_mcp_tools(user=Depends(get_current_user)):
    return get_mcp_tools_list()


@app.get("/api/mcp/resources")
def api_mcp_resources(user=Depends(get_current_user)):
    return get_mcp_resources_list()


@app.get("/api/mcp/servers")
async def api_mcp_servers(user=Depends(get_current_user)):
    return await mcp_client.list_servers()


@app.get("/api/mcp/servers/{server_name}/tools")
async def api_mcp_server_tools(server_name: str, user=Depends(get_current_user)):
    tools = await mcp_client.list_server_tools(server_name)
    return tools


@app.post("/api/mcp/call")
async def api_mcp_call(data: MCPCallRequest, user=Depends(get_current_user)):
    result = await mcp_client.call_tool(data.server_name, data.tool_name, data.arguments)
    return result


# ══════════════════════════════════════════════
# Provenance / SBOM
# ══════════════════════════════════════════════

@app.get("/api/projects/{project_id}/sbom")
def api_sbom(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        project = _verify_project_owner(project_id, user, db)
        state = db.query(ProjectState).filter(ProjectState.project_id == project_id).first()
        if not state:
            raise HTTPException(status_code=400, detail="Project has no state")
        state_dict = {
            "goal": state.goal, "logic": state.logic, "plan": state.plan,
            "code": state.code, "tests": state.tests, "evolution": state.evolution,
        }
        sbom = generate_sbom(project_id, project.title, state_dict, "gemma4:latest", "ollama")
        return sbom
    finally:
        db.close()


@app.get("/api/projects/{project_id}/compliance")
def api_compliance(project_id: int, user=Depends(get_current_user)):
    db = SessionLocal()
    try:
        project = _verify_project_owner(project_id, user, db)
        state = db.query(ProjectState).filter(ProjectState.project_id == project_id).first()
        if not state:
            raise HTTPException(status_code=400, detail="Project has no state")
        state_dict = {
            "goal": state.goal, "logic": state.logic, "plan": state.plan,
            "code": state.code, "tests": state.tests, "evolution": state.evolution,
        }
        verify_result = verify_project_state(state.goal, state.logic, state.plan, state.code, state.tests)
        report = generate_compliance_report(project_id, state_dict, verify_result=verify_result)
        return report
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    # explicitly define port 8000 to match frontend's vite.config.js expectations
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
