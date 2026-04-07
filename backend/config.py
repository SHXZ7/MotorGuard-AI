from pymongo import MongoClient

# ── MongoDB ────────────────────────────────────────────────────
MONGO_URI = "mongodb+srv://shaaz:shaaz123@cluster0.qa1to9l.mongodb.net/motorDB?retryWrites=true&w=majority"

client = MongoClient(MONGO_URI)
db = client.motorDB
collection = db.data

# ── Thresholds ─────────────────────────────────────────────────
TEMP_THRESHOLD          = 50.0   # °C  — overheating
VIBRATION_THRESHOLD     = 1.2    # g   — bearing fault (aligned to live sensor range)
CURRENT_THRESHOLD       = 2.0    # A   — overload / stall
RPM_STALL               = 100    # rpm — stall detection
RPM_OVERLOAD            = 1000   # rpm — overload detection

# ── ML confidence gate ────────────────────────────────────────
ML_MIN_CONFIDENCE       = 75.0   # below this, use rule-based fallback

# ── RUL Failure Thresholds ─────────────────────────────────────
VIBRATION_FAILURE       = 1.5    # g   — motor considered failed (RUL fail threshold)
TEMP_FAILURE            = 80.0   # °C  — motor considered failed

# ── Stability window ───────────────────────────────────────────
CONSECUTIVE_READINGS    = 5      # fault must persist this many readings
