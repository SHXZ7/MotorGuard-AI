"use client";

import {
  Activity,
  AlertCircle,
  Gauge,
  Thermometer,
  Waves,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import { useMotorData } from "./hooks/useMotorData";

function metricStatus(type, value) {
  if (value === null || value === undefined) return { label: "No signal", color: "#9CA3AF" };
  if (type === "rpm") return value > 1200 ? { label: "Nominal Range", color: "#10B981" } : { label: "Low Speed", color: "#F59E0B" };
  if (type === "voltage") return value >= 7.5 ? { label: "Steady State", color: "#10B981" } : { label: "Drop", color: "#EF4444" };
  if (type === "current") return value < 2 ? { label: "Load Balanced", color: "#3B82F6" } : { label: "High Draw", color: "#F59E0B" };
  if (type === "temperature") return value < 50 ? { label: "Within Limit", color: "#10B981" } : { label: "Warning Threshold", color: "#F59E0B" };
  if (type === "vibration") return value < 1.2 ? { label: "Nominal", color: "#10B981" } : { label: "High Vibration", color: "#EF4444" };
  return { label: "Stable", color: "#9CA3AF" };
}

function sparklinePoints(values, width = 260, height = 46) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * (width - 6) + 3;
      const y = height - 4 - ((v - min) / range) * (height - 12);
      return `${x},${y}`;
    })
    .join(" ");
}

