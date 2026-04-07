"use client";

import { useEffect, useState } from "react";

const THRESHOLDS = {
  temp: 50,
  vib: 1.2,
  current: 2.0,
  rpmStall: 100,
  rpmOverload: 1000,
};

function normalizeVibration(vibration) {
  let v = Math.abs(Number(vibration ?? 0));
  while (v > 2.0) v /= 10.0;
  return Number(v.toFixed(4));
}

function deriveEfficiency(rpm, current) {
  const safeRpm = Number(rpm ?? 0);
  const safeCurrent = Number(current ?? 0);

  if (safeRpm === 0 || safeCurrent === 0) {
    return {
      score: 0,
      label: "STALLED",
      interpretation: "Motor stalled or no current",
    };
  }

  const score = Number((safeRpm / safeCurrent).toFixed(2));
  if (score >= 500) {
    return { score, label: "HIGH", interpretation: "Motor running efficiently" };
  }
  if (score >= 200) {
    return { score, label: "MEDIUM", interpretation: "Moderate efficiency — monitor load" };
  }
  return {
    score,
    label: "LOW",
    interpretation: "Possible mechanical issue or overload",
  };
}

function deriveFault(record) {
  const rpm = Number(record?.rpm ?? 0);
  const current = Number(record?.current ?? 0);
  const temperature = Number(record?.temperature ?? 0);
  const vibration = normalizeVibration(record?.vibration_raw ?? record?.vibration ?? 0);

  if (rpm < THRESHOLDS.rpmStall && current > THRESHOLDS.current) return "STALL";
  if (vibration > THRESHOLDS.vib) return "BEARING_FAULT";
  if (temperature > THRESHOLDS.temp) return "OVERHEATING";
  if (current > THRESHOLDS.current && rpm < THRESHOLDS.rpmOverload) return "OVERLOAD";
  return "NORMAL";
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function deriveFaultConfidence(record, fault) {
  const rpm = Number(record?.rpm ?? 0);
  const current = Number(record?.current ?? 0);
  const temperature = Number(record?.temperature ?? 0);
  const vibration = normalizeVibration(record?.vibration_raw ?? record?.vibration ?? 0);

  let strength = 0;

  if (fault === "STALL") {
    const rpmLow = clamp01((THRESHOLDS.rpmStall - rpm) / THRESHOLDS.rpmStall);
    const currentHigh = clamp01((current - THRESHOLDS.current) / THRESHOLDS.current);
    strength = (rpmLow + currentHigh) / 2;
    return Math.round(70 + strength * 30);
  }

  if (fault === "BEARING_FAULT") {
    strength = clamp01((vibration - THRESHOLDS.vib) / THRESHOLDS.vib);
    return Math.round(70 + strength * 30);
  }

  if (fault === "OVERHEATING") {
    strength = clamp01((temperature - THRESHOLDS.temp) / THRESHOLDS.temp);
    return Math.round(70 + strength * 30);
  }

  if (fault === "OVERLOAD") {
    const currentHigh = clamp01((current - THRESHOLDS.current) / THRESHOLDS.current);
    const rpmLow = clamp01((THRESHOLDS.rpmOverload - rpm) / THRESHOLDS.rpmOverload);
    strength = (currentHigh + rpmLow) / 2;
    return Math.round(70 + strength * 30);
  }

  const vibSafe = clamp01((THRESHOLDS.vib - vibration) / THRESHOLDS.vib);
  const tempSafe = clamp01((THRESHOLDS.temp - temperature) / THRESHOLDS.temp);
  const currentSafe = clamp01((THRESHOLDS.current - current) / THRESHOLDS.current);
  const rpmSafe = clamp01((rpm - THRESHOLDS.rpmStall) / THRESHOLDS.rpmStall);
  const safeStrength = (vibSafe + tempSafe + currentSafe + rpmSafe) / 4;
  return Math.round(60 + safeStrength * 40);
}

function enrichRecord(record) {
  const efficiency = record?.efficiency ?? deriveEfficiency(record?.rpm, record?.current);
  const fault = record?.fault ?? deriveFault(record);
  const confidence =
    record?.fault_confidence !== undefined && record?.fault_confidence !== null
      ? Number(record.fault_confidence)
      : deriveFaultConfidence(record, fault);

  return {
    ...record,
    vibration: normalizeVibration(record?.vibration_raw ?? record?.vibration),
    efficiency,
    fault,
    fault_source: record?.fault_source ?? "db-derived",
    fault_confidence: Math.max(0, Math.min(100, Number.isFinite(confidence) ? confidence : 0)),
  };
}

export function useMotorData() {
  const [data, setData]           = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = async () => {
    try {
      const [dr, ar, pr] = await Promise.all([
        fetch("http://localhost:8000/data"),
        fetch("http://localhost:8000/analytics"),
        fetch("http://localhost:8000/predict/latest").catch(() => null),
      ]);
      if (!dr.ok) throw new Error();

      const rawRecords = await dr.json();
      const records = Array.isArray(rawRecords) ? rawRecords.map(enrichRecord) : [];
      const analyticsData = ar.ok ? await ar.json() : null;

      let latestPrediction = null;
      if (pr && pr.ok) {
        latestPrediction = await pr.json();
      }

      if (records.length > 0 && latestPrediction?.predicted_fault) {
        records[0] = {
          ...records[0],
          fault: latestPrediction.predicted_fault,
          fault_source: latestPrediction.source ?? records[0].fault_source,
          fault_confidence: latestPrediction.confidence ?? records[0].fault_confidence ?? 0,
        };
      }

      setData(records);
      setAnalytics(analyticsData);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      setError("Cannot connect to backend on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 3000);
    return () => clearInterval(iv);
  }, []);

  return { data, analytics, loading, error, lastUpdated, latest: data[0] };
}
