import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

import LoginScreen from "./components/LoginScreen";
import Sidebar from "./components/Sidebar";
import PhaseStepper from "./components/PhaseStepper";
import VisualWorkflow from "./components/VisualWorkflow";
import Workspace from "./components/Workspace";
import MonitoringPanel from "./components/MonitoringPanel";
import EvolutionPanel from "./components/EvolutionPanel";
import ArchitectureTable from "./components/ArchitectureTable";
import ActivityLog from "./components/ActivityLog";
import TestPanel from "./components/TestPanel";
import VibeChat from "./components/VibeChat";
import SkillMarketplace from "./components/SkillMarketplace";
import TrustPanel from "./components/TrustPanel";

import {
  checkHealth, fetchProjects, createProject, deleteProject,
  fetchProjectState, updateProjectState,
  generatePlan, generateCode, verifyProject, executeCode,
  createVersion, exportProject, createLog, isLoggedIn, logout,
} from "./services/api";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [providers, setProviders] = useState({});
  const [selectedModel, setSelectedModel] = useState("gemma4:latest");
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [activeTab, setActiveTab] = useState("workspace");
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [goal, setGoal] = useState("");
  const [logic, setLogic] = useState("");
  const [plan, setPlan] = useState("");
  const [code, setCode] = useState("");
  const [evolution, setEvolution] = useState("");
  const [tests, setTests] = useState("");
  const [currentPhase, setCurrentPhase] = useState("Goal");
  const [verifyResult, setVerifyResult] = useState(null);
  const [execResult, setExecResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      initApp();
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setCurrentUser(null);
    };
    window.addEventListener("auth-expired", handler);
    return () => window.removeEventListener("auth-expired", handler);
  }, []);

  const initApp = async () => {
    try {
      const health = await checkHealth();
      setProviders(health.providers || {});
      const ollamaModels = health.providers?.ollama?.models || [];
      const gemma = ollamaModels.find((m) => m.toLowerCase().includes("gemma"));
      setSelectedModel(gemma || ollamaModels[0] || "gemma4:latest");
    } catch (e) { console.error("Health check failed:", e); }

    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (e) { console.error("Failed to load projects:", e); }
  };

  const handleAuth = (user, token) => {
    setCurrentUser(user);
    initApp();
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setProjects([]);
    setSelectedProjectId(null);
  };

  useEffect(() => {
    if (!selectedProjectId) return;
    const timer = setTimeout(() => {
      updateProjectState(selectedProjectId, {
        goal, logic, plan, code, evolution, tests, current_phase: currentPhase,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [goal, logic, plan, code, evolution, tests, currentPhase, selectedProjectId]);

  useEffect(() => {
    if (code) setCurrentPhase("Code");
    else if (plan) setCurrentPhase("Plan");
    else if (logic) setCurrentPhase("Logic");
    else setCurrentPhase("Goal");
  }, [goal, logic, plan, code]);

  const handleCreateProject = async (title) => {
    try {
      const p = await createProject(title);
      setProjects((prev) => [{ ...p, currentPhase: p.currentPhase || "Goal" }, ...prev]);
      handleSelectProject(p.id);
    } catch (e) { console.error("Create project failed:", e); }
  };

  const handleSelectProject = async (id) => {
    setSelectedProjectId(id);
    setVerifyResult(null);
    setExecResult(null);
    try {
      const state = await fetchProjectState(id);
      setGoal(state.goal || "");
      setLogic(state.logic || "");
      setPlan(state.plan || "");
      setCode(state.code || "");
      setEvolution(state.evolution || "");
      setTests(state.tests || "");
      setCurrentPhase(state.currentPhase || "Goal");
    } catch (e) { console.error("Load project state failed:", e); }
  };

  const handleDeleteProject = async (id) => {
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (selectedProjectId === id) {
        setSelectedProjectId(null);
        setGoal(""); setLogic(""); setPlan(""); setCode("");
        setEvolution(""); setTests(""); setCurrentPhase("Goal");
      }
    } catch (e) { console.error("Delete project failed:", e); }
  };

  const handleGeneratePlan = async () => {
    if (!goal || !logic) return;
    setLoading("plan");
    try {
      const res = await generatePlan(goal, logic, selectedModel, selectedProvider);
      setPlan(res.plan);
      await createLog({ project_id: selectedProjectId, action: "Plan generated", module: "PlannerAgent", result: "Success" });
    } catch (e) { console.error("Generate plan failed:", e); }
    setLoading(false);
  };

  const handleGenerateCode = async () => {
    if (!goal || !logic || !plan) return;
    setLoading("code");
    try {
      const res = await generateCode(goal, logic, plan, selectedModel, selectedProvider);
      setCode(res.code);
      await createLog({ project_id: selectedProjectId, action: "Code generated", module: "CoderAgent", result: "Success" });
    } catch (e) { console.error("Generate code failed:", e); }
    setLoading(false);
  };

  const handleVerify = async () => {
    setLoading("verify");
    try {
      const result = await verifyProject(goal, logic, plan, code, tests);
      setVerifyResult(result);
      if (result.status === "PASS") setCurrentPhase("Verify");
      await createLog({ project_id: selectedProjectId, action: `Verification: ${result.status}`, module: "Verifier", result: result.status });
    } catch (e) { console.error("Verification failed:", e); }
    setLoading(false);
  };

  const handleExecute = async () => {
    if (!code) return;
    setLoading("execute");
    try {
      const result = await executeCode(code);
      setExecResult(result);
      await createLog({ project_id: selectedProjectId, action: `Code executed (exit: ${result.exit_code})`, module: "Sandbox", result: result.status === "success" ? "Success" : "Error" });
    } catch (e) {
      console.error("Execution failed:", e);
      setExecResult({ stdout: "", stderr: "Execution failed", exit_code: -1, status: "error" });
    }
    setLoading(false);
  };

  const handleSaveVersion = async () => {
    if (!selectedProjectId) return;
    try {
      const res = await createVersion(selectedProjectId, {
        goal, logic, plan, code, evolution, tests, current_phase: currentPhase,
      });
      await createLog({ project_id: selectedProjectId, action: `Version v${res.versionNumber} saved`, module: "EvolutionEngine", result: "Success" });
    } catch (e) { console.error("Save version failed:", e); }
  };

  const handleRestoreVersion = (v) => {
    setGoal(v.goal || "");
    setLogic(v.logic || "");
    setPlan(v.plan || "");
    setCode(v.code || "");
    setEvolution(v.evolution || "");
    setTests(v.tests || "");
    setCurrentPhase(v.currentPhase || "Goal");
    setActiveTab("workspace");
  };

  const handleExport = async () => {
    if (!selectedProjectId) return;
    try {
      const blob = await exportProject(selectedProjectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "gladme_export.zip"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error("Export failed:", e); }
  };

  const availableModels = useMemo(() => {
    const models = [];
    Object.entries(providers).forEach(([name, info]) => {
      if (info.available && info.models) {
        info.models.forEach((m) => models.push({ model: m, provider: name }));
      }
    });
    return models;
  }, [providers]);

  if (!currentUser) {
    return <LoginScreen onAuth={handleAuth} />;
  }

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  const renderContent = () => {
    if (!selectedProjectId) {
      return (
        <div className="empty-state">
          <div className="empty-icon">🚀</div>
          <h3>Welcome to GladME Studio V4</h3>
          <p>Create a new project or select an existing one from the sidebar to begin.</p>
        </div>
      );
    }

    switch (activeTab) {
      case "workspace":
        return (
          <>
            <VisualWorkflow currentPhase={currentPhase} goal={goal} logic={logic} plan={plan} code={code} />
            <div className="grid-2">
              <Workspace
                goal={goal} setGoal={setGoal}
                logic={logic} setLogic={setLogic}
                plan={plan} setPlan={setPlan}
                code={code} setCode={setCode}
                evolution={evolution} setEvolution={setEvolution}
                onGeneratePlan={handleGeneratePlan}
                onGenerateCode={handleGenerateCode}
                onVerify={handleVerify}
                onSaveVersion={handleSaveVersion}
                onExport={handleExport}
                onExecute={handleExecute}
                verifyResult={verifyResult}
                execResult={execResult}
                loading={loading}
                selectedModel={selectedModel}
              />
              <div className="stack">
                <TestPanel
                  goal={goal} logic={logic} plan={plan} code={code}
                  tests={tests} setTests={setTests}
                  selectedModel={selectedModel} selectedProvider={selectedProvider}
                />
                <VibeChat
                  projectId={selectedProjectId}
                  goal={goal} logic={logic} plan={plan} code={code}
                  selectedModel={selectedModel} selectedProvider={selectedProvider}
                />
              </div>
            </div>
          </>
        );
      case "monitoring":
        return <MonitoringPanel projectId={selectedProjectId} execResult={execResult} />;
      case "evolution":
        return <EvolutionPanel projectId={selectedProjectId} goal={goal} logic={logic} plan={plan} code={code} onRestoreVersion={handleRestoreVersion} selectedModel={selectedModel} selectedProvider={selectedProvider} />;
      case "architecture":
        return <ArchitectureTable />;
      case "activity":
        return <ActivityLog projectId={selectedProjectId} />;
      case "skills":
        return <SkillMarketplace goal={goal} logic={logic} plan={plan} code={code} tests={tests} selectedModel={selectedModel} selectedProvider={selectedProvider} />;
      case "trust":
        return <TrustPanel projectId={selectedProjectId} />;
      default:
        return null;
    }
  };

  return (
    <div className="shell">
      <Sidebar
        activeTab={activeTab} setActiveTab={setActiveTab}
        projects={projects} selectedProjectId={selectedProjectId}
        onCreateProject={handleCreateProject} onSelectProject={handleSelectProject}
        onDeleteProject={handleDeleteProject}
        ollamaConnected={providers?.ollama?.available || false}
        onLogout={handleLogout}
        currentUser={currentUser}
      />
      <main className="main-area">
        <div className="top-bar">
          <div className="top-bar-left">
            <h2>{currentProject ? currentProject.title : "GladME Studio V4"}</h2>
            <span>
              {Object.entries(providers).filter(([, v]) => v.available).map(([k]) => k).join(" + ") || "Template Mode"}
            </span>
          </div>
          <div className="top-bar-actions">
            {availableModels.length > 0 && (
              <select
                className="model-selector"
                value={`${selectedModel}|${selectedProvider || ""}`}
                onChange={(e) => {
                  const [m, p] = e.target.value.split("|");
                  setSelectedModel(m);
                  setSelectedProvider(p || null);
                }}
              >
                {availableModels.map(({ model, provider: prov }) => (
                  <option key={`${model}|${prov}`} value={`${model}|${prov}`}>
                    {model} ({prov})
                  </option>
                ))}
              </select>
            )}
            {selectedProjectId && (
              <button className="btn btn-ghost btn-sm" onClick={handleExport}>📦 Export</button>
            )}
          </div>
        </div>

        {selectedProjectId && <PhaseStepper currentPhase={currentPhase} />}

        <div className="content-area">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (selectedProjectId || "")}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;