function SensorCard({ title, value, unit, icon, iconColor, status, trend }) {
  return (
    <div className="metric-card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">{title}</span>
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div className="sensor-value flex items-baseline gap-2 text-[#F9FAFB]">
        <span className="text-3xl font-bold leading-none">{value}</span>
        <span className="text-sm text-[#9CA3AF]">{unit}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-[#9CA3AF]">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
        <span>{status.label}</span>
      </div>
      <svg viewBox="0 0 260 46" className="h-10 w-full">
        <polyline fill="none" stroke="rgba(59,130,246,0.26)" strokeWidth="1" points="3,44 257,44" />
        <polyline fill="none" stroke={iconColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={sparklinePoints(trend)} />
      </svg>
    </div>
  );
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const toRad = (deg) => (Math.PI / 180) * deg;
  const sx = cx + r * Math.cos(toRad(startDeg));
  const sy = cy + r * Math.sin(toRad(startDeg));
  const ex = cx + r * Math.cos(toRad(endDeg));
  const ey = cy + r * Math.sin(toRad(endDeg));
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweep} ${ex} ${ey}`;
}

function HealthPanel({ score }) {
  const safeScore = Math.max(0, Math.min(100, Number(score ?? 0)));
  const status = safeScore >= 80
    ? { label: "OPTIMAL", color: "#10B981" }
    : safeScore >= 60
      ? { label: "FAIR", color: "#F59E0B" }
      : { label: "CRITICAL", color: "#EF4444" };

  const activeArcEnd = 180 - (safeScore / 100) * 180;
  const segmentDefs = [
    { from: 180, to: 72, color: "#EF4444", active: safeScore < 60 },
    { from: 72, to: 36, color: "#F59E0B", active: safeScore >= 60 && safeScore < 80 },
    { from: 36, to: 0, color: "#10B981", active: safeScore >= 80 },
  ];

  return (
    <div className="card flex h-full flex-col gap-4">
      <h3 className="section-label mb-0">Motor Health Score</h3>
      <div className="relative flex justify-center">
        <svg viewBox="0 0 220 140" className="h-40 w-full max-w-60">
          <path d={arcPath(110, 112, 70, 180, 0)} fill="none" stroke="#1F2937" strokeWidth="14" strokeLinecap="round" />
          {segmentDefs.map((s, i) => (
            <path key={i} d={arcPath(110, 112, 70, s.from, s.to)} fill="none" stroke={s.color} strokeOpacity={s.active ? 1 : 0.28} strokeWidth="14" strokeLinecap="round" />
          ))}
          <path d={arcPath(110, 112, 70, 180, activeArcEnd)} fill="none" stroke={status.color} strokeWidth="6" strokeLinecap="round" />
          <text x="110" y="98" textAnchor="middle" fill="#F9FAFB" fontFamily="Inter" fontWeight="800" fontSize="46">{Math.round(safeScore)}</text>
          <text x="110" y="118" textAnchor="middle" fill={status.color} fontFamily="Inter" fontWeight="700" fontSize="13">{status.label}</text>
        </svg>
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.08em] text-[#9CA3AF]">
        <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />OPTIMAL 80-100</div>
        <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />FAIR 60-79</div>
        <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#EF4444]" />CRITICAL 0-59</div>
      </div>
    </div>
  );
}

function getFaultPalette(faultValue) {
  const normalized = String(faultValue || "NORMAL").toUpperCase();

  if (normalized === "NORMAL") {
    return {
      isFault: false,
      border: "#065F46",
      background: "#065F46",
      text: "#A7F3D0",
      accent: "#10B981",
    };
  }

  if (normalized.includes("BEARING")) {
    return {
      isFault: true,
      border: "#92400E",
      background: "#78350F",
      text: "#FDE68A",
      accent: "#F59E0B",
    };
  }

  return {
    isFault: true,
    border: "#7F1D1D",
    background: "#7F1D1D",
    text: "#FCA5A5",
    accent: "#EF4444",
  };
}

function TrendChart({ data }) {
  const recent = data.slice(0, 18).reverse();
  if (recent.length < 2) return null;

  const width = 760;
  const height = 260;
  const padX = 24;
  const padY = 26;

  const rpmVals = recent.map((r) => Number(r.rpm ?? 0));
  const tempVals = recent.map((r) => Number(r.temperature ?? 0));
  const vibVals = recent.map((r) => Number(r.vibration ?? 0));

  const all = [...rpmVals, ...tempVals, ...vibVals];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;

  const points = (vals) =>
    vals
      .map((v, i) => {
        const x = padX + (i / (vals.length - 1)) * (width - padX * 2);
        const y = height - padY - ((v - min) / range) * (height - padY * 2);
        return `${x},${y}`;
      })
      .join(" ");

  const timeLabels = [0, Math.floor((recent.length - 1) / 2), recent.length - 1].map((i) =>
    recent[i]?.timestamp ? new Date(recent[i].timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"
  );

  return (
    <div className="card h-full">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="section-label mb-0">Live Sensor Trends</h3>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.08em] text-[#9CA3AF]">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-[#7BA6FF]" />RPM</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-[#FB7185]" />TEMP</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-[#10B981]" />VIB</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-65 w-full">
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="#1F2937" strokeWidth="1" />
        <line x1={padX} y1={height * 0.63} x2={width - padX} y2={height * 0.63} stroke="#1F2937" strokeWidth="1" strokeDasharray="4 5" />
        <polyline fill="none" stroke="#7BA6FF" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" points={points(rpmVals)} />
        <polyline fill="none" stroke="#FB7185" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" points={points(tempVals)} />
        <polyline fill="none" stroke="#10B981" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" points={points(vibVals)} />
      </svg>
      <div className="mt-2 flex justify-between text-xs text-[#9CA3AF]">
        <span>{timeLabels[0]}</span>
        <span>{timeLabels[1]}</span>
        <span>{timeLabels[2]}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, analytics, loading, error, latest } = useMotorData();
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const live = !error && !loading;

  const metricRows = [
    {
      key: "rpm",
      title: "RPM",
      unit: "RPM",
      icon: <Gauge size={16} />,
      iconColor: "#3B82F6",
      value: latest?.rpm ?? null,
      trend: data.slice(0, 12).reverse().map((r) => Number(r.rpm ?? 0)),
    },
    {
      key: "voltage",
      title: "VOLTAGE",
      unit: "V",
      icon: <Zap size={16} />,
      iconColor: "#F59E0B",
      value: latest?.voltage ?? null,
      trend: data.slice(0, 12).reverse().map((r) => Number(r.voltage ?? 0)),
    },
    {
      key: "current",
      title: "CURRENT",
      unit: "A",
      icon: <Waves size={16} />,
      iconColor: "#60A5FA",
      value: latest?.current ?? null,
      trend: data.slice(0, 12).reverse().map((r) => Number(r.current ?? 0)),
    },
    {
      key: "temperature",
      title: "TEMPERATURE",
      unit: "C",
      icon: <Thermometer size={16} />,
      iconColor: "#2DD4BF",
      value: latest?.temperature ?? null,
      trend: data.slice(0, 12).reverse().map((r) => Number(r.temperature ?? 0)),
    },
    {
      key: "vibration",
      title: "VIBRATION",
      unit: "g",
      icon: <Activity size={16} />,
      iconColor: "#10B981",
      value: latest?.vibration ?? null,
      trend: data.slice(0, 12).reverse().map((r) => Number(r.vibration ?? 0)),
    },
  ];

  const faultName = (latest?.fault || "NORMAL").replace(/_/g, " ");
  const faultPalette = getFaultPalette(latest?.fault);
  const confidence = Math.max(0, Math.min(100, Number(latest?.fault_confidence ?? 0)));
  const confidenceColor = faultPalette.accent;

  const recentRows = data.slice(0, 5);
  const latestFiftyRows = data.slice(0, 50);

  useEffect(() => {
    if (!isLogsModalOpen) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsLogsModalOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isLogsModalOpen]);

  return (
    <div className="root bg-[#0A0F1E]">
      <Navbar live={live} />
      <main className="main-content flex flex-col gap-6">
        {error && <div className="error-banner"> {error}</div>}

        <section className="grid gap-4 md:grid-cols-5">
          {metricRows.map((m) => (
            <SensorCard
              key={m.key}
              title={m.title}
              unit={m.unit}
              icon={m.icon}
              iconColor={m.iconColor}
              value={m.value === null || m.value === undefined ? "" : Number(m.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              status={metricStatus(m.key, Number(m.value ?? 0))}
              trend={m.trend}
            />
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[32%_68%]">
          <HealthPanel score={latest?.health_score ?? 0} />

          <div className="card flex h-full flex-col gap-4">
            <div className="flex items-start justify-between">
              <h3 className="section-label mb-0">Fault Detection</h3>
              <AlertCircle size={15} color="#EF4444" />
            </div>

            <div
              className="rounded-xl px-4 py-5 text-center text-2xl font-bold"
              style={{
                border: `1px solid ${faultPalette.border}`,
                background: faultPalette.background,
                color: faultPalette.text,
              }}
            >
              {faultName}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#9CA3AF]">CONFIDENCE</span>
                <span className="font-semibold" style={{ color: confidenceColor }}>{confidence}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#1F2937]">
                <div
                  className="h-full rounded-full transition-all duration-150 ease-in-out"
                  style={{ width: `${confidence}%`, background: confidenceColor }}
                />
              </div>
            </div>

            <p className="text-xs italic text-[#9CA3AF]">
              {latest?.possible_fault
                ? "Pattern indicates potential structural anomaly."
                : "Diagnostic stream stable for current operating window."}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[65%_35%]">
          <TrendChart data={data} />

          <div className="card flex h-full flex-col">
            <h3 className="section-label mb-3">Recent Records</h3>
            <div className="overflow-hidden rounded-md border border-[#1F2937]">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#0F172A]">
                  <tr>
                    {["TIME", "RPM", "TEMP", "STATUS"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold tracking-[0.11em] text-[#9CA3AF]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((r, i) => {
                    const isFault = (r.fault || "NORMAL") !== "NORMAL";
                    return (
                      <tr key={r._id} className={i % 2 === 0 ? "bg-[#111827]" : "bg-[#0F172A]"}>
                        <td className="sensor-value px-3 py-2 text-[#9CA3AF]">{r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : ""}</td>
                        <td className="sensor-value px-3 py-2 text-[#F9FAFB]">{r.rpm ?? ""}</td>
                        <td className="sensor-value px-3 py-2 text-[#F9FAFB]">{r.temperature !== undefined ? `${Number(r.temperature).toFixed(1)}` : ""}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block h-2 w-2 rounded-full ${isFault ? "bg-[#EF4444]" : "bg-[#10B981]"}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={() => setIsLogsModalOpen(true)}
              className="mt-4 w-full rounded-md border border-[#1F2937] px-3 py-2 text-xs font-semibold tracking-[0.08em] text-[#9CA3AF] transition-colors duration-150 ease-in-out hover:border-[#3B82F6] hover:text-[#F9FAFB]"
            >
              VIEW FULL LOGS
            </button>
          </div>
        </section>

        <footer className="border-t border-[#1F2937] py-4 text-center text-xs uppercase tracking-[0.14em] text-[#4B5563]">
          DATA STREAM: MOTOR_A_UNIT_04  SYNC STATUS: ACTIVE  ENCRYPTION: AES-256
        </footer>

        {isLogsModalOpen && (
          <div
            className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setIsLogsModalOpen(false)}
          >
            <div
              className="w-full max-w-5xl rounded-xl border border-[#1F2937] bg-[#0B1226] p-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-[#C7D2FE]">Full Logs</h2>
                  <p className="text-xs text-[#9CA3AF]">Showing latest {latestFiftyRows.length} records (max 50)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLogsModalOpen(false)}
                  className="rounded-md border border-[#1F2937] px-3 py-1.5 text-xs font-semibold tracking-[0.08em] text-[#9CA3AF] transition-colors duration-150 ease-in-out hover:border-[#3B82F6] hover:text-[#F9FAFB]"
                >
                  CLOSE
                </button>
              </div>

              <div className="max-h-[68vh] overflow-auto rounded-md border border-[#1F2937]">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-[#0F172A]">
                    <tr>
                      {[
                        "TIME",
                        "RPM",
                        "VOLT",
                        "CURR",
                        "TEMP",
                        "VIB",
                        "FAULT",
                        "EFF",
                        "HEALTH",
                      ].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold tracking-[0.11em] text-[#9CA3AF]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {latestFiftyRows.map((r, i) => {
                      const fault = r.fault || "NORMAL";
                      const palette = getFaultPalette(fault);

                      return (
                        <tr key={r._id || `${r.timestamp || "t"}-${i}`} className={i % 2 === 0 ? "bg-[#111827]" : "bg-[#0F172A]"}>
                          <td className="sensor-value whitespace-nowrap px-3 py-2 text-[#9CA3AF]">{r.timestamp ? new Date(r.timestamp).toLocaleString() : ""}</td>
                          <td className="sensor-value whitespace-nowrap px-3 py-2 text-[#F9FAFB]">{r.rpm ?? ""}</td>
                          <td className="sensor-value whitespace-nowrap px-3 py-2 text-[#F9FAFB]">{r.voltage !== undefined ? Number(r.voltage).toFixed(2) : ""}</td>
                          <td className="sensor-value whitespace-nowrap px-3 py-2 text-[#F9FAFB]">{r.current !== undefined ? Number(r.current).toFixed(2) : ""}</td>
                          <td className="sensor-value whitespace-nowrap px-3 py-2 text-[#F9FAFB]">{r.temperature !== undefined ? Number(r.temperature).toFixed(1) : ""}</td>
                          <td className="sensor-value whitespace-nowrap px-3 py-2 text-[#F9FAFB]">{r.vibration !== undefined ? Number(r.vibration).toFixed(2) : ""}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <span
                              className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em]"
                              style={{
                                borderColor: palette.border,
                                color: palette.text,
                                background: palette.background,
                              }}
                            >
                              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: palette.accent }} />
                              {fault.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="sensor-value whitespace-nowrap px-3 py-2 text-[#F9FAFB]">
                            {r.efficiency !== undefined ? `${Number(r.efficiency).toFixed(1)}%` : ""}
                          </td>
                          <td className="sensor-value whitespace-nowrap px-3 py-2 text-[#F9FAFB]">
                            {r.health_score !== undefined ? Number(r.health_score).toFixed(0) : ""}
                          </td>
                        </tr>
                      );
                    })}
                    {latestFiftyRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-xs uppercase tracking-[0.08em] text-[#6B7280]">
                          No records available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
