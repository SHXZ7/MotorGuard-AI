"use client";

import Navbar from "../components/Navbar";
import { useMotorData } from "../hooks/useMotorData";
import { FAULT_STYLES, TREND_ARROW } from "../lib/constants";

const FAULT_ORDER = ["NORMAL", "STALL", "BEARING_FAULT", "OVERHEATING", "OVERLOAD"];

function FaultDistributionChart({ counts }) {
  if (!counts) {
    return <p style={{ color: "#475569", fontSize: 13 }}>No analytics yet.</p>;
  }

  const rows = FAULT_ORDER.map((fault) => ({
    fault,
    count: counts[fault] ?? 0,
    style: FAULT_STYLES[fault] || FAULT_STYLES.NORMAL,
  }));

  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) {
    return <p style={{ color: "#475569", fontSize: 13 }}>No fault records in current window.</p>;
  }

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const segments = rows.reduce(
    (acc, row) => {
      const dash = (row.count / total) * circumference;
      return {
        offset: acc.offset + dash,
        items: [
          ...acc.items,
          {
            ...row,
            dash,
            offset: acc.offset,
          },
        ],
      };
    },
    { offset: 0, items: [] },
  ).items;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(190px, 220px) 1fr", gap: 18, alignItems: "center" }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 160, height: 160 }}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="16" />
            {segments.map((segment) => {
              const strokeDasharray = `${segment.dash} ${Math.max(circumference - segment.dash, 0)}`;
              const strokeDashoffset = -segment.offset;

              return (
                <circle
                  key={segment.fault}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={segment.style.color}
                  strokeWidth="16"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="butt"
                  style={{ transition: "stroke-dasharray 0.4s ease" }}
                />
              );
            })}
          </svg>

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 800, color: "#e2e8f0" }}>{total}</div>
            <div style={{ color: "#7285a1", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>Last 20</div>
          </div>
        </div>
      </div>

      <div>
        {rows.map((row) => {
          const pct = ((row.count / total) * 100).toFixed(1);
          return (
            <div key={row.fault} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: "#94a3b8" }}>
                  {row.style.emoji} {row.fault.replace(/_/g, " ")}
                </span>
                <span style={{ color: row.style.color, fontWeight: 700 }}>{row.count} ({pct}%)</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: 4,
                    width: `${(row.count / total) * 100}%`,
                    background: row.style.color,
                    transition: "width 0.5s",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FaultPage() {
  const { data, analytics, loading, error, latest } = useMotorData();
  const live = !error && !loading;
  const fault = latest?.fault || "NORMAL";
  const fs = FAULT_STYLES[fault] || FAULT_STYLES.NORMAL;
  const trend = analytics?.trend;
  const trendColors = { increasing: "#fca5a5", decreasing: "#6ee7b7", stable: "#93c5fd" };

  return (
    <div className="root">
      <Navbar live={live} />
      <main className="main-content grid gap-6">
        {error && <div className="error-banner">⚠️ {error}</div>}

        <div className="card flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h2 className="section-label mb-0">Active Fault</h2>
            <div
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{
                background: latest?.fault_source === "ml-model" ? "rgba(59,130,246,0.16)" : "rgba(75,85,99,0.2)",
                border: `1px solid ${latest?.fault_source === "ml-model" ? "rgba(59,130,246,0.5)" : "rgba(107,114,128,0.45)"}`,
                color: latest?.fault_source === "ml-model" ? "#93C5FD" : "#9CA3AF",
              }}
            >
              {latest?.fault_source === "ml-model" ? "🤖 ML Model" : "📐 Rule-based"}
            </div>
            {latest?.fault_confidence && (
              <div className="rounded-full border border-[#10B981]/50 bg-[#064E3B]/40 px-3 py-1 text-[11px] font-semibold text-[#6EE7B7]">
                {latest.fault_confidence}% confidence
              </div>
            )}
          </div>

          <div style={{ background: fs.bg, border: `1px solid ${fs.border}`, color: fs.color }} className="rounded-xl px-8 py-3 text-center text-xl font-extrabold tracking-[0.08em]">
            {fs.emoji} {fault.replace(/_/g, " ")}
          </div>

          {latest?.possible_fault && (
            <div className="rounded-md border border-[#F59E0B]/40 bg-[#92400E]/25 px-4 py-2 text-sm font-semibold text-[#FDE68A]">
              ⚠️ Early Warning: RPM↓ while Current↑
            </div>
          )}

          {analytics?.ml_active !== undefined && (
            <div className={`text-xs ${analytics.ml_active ? "text-[#6EE7B7]" : "text-[#9CA3AF]"}`}>
              {analytics.ml_active ? "✅ RandomForest model active" : "📐 Using rule-based classifier"}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="section-label">Trend Analysis</h2>
          {trend ? (
            <>
              {[{ label: "Vibration", key: "vibration_trend" }, { label: "Temperature", key: "temperature_trend" }].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between border-b border-[#1F2937] py-2 text-sm">
                  <span className="text-[#9CA3AF]">{label}</span>
                  <span style={{ color: trendColors[trend[key]] || "#9CA3AF" }} className="font-semibold">{TREND_ARROW[trend[key]] || trend[key]}</span>
                </div>
              ))}
              <div className="mt-3 rounded-md border border-[#3B82F6]/25 bg-[#1E3A8A]/18 px-3 py-2 text-xs text-[#93C5FD]">
                {trend.vibration_trend === "increasing"
                  ? "⚠️ Vibration rising — bearing check recommended"
                  : trend.temperature_trend === "increasing"
                  ? "⚠️ Temperature rising — check cooling"
                  : "✅ Parameters stable. No predicted failure."}
              </div>
            </>
          ) : <p className="text-sm text-[#6B7280]">Not enough data yet.</p>}
        </div>

        <div className="card">
          <h2 className="section-label">Fault Reference Guide</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1F2937]">
                  {["Fault", "Condition", "Meaning"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.11em] text-[#9CA3AF]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { fault: "STALL",         cond: "RPM < 100 & Current > 2A",   meaning: "Motor stuck / jammed" },
                  { fault: "BEARING FAULT", cond: "Vibration > 1.2g",           meaning: "Mechanical wear" },
                  { fault: "OVERHEATING",   cond: "Temperature > 50°C",         meaning: "Cooling failure" },
                  { fault: "OVERLOAD",      cond: "Current > 2A & RPM < 1000",  meaning: "Excess load" },
                ].map((row, i) => (
                  <tr key={row.fault} className={i % 2 === 0 ? "bg-[#111827]" : "bg-[#0F172A]"}>
                    <td className="px-3 py-2 font-semibold text-[#FDE68A]">{row.fault}</td>
                    <td className="px-3 py-2 text-[#9CA3AF]">{row.cond}</td>
                    <td className="px-3 py-2 text-[#6B7280]">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="section-label">Fault Distribution Chart (Last 20)</h2>
          <FaultDistributionChart counts={analytics?.fault_counts} />
        </div>
      </main>
    </div>
  );
}
