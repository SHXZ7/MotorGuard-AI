"use client";

import Navbar from "../components/Navbar";
import { useMotorData } from "../hooks/useMotorData";

const EFF_LEVELS = [
  { range: "≥ 500",   label: "HIGH",    color: "#6ee7b7", note: "Motor running efficiently — good RPM for low current" },
  { range: "200–499", label: "MEDIUM",  color: "#fde68a", note: "Moderate — possible wear or increased load" },
  { range: "< 200",   label: "LOW",     color: "#fca5a5", note: "Mechanical issue or heavy overload detected" },
  { range: "0",       label: "STALLED", color: "#94a3b8", note: "No movement or zero current detected" },
];

export default function PowerPage() {
  const { data, loading, error, latest } = useMotorData();
  const live = !error && !loading;
  const eff = latest?.efficiency;
  const ps  = latest?.power_state || "—";

  const effColor = eff
    ? eff.label === "HIGH"    ? "#6ee7b7"
    : eff.label === "MEDIUM"  ? "#fde68a"
    : eff.label === "STALLED" ? "#94a3b8"
    : "#fca5a5"
    : "#64748b";

  const psColor = ps.includes("Overload")     ? "#fca5a5"
    : ps.includes("issue") || ps.includes("fluctuation") ? "#fde68a"
    : ps.includes("Load")  ? "#c4b5fd"
    : "#6ee7b7";

  return (
    <div className="root">
      <Navbar live={live} />
      <main className="main-content grid gap-6">
        {error && <div className="error-banner">⚠️ {error}</div>}

        <div className="card flex flex-col items-center gap-4 p-7">
          <h2 className="section-label mb-0">Live Efficiency Score</h2>
          <div className="sensor-value text-6xl font-extrabold leading-none" style={{ color: effColor }}>
            {eff?.score ?? "—"}
          </div>
          <div className="text-sm text-[#6B7280]">Formula: RPM ÷ Current</div>
          {eff && (
            <div style={{ background: `${effColor}22`, border: `1px solid ${effColor}55`, color: effColor }} className="inline-block rounded-md px-6 py-1.5 text-sm font-bold tracking-[0.08em]">
              {eff.label}
            </div>
          )}
          {eff && (
            <div className="rounded-md border border-[#3B82F6]/25 bg-[#1E3A8A]/18 px-4 py-2 text-center text-sm text-[#93C5FD]">
              {eff.interpretation}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Instant Power",    value: latest?.power ? `${Number(latest.power).toFixed(2)} W` : "—", icon: "💡", color: "#a78bfa" },
            { label: "Efficiency Score", value: eff?.score ?? "—",  icon: "📊", color: effColor },
            { label: "Efficiency Level", value: eff?.label ?? "—",  icon: "📈", color: effColor },
            { label: "Power State",      value: ps,                   icon: "🔋", color: psColor },
          ].map(item => (
            <div key={item.label} className="card flex flex-col gap-2">
              <div className="text-xl">{item.icon}</div>
              <div className="section-label mb-0">{item.label}</div>
              <div className="sensor-value text-2xl font-extrabold" style={{ color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div className="two-col">
          <div className="card">
            <h2 className="section-label">Efficiency Interpretation</h2>
            {eff && (
              <div style={{ background: `${effColor}15`, border: `1px solid ${effColor}33`, color: effColor }} className="mb-4 rounded-md px-3 py-2 text-sm">
                {eff.interpretation}
              </div>
            )}
            {EFF_LEVELS.map(row => (
              <div key={row.label} className="flex items-center justify-between border-b border-[#1F2937] py-2 text-sm">
                <span className="min-w-15 text-[#6B7280]">{row.range}</span>
                <span style={{ color: row.color }} className="font-bold">{row.label}</span>
                <span className="text-[#6B7280]">{row.note}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 className="section-label">Power State Diagnosis</h2>
            <div style={{ background: `${psColor}15`, border: `1px solid ${psColor}33`, color: psColor }} className="mb-4 rounded-md px-4 py-2 text-center text-sm font-bold">
              {ps}
            </div>
            {[
              { cond: "Power↑  RPM stable", meaning: "Load increase" },
              { cond: "Power↑  RPM↓",       meaning: "Overload risk ⚠️" },
              { cond: "Power↓  RPM↓",       meaning: "Supply / voltage issue" },
              { cond: "Power fluctuates",   meaning: "Connection instability" },
              { cond: "Stable",             meaning: "Normal operation ✅" },
            ].map(row => (
              <div key={row.cond} className="flex justify-between border-b border-[#1F2937] py-2 text-sm">
                <span className="text-[#6B7280]">{row.cond}</span>
                <span className="font-medium text-[#9CA3AF]">{row.meaning}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="two-col">
          <div className="card">
            <h2 className="section-label">Real Fault Scenarios</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1F2937]">
                  {["Case", "RPM", "Current", "Meaning"].map(h => (
                    <th key={h} className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { case: "Normal ✅", rpm: "High", current: "Low", meaning: "Efficient motor" },
                  { case: "Worn ⚠️", rpm: "Medium", current: "Medium", meaning: "Aging / wear" },
                  { case: "Overload ❌", rpm: "Low", current: "High", meaning: "Excess load" },
                  { case: "Stall 🛑", rpm: "0", current: "High", meaning: "Motor jammed" },
                ].map((row, i) => (
                  <tr key={row.case} className={i % 2 === 0 ? "bg-[#111827]" : "bg-[#0F172A]"}>
                    <td className="px-2 py-2 font-semibold text-[#F1F5F9]">{row.case}</td>
                    <td className="px-2 py-2 text-[#9CA3AF]">{row.rpm}</td>
                    <td className="px-2 py-2 text-[#9CA3AF]">{row.current}</td>
                    <td className="px-2 py-2 text-[#6B7280]">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 rounded-md border border-[#3B82F6]/25 bg-[#1E3A8A]/16 px-3 py-2 text-xs text-[#93C5FD] sensor-value">
              efficiency = rpm / current
            </div>
          </div>

          <div className="card">
            <h2 className="section-label">Efficiency Bands</h2>
            {EFF_LEVELS.map((row) => (
              <div key={`band-${row.label}`} className="flex items-start gap-3 border-b border-[#1F2937] py-2">
                <div className="min-w-15 text-sm text-[#6B7280]">{row.range}</div>
                <div className="flex-1">
                  <div style={{ color: row.color }} className="text-sm font-bold">{row.label}</div>
                  <div className="text-xs text-[#6B7280]">{row.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {data.length > 1 && (
          <div className="card">
            <h2 className="section-label">Efficiency Trend (Last {Math.min(data.length, 20)} records)</h2>
            <div className="flex h-20 items-end gap-1.5 overflow-x-auto pb-2">
              {data.slice(0, 20).reverse().map((r) => {
                const score = r.efficiency?.score ?? 0;
                const maxScore = 1000;
                const h = Math.max(4, Math.min(100, (score / maxScore) * 100));
                const c = score >= 500 ? "#6ee7b7" : score >= 200 ? "#fde68a" : "#fca5a5";
                return (
                  <div key={r._id} title={`Score: ${score}`} className="w-4 rounded-t-sm" style={{ height: `${h}%`, background: c, opacity: 0.85 }} />
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-[#6B7280]">
              <span>Oldest</span><span>Latest</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
