import os
from pathlib import Path

from pymongo import MongoClient

try:
	from dotenv import load_dotenv
except ImportError:
	load_dotenv = None

# ── MongoDB ────────────────────────────────────────────────────
# Load .env from backend directory when python-dotenv is available.
if load_dotenv is not None:
	load_dotenv(Path(__file__).with_name(".env"))

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
	raise RuntimeError("MONGO_URI is not set. Add it to backend/.env or environment variables.")

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
