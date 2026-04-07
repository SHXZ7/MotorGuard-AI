"use client";

import Navbar from "../components/Navbar";
import { useMotorData } from "../hooks/useMotorData";

const THRESHOLDS = {
  vibration: 1.5,
  temperature: 80,
};

function computeRulMetric(currentValue, previousValue, failureThreshold) {
  const rate = Number(currentValue) - Number(previousValue);
  const headroom = Number(failureThreshold) - Number(currentValue);

  if (headroom <= 0) {
    return { value: 0, label: "FAILED", rate: Number(rate.toFixed(2)) };
  }
  if (rate <= 0) {
    return { value: null, label: "Stable", rate: Number(rate.toFixed(2)) };
  }

  const rul = headroom / rate;
  return {
    value: Number(rul.toFixed(1)),
    label: `~${Math.round(rul)} readings`,
    rate: Number(rate.toFixed(2)),
  };
}

function getRulVisualState(metric) {
  if (!metric) return { label: "Unknown", color: "#94a3b8" };
  if (metric.label === "FAILED") return { label: "Critical", color: "#fca5a5" };
  if (metric.label === "Stable") return { label: "Stable", color: "#6ee7b7" };
  if (metric.value < 10) return { label: "Critical", color: "#fca5a5" };
  if (metric.value < 30) return { label: "Warning", color: "#fde68a" };
  return { label: "Safe", color: "#6ee7b7" };
}

function MetricStat({ title, value, note, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{title}</div>
      <div style={{ color, fontWeight: 800, fontSize: 24, lineHeight: 1.1 }}>{value}</div>
      <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>{note}</div>
    </div>
  );
}

function FailureProximityChart({ latest }) {
  const vib = Number(latest?.vibration ?? 0);
  const temp = Number(latest?.temperature ?? 0);

  const rows = [
    { key: "vibration", label: "Vibration", value: vib, threshold: THRESHOLDS.vibration, unit: "g", color: "#f59e0b" },
    { key: "temperature", label: "Temperature", value: temp, threshold: THRESHOLDS.temperature, unit: "°C", color: "#38bdf8" },
  ];

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h2 className="section-label">📊 Proximity To Failure Limit</h2>
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row) => {
          const pct = Math.max(0, Math.min(100, (row.value / row.threshold) * 100));
          const headroom = Math.max(0, row.threshold - row.value);
          return (
            <div key={row.key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: "#cbd5e1", fontWeight: 600 }}>{row.label}</span>
                <span style={{ color: row.color, fontWeight: 700 }}>{row.value.toFixed(2)} {row.unit} / {row.threshold} {row.unit}</span>
              </div>
              <div style={{ height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 999 }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: row.color,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 12 }}>
                Remaining before limit: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{headroom.toFixed(2)} {row.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SensorTrendChart({ data }) {
  const recent = data.slice(0, 20).reverse();
  if (recent.length < 2) return null;

  const width = 520;
  const height = 160;
  const pad = 18;

  const vibVals = recent.map((r) => Number(r.vibration ?? 0));
  const tempVals = recent.map((r) => Number(r.temperature ?? 0));

  const toPoints = (values, maxY) =>
    values
      .map((v, i) => {
        const x = pad + (i / (values.length - 1)) * (width - pad * 2);
        const y = height - pad - (Math.max(0, v) / maxY) * (height - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");

  const vibMax = Math.max(THRESHOLDS.vibration, ...vibVals) * 1.1;
  const tempMax = Math.max(THRESHOLDS.temperature, ...tempVals) * 1.1;

  const vibThresholdY = height - pad - (THRESHOLDS.vibration / vibMax) * (height - pad * 2);
  const tempThresholdY = height - pad - (THRESHOLDS.temperature / tempMax) * (height - pad * 2);

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h2 className="section-label">📈 Recent Trend Vs Limit (Last {recent.length} readings)</h2>
      <div className="two-col" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>Vibration (limit 1.5 g)</div>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 170 }}>
            <line x1={pad} y1={vibThresholdY} x2={width - pad} y2={vibThresholdY} stroke="#fca5a5" strokeDasharray="6 5" strokeWidth="1.6" />
            <polyline fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={toPoints(vibVals, vibMax)} />
          </svg>
          <div style={{ color: "#64748b", fontSize: 12 }}>If the orange line stays under the red line, vibration is within safe range.</div>
        </div>

        <div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>Temperature (limit 80 °C)</div>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 170 }}>
            <line x1={pad} y1={tempThresholdY} x2={width - pad} y2={tempThresholdY} stroke="#fca5a5" strokeDasharray="6 5" strokeWidth="1.6" />
            <polyline fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={toPoints(tempVals, tempMax)} />
          </svg>
          <div style={{ color: "#64748b", fontSize: 12 }}>If the blue line is far below the red line, thermal risk is low.</div>
        </div>
      </div>
    </div>
  );
}

