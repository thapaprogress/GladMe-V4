/**
 * GladME Studio V4 — API Service Layer
 * Issue #6 FIX: No API keys ever sent to/from frontend.
 * FIX: API base URL now configurable via environment variable.
 */

const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

let authToken = localStorage.getItem("gladme_token") || "";

const setToken = (token) => {
  authToken = token;
  localStorage.setItem("gladme_token", token);
};

const clearToken = () => {
  authToken = "";
  localStorage.removeItem("gladme_token");
};

const headers = () => ({
  "Content-Type": "application/json",
  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
});

const apiFetch = async (url, options = {}) => {
  const res = await fetch(`${BASE}${url}`, { ...options, headers: { ...headers(), ...options.headers } });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent("auth-expired"));
    throw new Error("Authentication required");
  }
  return res;
};

// ── Auth ──
export const register = async (email, password, name) => {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({ email, password, name }),
  });
  const data = await res.json();
  if (data.token) setToken(data.token);
  return data;
};

export const login = async (email, password) => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.token) setToken(data.token);
  return data;
};

export const getMe = async () => {
  const res = await apiFetch("/auth/me");
  return res.json();
};

export const logout = () => clearToken();

export const isLoggedIn = () => !!authToken;

// ── Health ──
export const checkHealth = async () => {
  const res = await fetch(`${BASE}/health`);
  return res.json();
};

// ── Projects ──
export const fetchProjects = async () => {
  const res = await apiFetch("/projects");
  return res.json();
};

export const createProject = async (title) => {
  const res = await apiFetch("/projects", {
    method: "POST", body: JSON.stringify({ title }),
  });
  return res.json();
};

export const deleteProject = async (id) => {
  const res = await apiFetch(`/projects/${id}`, { method: "DELETE" });
  return res.json();
};

// ── State ──
export const fetchProjectState = async (id) => {
  const res = await apiFetch(`/projects/${id}/state`);
  return res.json();
};

export const updateProjectState = async (id, data) => {
  await apiFetch(`/projects/${id}/state`, {
    method: "PUT", body: JSON.stringify(data),
  });
};

// ── AI Generation ──
export const generatePlan = async (goal, logic, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/generate/plan", {
    method: "POST", body: JSON.stringify({ goal, logic, model, provider }),
  });
  return res.json();
};

export const generateCode = async (goal, logic, plan, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/generate/code", {
    method: "POST", body: JSON.stringify({ goal, logic, plan, model, provider }),
  });
  return res.json();
};

export const suggestEvolution = async (goal, logic, plan, code, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/generate/evolution", {
    method: "POST", body: JSON.stringify({ goal, logic, plan, code, model, provider }),
  });
  return res.json();
};

export const generateTests = async (goal, logic, plan, code, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/generate/tests", {
    method: "POST", body: JSON.stringify({ goal, logic, plan, code, model, provider }),
  });
  return res.json();
};

// ── Verification ──
export const verifyProject = async (goal, logic, plan, code, tests = "") => {
  const res = await apiFetch("/verify", {
    method: "POST", body: JSON.stringify({ goal, logic, plan, code, tests }),
  });
  return res.json();
};

// ── Execution ──
export const executeCode = async (code, timeout = 30) => {
  const res = await apiFetch("/execute", {
    method: "POST", body: JSON.stringify({ code, timeout }),
  });
  return res.json();
};

export const executeTests = async (code, tests, timeout = 45) => {
  const res = await apiFetch("/execute/tests", {
    method: "POST", body: JSON.stringify({ code, tests, timeout }),
  });
  return res.json();
};

// ── Chat ──
export const sendChat = async (message, goal, logic, plan, code, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/chat", {
    method: "POST", body: JSON.stringify({ message, goal, logic, plan, code, model, provider }),
  });
  return res.json();
};

export const fetchChatHistory = async (projectId) => {
  const res = await apiFetch(`/chat/history/${projectId}`);
  return res.json();
};

export const clearChatHistory = async (projectId) => {
  const res = await apiFetch(`/chat/history/${projectId}`, { method: "DELETE" });
  return res.json();
};

// ── Versions ──
export const fetchVersions = async (projectId) => {
  const res = await apiFetch(`/projects/${projectId}/versions`);
  return res.json();
};

export const createVersion = async (projectId, data) => {
  const res = await apiFetch(`/projects/${projectId}/versions`, {
    method: "POST", body: JSON.stringify(data),
  });
  return res.json();
};

export const fetchVersionDetail = async (projectId, versionId) => {
  const res = await apiFetch(`/projects/${projectId}/versions/${versionId}`);
  return res.json();
};

// ── Logs ──
export const fetchLogs = async (projectId) => {
  const url = projectId ? `/logs?project_id=${projectId}` : "/logs";
  const res = await apiFetch(url);
  return res.json();
};

export const createLog = async (data) => {
  await apiFetch("/logs", {
    method: "POST", body: JSON.stringify(data),
  });
};

// ── Export ──
export const exportProject = async (projectId) => {
  const res = await apiFetch(`/projects/${projectId}/export`);
  return res.blob();
};

// ── Skills ──
export const fetchSkills = async () => {
  const res = await apiFetch("/skills");
  return res.json();
};

export const executeSkill = async (skillName, projectState, model = "gemma4:latest", provider = null) => {
  const res = await apiFetch("/skills/execute", {
    method: "POST", body: JSON.stringify({ skill_name: skillName, project_state: projectState, model, provider }),
  });
  return res.json();
};

export const installSkill = async (manifestJson) => {
  const res = await apiFetch("/skills/install", {
    method: "POST", body: JSON.stringify({ manifest_json: manifestJson }),
  });
  return res.json();
};

// ── MCP ──
export const fetchMCPServers = async () => {
  const res = await apiFetch("/mcp/servers");
  return res.json();
};

export const fetchMCPTools = async () => {
  const res = await apiFetch("/mcp/tools");
  return res.json();
};

export const callMCPTool = async (serverName, toolName, arguments_) => {
  const res = await apiFetch("/mcp/call", {
    method: "POST", body: JSON.stringify({ server_name: serverName, tool_name: toolName, arguments: arguments_ }),
  });
  return res.json();
};

// ── Provenance ──
export const fetchSBOM = async (projectId) => {
  const res = await apiFetch(`/projects/${projectId}/sbom`);
  return res.json();
};

export const fetchCompliance = async (projectId) => {
  const res = await apiFetch(`/projects/${projectId}/compliance`);
  return res.json();
};
