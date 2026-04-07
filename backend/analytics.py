from config import (
    collection,
    TEMP_THRESHOLD,
    VIBRATION_THRESHOLD,
    CURRENT_THRESHOLD,
    RPM_STALL,
    RPM_OVERLOAD,
    CONSECUTIVE_READINGS,
    VIBRATION_FAILURE,
    TEMP_FAILURE,
)


# ── Power ──────────────────────────────────────────────────────

def compute_power(voltage: float, current: float) -> float:
    """Power in Watts = voltage × current."""
    return round(voltage * current, 3)


def normalize_vibration(vibration: float) -> float:
    """
    Normalize vibration to the approximate g-scale used by training data.
    Some sensors intermittently send raw/scaled values (e.g. 5.0 or 568.0).
    We repeatedly divide by 10 until the value reaches a plausible range.
    """
    v = abs(float(vibration))

    while v > 2.0:
        v /= 10.0

    return round(v, 4)


# ── Efficiency ─────────────────────────────────────────────────

def compute_efficiency(rpm: int, current: float) -> dict:
    """
    Efficiency indicator = RPM / Current.
    High value → motor running efficiently.
    Low value  → mechanical issue or excess load.
    """
    if rpm == 0 or current == 0:
        return {"score": 0.0, "label": "STALLED", "interpretation": "Motor stalled or no current"}

    score = round(rpm / current, 2)

    if score >= 500:
        label = "HIGH"
        note  = "Motor running efficiently"
    elif score >= 200:
        label = "MEDIUM"
        note  = "Moderate efficiency — monitor load"
    else:
        label = "LOW"
        note  = "Possible mechanical issue or overload"

    return {"score": score, "label": label, "interpretation": note}


def power_state(rpm: int, current: float, voltage: float) -> str:
    """
    Diagnose power condition by comparing power vs RPM vs last reading.
    Returns a short human-readable diagnosis string.
    """
    last = collection.find_one(sort=[("_id", -1)])
    power = voltage * current

    if not last:
        return "Insufficient history"

    last_power = last.get("power", power)
    last_rpm   = last.get("rpm", rpm)
    delta_power = power - last_power
    delta_rpm   = rpm - last_rpm

    if delta_power > 1 and abs(delta_rpm) < 50:
        return "Load increase detected"
    elif delta_power > 1 and delta_rpm < -50:
        return "Overload risk ⚠️"
    elif delta_power < -1 and delta_rpm < -50:
        return "Supply / voltage issue"
    elif abs(delta_power) > 2:
        return "Power fluctuation — check connections"
    return "Stable"


# ── Health Score ───────────────────────────────────────────────

def compute_health(temperature: float, vibration: float, current: float) -> int:
    """Health score 0-100 based on sensor thresholds."""
    health = 100
    if temperature > TEMP_THRESHOLD:
        health -= 20
    if vibration > VIBRATION_THRESHOLD:
        health -= 30
    if current > CURRENT_THRESHOLD:
        health -= 20
    return max(health, 0)


# ── Fault Classification ───────────────────────────────────────

def classify_fault(rpm: int, current: float, temperature: float, vibration: float) -> str:
    """
    Rule-based fault classification (4 fault types):

    STALL        — RPM near zero but current is high (motor stuck)
    BEARING_FAULT— Vibration above threshold (mechanical wear)
    OVERHEATING  — Temperature above threshold (cooling failure)
    OVERLOAD     — Current high while RPM has dropped (excess load)
    NORMAL       — All parameters within safe limits
    """
    if rpm < RPM_STALL and current > CURRENT_THRESHOLD:
        return "STALL"
    elif vibration > VIBRATION_THRESHOLD:
        return "BEARING_FAULT"
    elif temperature > TEMP_THRESHOLD:
        return "OVERHEATING"
    elif current > CURRENT_THRESHOLD and rpm < RPM_OVERLOAD:
        return "OVERLOAD"
    return "NORMAL"


def stable_fault(rpm: int, current: float, temperature: float, vibration: float) -> str:
    """
    Pro-level fault: only report a fault if it appears in the last
    CONSECUTIVE_READINGS records (avoids false alarms from spikes).
    Returns the stable fault string, or "NORMAL" if not persistent.
    """
    # Classify current reading
    current_fault = classify_fault(rpm, current, temperature, vibration)

    if current_fault == "NORMAL":
        return "NORMAL"

    # Fetch last N documents
    recent = list(collection.find(sort=[("_id", -1)], limit=CONSECUTIVE_READINGS))

    if len(recent) < CONSECUTIVE_READINGS:
        # Not enough history yet — trust the single reading
        return current_fault

    # Check all recent readings have the same fault
    all_same = all(r.get("fault") == current_fault for r in recent)
    return current_fault if all_same else "NORMAL"


# ── Early Warning ──────────────────────────────────────────────

def detect_possible_fault(rpm: int, current: float) -> bool:
    """Early warning: current ↑ while rpm ↓ compared to last reading."""
    last = collection.find_one(sort=[("_id", -1)])
    if last:
        return current > last.get("current", 0) and rpm < last.get("rpm", 9999)
    return False


# ── Trend Analysis ─────────────────────────────────────────────

def trend_analysis(records: list) -> dict:
    """Vibration and temperature trend over a list of records (newest first)."""
    if len(records) < 2:
        return {"vibration_trend": "stable", "temperature_trend": "stable"}

    vibs  = [r["vibration"]   for r in records]
    temps = [r["temperature"] for r in records]

    def direction(values):
        if values[0] > values[-1]: return "increasing"
        if values[0] < values[-1]: return "decreasing"
        return "stable"

    return {
        "vibration_trend":   direction(vibs),
        "temperature_trend": direction(temps),
    }


# ── RUL (Remaining Useful Life) ─────────────────────────────────

def _rul_for(current: float, previous: float, failure_threshold: float) -> dict:
    """
    Given current and previous sensor value, estimate cycles until failure.
    RUL = (failure_threshold - current) / rate_of_change
    Returns a dict with numeric rul and a human-readable label.
    """
    rate = current - previous         # change per reading interval
    headroom = failure_threshold - current

    if headroom <= 0:
        return {"value": 0, "label": "FAILED", "rate": round(rate, 4)}
    if rate <= 0:
        return {"value": None, "label": "Stable", "rate": round(rate, 4)}

    rul_cycles = headroom / rate
    return {
        "value": round(rul_cycles, 1),
        "label": f"~{round(rul_cycles)} readings",
        "rate":  round(rate, 4),
    }


def compute_rul(current_vibration: float, current_temp: float) -> dict:
    """
    Compute RUL for vibration and temperature using the last stored reading
    as the previous data point.
    """
    last = collection.find_one(sort=[("_id", -1)])

    if not last:
        return {
            "vibration": {"value": None, "label": "Insufficient data", "rate": 0},
            "temperature": {"value": None, "label": "Insufficient data", "rate": 0},
        }

    return {
        "vibration":   _rul_for(current_vibration, last.get("vibration", current_vibration), VIBRATION_FAILURE),
        "temperature": _rul_for(current_temp,      last.get("temperature", current_temp),    TEMP_FAILURE),
    }
