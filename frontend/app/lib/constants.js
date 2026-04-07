/* Shared constants used across all pages */

export const SENSOR_META = {
  rpm:         { icon: "⚙️",  unit: "RPM", from: "#8aa8ff", to: "#5d87ff" },
  voltage:     { icon: "⚡",  unit: "V",   from: "#f5be52", to: "#ff8d59" },
  current:     { icon: "🔌",  unit: "A",   from: "#49d6b1", to: "#3dc7dd" },
  temperature: { icon: "🌡️", unit: "°C",  from: "#f48f9b", to: "#f5be52" },
  vibration:   { icon: "📳", unit: "g",   from: "#56a7ff", to: "#4a8dff" },
  power:       { icon: "💡",  unit: "W",   from: "#8aa8ff", to: "#6dcbff" },
};

export const FAULT_STYLES = {
  NORMAL:        { bg: "rgba(66,217,170,0.12)", border: "rgba(66,217,170,0.42)", color: "#7be7c4", emoji: "✅" },
  STALL:         { bg: "rgba(244,143,155,0.14)", border: "rgba(244,143,155,0.42)", color: "#f8b6bf", emoji: "🛑" },
  BEARING_FAULT: { bg: "rgba(248,191,69,0.14)", border: "rgba(248,191,69,0.42)", color: "#ffd68a", emoji: "⚠️" },
  OVERHEATING:   { bg: "rgba(244,143,155,0.14)", border: "rgba(244,143,155,0.42)", color: "#f8b6bf", emoji: "🔥" },
  OVERLOAD:      { bg: "rgba(106,155,255,0.14)", border: "rgba(106,155,255,0.45)", color: "#b8d2ff", emoji: "⚡" },
};

export const TREND_ARROW = {
  increasing: "↗ Increasing",
  decreasing: "↘ Decreasing",
  stable:     "→ Stable",
};
