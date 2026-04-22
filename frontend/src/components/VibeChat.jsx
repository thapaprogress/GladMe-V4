import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { sendChat, fetchChatHistory } from "../services/api";

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const ChatMessage = ({ msg }) => {
  const isUser = msg.role === "user";
  const content = msg.content || "";

  const codeBlockRegex = /```python\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: "12px",
    }}>
      <div style={{
        maxWidth: "80%", padding: "12px 16px", borderRadius: "var(--radius-md)",
        background: isUser ? "rgba(99,102,241,0.15)" : "var(--bg-glass)",
        border: `1px solid ${isUser ? "rgba(99,102,241,0.3)" : "var(--border-subtle)"}`,
        fontSize: "13px", lineHeight: "1.6",
      }}>
        <div style={{ fontSize: "11px", fontWeight: 600, marginBottom: "4px",
                      color: isUser ? "var(--accent-indigo)" : "var(--accent-emerald)" }}>
          {isUser ? "You" : "Vibe Agent"}
        </div>
        {parts.map((part, i) => part.type === "code" ? (
          <pre key={i} style={{
            background: "rgba(5,10,20,0.8)", padding: "12px",
            borderRadius: "var(--radius-sm)", overflow: "auto",
            fontSize: "12px", fontFamily: "'JetBrains Mono', Consolas, monospace",
            margin: "8px 0", color: "#e2e8f0",
          }}>{part.content}</pre>
        ) : (
          <div key={i} style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)" }}>{part.content}</div>
        ))}
      </div>
    </div>
  );
};

const VibeChat = ({ projectId, goal, logic, plan, code, selectedModel, selectedProvider, onApplyCode }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (projectId) loadHistory();
  }, [projectId]);

  const loadHistory = async () => {
    try {
      const data = await fetchChatHistory(projectId);
      setMessages(data.messages || []);
    } catch {}
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await sendChat(input.trim(), goal, logic, plan, code, selectedModel, selectedProvider);
      const assistantMsg = { role: "assistant", content: res.response };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection failed. Is the backend running?" }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div className="glass-card" variants={cardVariants} initial="hidden" animate="visible">
      <div className="card-header">
        <h3>Vibe Coding</h3>
        <span className="card-badge badge-coder">Vibe Agent</span>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div ref={scrollRef} style={{
          height: "400px", overflowY: "auto", padding: "16px 20px",
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: "13px" }}>
              Ask anything about your code. The Vibe Agent knows your project context.
            </div>
          )}
          {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "12px" }}>
              <div style={{ padding: "12px 16px", borderRadius: "var(--radius-md)", background: "var(--bg-glass)", border: "1px solid var(--border-subtle)" }}>
                <span className="spinner" />
              </div>
            </div>
          )}
        </div>
        <div style={{
          display: "flex", gap: "8px", padding: "12px 20px",
          borderTop: "1px solid var(--border-subtle)",
        }}>
          <textarea
            className="form-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask anything about your code..."
            style={{ flex: 1, resize: "none", minHeight: "40px", maxHeight: "80px" }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default VibeChat;
