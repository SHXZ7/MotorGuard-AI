"use client";

import { useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { useMotorData } from "../hooks/useMotorData";

const API_BASE = "http://localhost:8000";

function renderAssistantContent(content) {
  const lines = String(content || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd());

  const blocks = [];
  let paragraphBuffer = [];
  let listBuffer = null;

  const flushParagraph = () => {
    if (paragraphBuffer.length) {
      blocks.push({ type: "paragraph", text: paragraphBuffer.join(" ").trim() });
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer && listBuffer.items.length) {
      blocks.push(listBuffer);
    }
    listBuffer = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.*)$/);
    const bulleted = line.match(/^[-*•]\s+(.*)$/);

    if (numbered || bulleted) {
      flushParagraph();
      const type = numbered ? "ol" : "ul";
      const itemText = (numbered?.[1] || bulleted?.[1] || "").trim();

      if (!listBuffer || listBuffer.type !== type) {
        flushList();
        listBuffer = { type, items: [] };
      }
      listBuffer.items.push(itemText);
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();

  if (!blocks.length) {
    return <p style={{ margin: 0 }}>No answer returned.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {blocks.map((block, idx) => {
        if (block.type === "paragraph") {
          return (
            <p key={`p-${idx}`} style={{ margin: 0, lineHeight: 1.6 }}>
              {block.text}
            </p>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={`ol-${idx}`} style={{ margin: "0 0 0 18px", padding: 0, lineHeight: 1.6 }}>
              {block.items.map((item, i) => (
                <li key={`oli-${idx}-${i}`}>{item}</li>
              ))}
            </ol>
          );
        }

        return (
          <ul key={`ul-${idx}`} style={{ margin: "0 0 0 16px", padding: 0, lineHeight: 1.6 }}>
            {block.items.map((item, i) => (
              <li key={`uli-${idx}-${i}`}>{item}</li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

export default function AIChatPage() {
  const { data, loading, error } = useMotorData();
  const live = !error && !loading;

  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ask me anything about motor health, faults, trend behavior, model confidence, and recent backend records.",
    },
  ]);

  const history = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  const askQuestion = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || chatLoading) return;

    const userMsg = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history,
          top_k: 8,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || "AI request failed");
      }

      const json = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json.answer || "No answer returned.",
        },
      ]);
    } catch (err) {
      const msg = err?.message || "Unable to reach AI backend.";
      setChatError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I could not process that request: ${msg}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="root">
      <Navbar live={live} />
      <main className="main-content grid gap-6">
        {error && <div className="error-banner">⚠️ {error}</div>}

        <div className="card">
          <h2 className="section-label mb-2">AI RAG Chat</h2>
          <p className="text-sm leading-6 text-[#9CA3AF]">
            This assistant reads live backend data from MongoDB through RAG context and answers diagnostics questions.
          </p>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="max-h-105 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[86%] rounded-xl border px-3 py-2 text-sm leading-6 ${
                    m.role === "user"
                      ? "border-[#3B82F6]/50 bg-[#1D4ED8]/25 text-[#DBEAFE]"
                      : "border-[#334155] bg-[#1F2937]/45 text-[#D1D5DB]"
                  }`}
                >
                  {m.role === "assistant" ? renderAssistantContent(m.content) : m.content}
                </div>
              </div>
            ))}
            {chatLoading && <p className="text-xs text-[#9CA3AF]">Thinking...</p>}
          </div>

          <form onSubmit={askQuestion} className="border-t border-[#1F2937] p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about faults, trends, RUL, anomalies..."
                className="flex-1 rounded-md border border-[#334155] bg-[#0F172A] px-3 py-2 text-sm text-[#E2E8F0] outline-none placeholder:text-[#64748B] focus:border-[#3B82F6]"
              />
              <button
                type="submit"
                disabled={chatLoading || !input.trim()}
                className="rounded-md border border-[#3B82F6]/60 bg-[#1D4ED8]/25 px-4 py-2 text-sm font-semibold text-[#DBEAFE] transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#2563EB]/35"
              >
                Send
              </button>
            </div>
            {chatError && <p className="mt-2 text-xs text-[#FDA4AF]">{chatError}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}
