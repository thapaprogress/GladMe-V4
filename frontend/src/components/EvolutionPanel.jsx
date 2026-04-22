import React, { useState, useEffect } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { motion } from "framer-motion";
import { fetchVersions, fetchVersionDetail, suggestEvolution } from "../services/api";

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

const DIFF_THEME_DATA = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "64748b", fontStyle: "italic" },
    { token: "keyword", foreground: "a78bfa" },
    { token: "string", foreground: "34d399" },
  ],
  colors: {
    "editor.background": "#080c18",
    "editor.foreground": "#e2e8f0",
    "editor.lineHighlightBackground": "#ffffff08",
    "editorCursor.foreground": "#a5b4fc",
    "editor.selectionBackground": "#6366f133",
  },
};

const EvolutionPanel = ({ projectId, goal, logic, plan, code, onRestoreVersion, selectedModel, selectedProvider }) => {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [suggestions, setSuggestions] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    if (projectId) loadVersions();
  }, [projectId]);

  const loadVersions = async () => {
    try {
      const data = await fetchVersions(projectId);
      setVersions(data);
    } catch (e) {
      console.error("Failed to load versions:", e);
    }
  };

  const handleViewVersion = async (v) => {
    try {
      const detail = await fetchVersionDetail(projectId, v.id);
      setSelectedVersion(detail);
    } catch (e) {
      console.error("Failed to load version detail:", e);
    }
  };

  const handleSuggestEvolution = async () => {
    setLoading(true);
    setSuggestions("");
    try {
      const res = await suggestEvolution(goal, logic, plan, code, selectedModel, selectedProvider);
      setSuggestions(res.suggestions || "No suggestions available.");
    } catch (e) {
      setSuggestions("Failed to get suggestions. Is Ollama running?");
    }
    setLoading(false);
  };

  return (
    <div className="grid-2">
      {/* Left: Version Timeline */}
      <div className="stack">
        <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
          <div className="card-header">
            <h3>Version History</h3>
            <span className="card-badge badge-evolution">Timeline</span>
          </div>
          <div className="card-body">
            {versions.length === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "30px" }}>
                No versions saved yet. Use "Save Version" in the Workspace.
              </div>
            ) : (
              <div className="version-timeline">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="version-item"
                    onClick={() => handleViewVersion(v)}
                  >
                    <div className="version-num">v{v.versionNumber}</div>
                    <div className="version-meta">
                      Phase: {v.currentPhase} • {v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}
                    </div>
                    {v.evolution && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                        {v.evolution}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
</motion.div>
       </div>

       {/* Right: Version Detail + AI Suggestions */}
       <div className="stack">
         {selectedVersion && (
           <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.05 }}>
            <div className="card-header">
              <h3>Version v{selectedVersion.versionNumber} Detail</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowDiff(!showDiff)}
                >
                  {showDiff ? "Hide Diff" : "Show Diff"}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onRestoreVersion(selectedVersion)}
                >
                  ↩ Restore This Version
                </button>
              </div>
            </div>
            <div className="card-body">
              {showDiff ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: "4px" }}>Code Diff (Current vs v{selectedVersion.versionNumber})</label>
                    <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", overflow: "hidden" }}>
                      <DiffEditor
                        original={selectedVersion.code || ""}
                        modified={code || ""}
                        language="python"
                        theme="vs-dark"
                        beforeMount={(monaco) => monaco.editor.defineTheme("gladme-diff-dark", DIFF_THEME_DATA)}
                        onMount={(editor, monaco) => monaco.editor.setTheme("gladme-diff-dark")}
                        options={{
                          readOnly: true,
                          renderSideBySide: true,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                          padding: { top: 10 },
                          automaticLayout: true,
                        }}
                        height="350px"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: "4px" }}>Plan Diff (Current vs v{selectedVersion.versionNumber})</label>
                    <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", overflow: "hidden" }}>
                      <DiffEditor
                        original={selectedVersion.plan || ""}
                        modified={plan || ""}
                        language="markdown"
                        theme="vs-dark"
                        beforeMount={(monaco) => monaco.editor.defineTheme("gladme-diff-dark", DIFF_THEME_DATA)}
                        onMount={(editor, monaco) => monaco.editor.setTheme("gladme-diff-dark")}
                        options={{
                          readOnly: true,
                          renderSideBySide: true,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                          padding: { top: 10 },
                          automaticLayout: true,
                        }}
                        height="250px"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Goal</label>
                    <div style={{
                      padding: "10px 14px", borderRadius: "var(--radius-md)",
                      background: "var(--bg-glass)", fontSize: "13px", color: "var(--text-secondary)",
                    }}>
                      {selectedVersion.goal || "—"}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Logic</label>
                    <div style={{
                      padding: "10px 14px", borderRadius: "var(--radius-md)",
                      background: "var(--bg-glass)", fontSize: "13px", color: "var(--text-secondary)",
                    }}>
                      {selectedVersion.logic || "—"}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Evolution Note</label>
                    <div style={{
                      padding: "10px 14px", borderRadius: "var(--radius-md)",
                      background: "var(--bg-glass)", fontSize: "13px", color: "var(--accent-amber)",
                    }}>
                      {selectedVersion.evolution || "—"}
                    </div>
                  </div>
                </>
)}
             </div>
           </motion.div>
         )}

         <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
           <div className="card-header">
             <h3>AI Evolution Suggestions</h3>
             <span className="card-badge badge-evolution">Evolution Agent</span>
           </div>
          <div className="card-body">
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>
              Let the Evolution Agent analyze your current project and suggest improvements for the next version.
            </p>
            <button
              className="btn btn-warm"
              onClick={handleSuggestEvolution}
              disabled={loading || !goal}
            >
              {loading ? <span className="spinner" /> : "🧬"}
              {loading ? "Analyzing..." : "Get AI Suggestions"}
            </button>

            {suggestions && (
              <div className="code-output" style={{ marginTop: "16px", minHeight: "150px", whiteSpace: "pre-wrap" }}>
                {suggestions}
              </div>
            )}
</div>
         </motion.div>
       </div>
     </div>
  );
};

export default EvolutionPanel;