function RULMeter({ label, icon, threshold, data }) {
  if (!data) return null;
  const color =
    data.label === "FAILED" ? "#fca5a5"
    : data.label === "Stable" ? "#6ee7b7"
    : data.value < 10 ? "#fca5a5"
    : data.value < 30 ? "#fde68a"
    : "#6ee7b7";
  const statusLabel =
    data.label === "FAILED" ? "FAILED"
    : data.label === "Stable" ? "STABLE"
    : data.value < 10 ? "CRITICAL"
    : data.value < 30 ? "WARNING"
    : "SAFE";
  const pct = data.value ? Math.max(0, Math.min(100, (1 - data.value / 100) * 100)) : data.label === "FAILED" ? 100 : 0;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 className="section-label">{icon} {label}</h2>
          <div style={{ fontSize: 48, fontWeight: 800, color }}>
            {data.label === "FAILED" ? "💀" : data.label === "Stable" ? "∞" : data.value}
          </div>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>readings until failure threshold</div>
        </div>
        <div style={{ background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 700, color }}>
          {statusLabel}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", marginBottom: 16 }}>
        <div style={{ height: "100%", borderRadius: 4, width: `${pct}%`, background: color, transition: "width 0.6s ease", boxShadow: `0 0 8px ${color}66` }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "Rate / reading", value: data.rate > 0 ? `+${data.rate}` : String(data.rate) },
          { label: "Failure threshold", value: threshold },
        ].map(item => (
          <div key={item.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ color: "#475569", fontSize: 11, marginBottom: 4 }}>{item.label}</div>
            <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RULPage() {
  const { data, loading, error, latest } = useMotorData();
  const live = !error && !loading;
  const current = data?.[0];
  const previous = data?.[1];

  // Use live recomputation so UI reflects current thresholds immediately,
  // even when stored DB RUL fields were generated with older thresholds.
  const rul = current && previous
    ? {
        vibration: computeRulMetric(current.vibration, previous.vibration, THRESHOLDS.vibration),
        temperature: computeRulMetric(current.temperature, previous.temperature, THRESHOLDS.temperature),
      }
    : latest?.rul;

  const vibState = getRulVisualState(rul?.vibration);
  const tempState = getRulVisualState(rul?.temperature);

  const primaryRisk = (() => {
    if (!rul) return { text: "No data", color: "#94a3b8", note: "Waiting for sensor records" };
    if (rul.vibration?.label === "FAILED") return { text: "Vibration", color: "#fca5a5", note: "Failure limit crossed" };
    if (rul.temperature?.label === "FAILED") return { text: "Temperature", color: "#fca5a5", note: "Failure limit crossed" };
    const vibVal = rul.vibration?.value ?? 999999;
    const tempVal = rul.temperature?.value ?? 999999;
    if (vibVal < tempVal) return { text: "Vibration", color: vibState.color, note: "Closest to its limit" };
    if (tempVal < vibVal) return { text: "Temperature", color: tempState.color, note: "Closest to its limit" };
    return { text: "Balanced", color: "#6ee7b7", note: "No immediate risk dominance" };
  })();

  const overall = (() => {
    if (!rul) return { label: "No data", color: "#94a3b8" };
    if (rul.vibration?.label === "FAILED" || rul.temperature?.label === "FAILED") return { label: "Immediate attention", color: "#fca5a5" };
    if (vibState.label === "Critical" || tempState.label === "Critical") return { label: "High risk", color: "#fca5a5" };
    if (vibState.label === "Warning" || tempState.label === "Warning") return { label: "Watch closely", color: "#fde68a" };
    return { label: "Healthy trend", color: "#6ee7b7" };
  })();

  return (
    <div className="root">
      <Navbar live={live} />
      <main className="main-content grid gap-6">
        {error && <div className="error-banner">⚠️ {error}</div>}

        <div className="card">
          <h2 className="section-label">What is RUL?</h2>
          <p className="text-sm leading-7 text-[#6B7280]">
            Remaining Useful Life estimates how many more readings the motor can sustain before a parameter crosses its failure threshold.
          </p>
          <div className="sensor-value mt-3 rounded-md border border-[#3B82F6]/25 bg-[#1E3A8A]/16 px-4 py-2 text-xs text-[#93C5FD]">
            RUL = (failure_threshold − current_value) ÷ rate_of_change
          </div>
        </div>

        <div className="two-col">
          <MetricStat title="Overall Status" value={overall.label} note="Quick summary of current RUL health" color={overall.color} />
          <MetricStat title="Primary Risk" value={primaryRisk.text} note={primaryRisk.note} color={primaryRisk.color} />
        </div>

        <div className="two-col">
          <RULMeter label="Vibration RUL"   icon="📳" threshold="1.5 g"  data={rul?.vibration} />
          <RULMeter label="Temperature RUL" icon="🌡️" threshold="80 °C" data={rul?.temperature} />
        </div>

        {rul && <FailureProximityChart latest={latest} />}
        <SensorTrendChart data={data} />

        {!rul && (
          <div className="card text-center">
            <p className="text-sm text-[#6B7280]">Send at least one data point to the backend to calculate RUL.</p>
          </div>
        )}
      </main>
    </div>
  );
}
