"use client";

import Navbar from "../components/Navbar";
import { useMotorData } from "../hooks/useMotorData";
import { FAULT_STYLES } from "../lib/constants";

export default function HistoryPage() {
  const { data, loading, error } = useMotorData();
  const live = !error && !loading;

  return (
    <div className="root">
      <Navbar live={live} />
      <main className="main-content">
        {error && <div className="error-banner">⚠️ {error}</div>}

        <h2 className="section-label">Recent Records (Last 50)</h2>

        <div className="card overflow-hidden p-0">
          {loading ? (
            <p className="p-12 text-center text-sm text-[#9CA3AF]">Loading...</p>
          ) : data.length === 0 ? (
            <p className="p-12 text-center text-sm text-[#9CA3AF]">No records yet. POST sensor data to /data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-[#0F172A]">
                  <tr>
                    {["RPM", "Voltage", "Current", "Temp", "Vibration", "Power", "Health", "Efficiency", "Fault", "Time"].map(h => (
                      <th key={h} className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.11em] text-[#9CA3AF]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => {
                    const fs = FAULT_STYLES[r.fault] || FAULT_STYLES.NORMAL;
                    return (
                      <tr key={r._id}
                        className={`${i % 2 === 0 ? "bg-[#111827]" : "bg-[#0F172A]"} hover:bg-[#1B2740]`}>
                        <td className="sensor-value px-3 py-2 text-center text-sm text-[#C4D2EA]">{r.rpm}</td>
                        <td className="sensor-value px-3 py-2 text-center text-sm text-[#C4D2EA]">{Number(r.voltage).toFixed(2)}V</td>
                        <td className="sensor-value px-3 py-2 text-center text-sm text-[#C4D2EA]">{Number(r.current).toFixed(2)}A</td>
                        <td className="sensor-value px-3 py-2 text-center text-sm text-[#C4D2EA]">{Number(r.temperature).toFixed(1)}°C</td>
                        <td className="sensor-value px-3 py-2 text-center text-sm text-[#C4D2EA]">{Number(r.vibration).toFixed(3)}g</td>
                        <td className="sensor-value px-3 py-2 text-center text-sm text-[#C4D2EA]">{r.power !== undefined ? `${Number(r.power).toFixed(2)}W` : "—"}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-bold ${r.health_score >= 80 ? "text-[#7BE7C4]" : r.health_score >= 50 ? "text-[#FFD68A]" : "text-[#F8B6BF]"}`}>
                            {r.health_score ?? "—"}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-[#9DB0CE]">
                          {r.efficiency ? `${r.efficiency.label} (${r.efficiency.score})` : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span style={{ background: fs.bg, border: `1px solid ${fs.border}`, color: fs.color }} className="whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold">
                            {fs.emoji} {(r.fault || "NORMAL").replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="sensor-value px-3 py-2 text-center text-xs text-[#8EA1C2]">
                          {r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
