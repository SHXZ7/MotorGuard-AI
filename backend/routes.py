from fastapi import APIRouter
from fastapi import HTTPException, Query
from datetime import datetime, timezone
import json
import os
import re
import urllib.error
import urllib.request

from models import SensorData, ChatRequest
from config import collection
from config import ML_MIN_CONFIDENCE
from analytics import (
    compute_power,
    compute_efficiency,
    power_state,
    compute_health,
    normalize_vibration,
    stable_fault,
    detect_possible_fault,
    trend_analysis,
    compute_rul,
)
from ml_predictor import (
    predict_fault_with_confidence,
    get_model_status,
    reload_model,
    train_model_from_records,
)

router = APIRouter()

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
RAG_MAX_RECORDS = 5000


def _resolve_fault(rpm, current, temperature, vibration) -> tuple[str, dict]:
    """
    Use ML model if available; fall back to rule-based stable_fault().
    Returns (fault_label, ml_meta_dict).
    """
    ml = predict_fault_with_confidence(rpm, current, temperature, vibration)

    if ml["fault"] is not None and (
        ml["confidence"] is None or ml["confidence"] >= ML_MIN_CONFIDENCE
    ):
        return ml["fault"], {"source": ml["source"], "confidence": ml["confidence"]}
    else:
        # Rule-based fallback
        fault = stable_fault(rpm, current, temperature, vibration)
        return fault, {"source": "rule-based", "confidence": None}


def _predict_for_values(rpm, current, temperature, vibration) -> dict:
    """Centralized prediction with ML confidence gate + rule fallback."""
    fault, fault_meta = _resolve_fault(rpm, current, temperature, vibration)
    return {
        "predicted_fault": fault,
        "source": fault_meta["source"],
        "confidence": fault_meta["confidence"],
    }


def _sensor_view(doc: dict) -> dict:
    """Extract normalized runtime features from a DB document."""
    rpm = int(doc.get("rpm", 0))
    current = float(doc.get("current", 0.0))
    temperature = float(doc.get("temperature", 0.0))
    vibration = normalize_vibration(doc.get("vibration_raw", doc.get("vibration", 0.0)))
    return {
        "rpm": rpm,
        "current": current,
        "temperature": temperature,
        "vibration": vibration,
    }


def _get_groq_api_key() -> str | None:
    key = os.getenv("GROQ_API_KEY")
    if key:
        return key

    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        return None

    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                if k.strip() == "GROQ_API_KEY":
                    return v.strip().strip('"').strip("'")
    except Exception:
        return None

    return None


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9_]+", text.lower()))


def _build_rag_documents(max_records: int = RAG_MAX_RECORDS) -> list[dict]:
    docs = list(collection.find().sort("_id", -1).limit(max_records))
    if not docs:
        return []

    fault_counts = {
        "NORMAL": 0,
        "STALL": 0,
        "BEARING_FAULT": 0,
        "OVERHEATING": 0,
        "OVERLOAD": 0,
    }
    avg_health = 0.0

    rag_docs = []
    for idx, doc in enumerate(docs):
        fault = doc.get("fault", "UNKNOWN")
        if fault in fault_counts:
            fault_counts[fault] += 1
        avg_health += float(doc.get("health_score", 100))

        ts = doc.get("timestamp")
        ts_str = ts.isoformat() if hasattr(ts, "isoformat") else "unknown"

        text = (
            f"record={idx + 1}; timestamp={ts_str}; rpm={doc.get('rpm')}; voltage={doc.get('voltage')}; "
            f"current={doc.get('current')}; temperature={doc.get('temperature')}; vibration={doc.get('vibration')}; "
            f"fault={fault}; fault_source={doc.get('fault_source')}; confidence={doc.get('fault_confidence')}; "
            f"health={doc.get('health_score')}; power={doc.get('power')}; power_state={doc.get('power_state')}; "
            f"possible_fault={doc.get('possible_fault')}; efficiency={doc.get('efficiency')}; rul={doc.get('rul')}"
        )

        rag_docs.append(
            {
                "id": str(doc.get("_id")),
                "text": text,
                "tokens": _tokenize(text),
            }
        )

    avg_health = round(avg_health / len(docs), 2)
    summary = {
        "id": "summary",
        "text": (
            f"dataset_summary: records={len(docs)}; avg_health={avg_health}; "
            f"fault_counts={fault_counts}; latest_fault={docs[0].get('fault')}; "
            f"latest_power_state={docs[0].get('power_state')}; latest_rul={docs[0].get('rul')}"
        ),
        "tokens": _tokenize(
            f"records {len(docs)} avg_health {avg_health} fault_counts {fault_counts} "
            f"latest_fault {docs[0].get('fault')}"
        ),
    }

    return [summary, *rag_docs]


def _retrieve_context(question: str, rag_docs: list[dict], top_k: int) -> list[dict]:
    q_tokens = _tokenize(question)

    scored = []
    for rank, d in enumerate(rag_docs):
        overlap = len(q_tokens.intersection(d["tokens"]))
        recency_bonus = max(0, 0.2 - (rank * 0.002))
        score = overlap + recency_bonus
        scored.append((score, d))

    scored.sort(key=lambda x: x[0], reverse=True)
    selected = [d for score, d in scored[:top_k] if score > 0]
    if not selected:
        return rag_docs[:top_k]
    return selected


def _call_groq(messages: list[dict], api_key: str) -> dict:
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 700,
    }

    req = urllib.request.Request(
        GROQ_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "User-Agent": "MotorGuard-RAG/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=502, detail=f"Groq HTTP error: {detail}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Groq request failed: {e}")


@router.post("/data")
async def receive_data(data: SensorData):
    payload = data.model_dump()

    # Normalize vibration so ML/rules use the same scale as training thresholds.
    normalized_vibration = normalize_vibration(data.vibration)
    payload["vibration_raw"] = data.vibration
    payload["vibration"] = normalized_vibration

    # Fault — ML first, rule-based fallback
    fault, fault_meta           = _resolve_fault(data.rpm, data.current, data.temperature, normalized_vibration)
    payload["fault"]            = fault
    payload["fault_source"]     = fault_meta["source"]
    payload["fault_confidence"] = fault_meta["confidence"]

    # Other analytics
    payload["power"]          = compute_power(data.voltage, data.current)
    payload["efficiency"]     = compute_efficiency(data.rpm, data.current)
    payload["power_state"]    = power_state(data.rpm, data.current, data.voltage)
    payload["health_score"]   = compute_health(data.temperature, normalized_vibration, data.current)
    payload["possible_fault"] = detect_possible_fault(data.rpm, data.current)
    payload["rul"]            = compute_rul(normalized_vibration, data.temperature)
    payload["timestamp"]      = datetime.now(timezone.utc)

    collection.insert_one(payload)
    return {
        "status":           "stored",
        "fault":            payload["fault"],
        "fault_source":     payload["fault_source"],
        "fault_confidence": payload["fault_confidence"],
        "power":            payload["power"],
        "efficiency":       payload["efficiency"],
        "power_state":      payload["power_state"],
        "health_score":     payload["health_score"],
        "possible_fault":   payload["possible_fault"],
        "rul":              payload["rul"],
        "timestamp":        payload["timestamp"].isoformat(),
    }


@router.get("/data")
async def get_data():
    records = []
    for doc in collection.find().sort("_id", -1).limit(50):
        doc["_id"] = str(doc["_id"])
        if "timestamp" in doc and hasattr(doc["timestamp"], "isoformat"):
            doc["timestamp"] = doc["timestamp"].isoformat()
        records.append(doc)
    return records


@router.get("/analytics")
async def get_analytics():
    records = []
    for doc in collection.find().sort("_id", -1).limit(20):
        doc["_id"] = str(doc["_id"])
        if "timestamp" in doc and hasattr(doc["timestamp"], "isoformat"):
            doc["timestamp"] = doc["timestamp"].isoformat()
        records.append(doc)

    if not records:
        return {"message": "No data yet"}

    return {
        "latest":        records[0],
        "trend":         trend_analysis(records),
        "ml_active":     get_model_status()["ml_active"],
        "total_records": collection.count_documents({}),
        "avg_health":    round(sum(r.get("health_score", 100) for r in records) / len(records), 1),
        "fault_counts":  {
            fault: sum(1 for r in records if r.get("fault") == fault)
            for fault in ["NORMAL", "STALL", "BEARING_FAULT", "OVERHEATING", "OVERLOAD"]
        },
    }


@router.get("/predict/latest")
async def predict_latest():
    """Predict fault from the newest DB record using current model state."""
    doc = collection.find_one(sort=[("_id", -1)])
    if not doc:
        return {"message": "No data yet"}

    sensor = _sensor_view(doc)
    pred = _predict_for_values(**sensor)
    timestamp = doc.get("timestamp")

    return {
        "record_id": str(doc.get("_id")),
        "timestamp": timestamp.isoformat() if hasattr(timestamp, "isoformat") else None,
        **sensor,
        **pred,
    }


@router.get("/predict/recent")
async def predict_recent(limit: int = Query(default=20, ge=1, le=200)):
    """Predict for latest N DB records for monitoring and drift checks."""
    docs = list(collection.find().sort("_id", -1).limit(limit))
    if not docs:
        return {"records": []}

    records = []
    for doc in docs:
        sensor = _sensor_view(doc)
        pred = _predict_for_values(**sensor)
        timestamp = doc.get("timestamp")
        records.append(
            {
                "record_id": str(doc.get("_id")),
                "timestamp": timestamp.isoformat() if hasattr(timestamp, "isoformat") else None,
                **sensor,
                **pred,
            }
        )

    return {"records": records, "count": len(records)}


@router.post("/model/reload")
async def model_reload():
    """Reload model.pkl into memory without restarting API."""
    result = reload_model()
    if result["status"] != "ok":
        raise HTTPException(status_code=500, detail=result)
    return result


@router.post("/model/retrain-from-db")
async def model_retrain_from_db(min_records: int = Query(default=300, ge=50, le=100000)):
    """Retrain model using labeled records currently stored in MongoDB."""
    docs = list(
        collection.find(
            {"fault": {"$exists": True, "$ne": None}},
            {
                "_id": 0,
                "rpm": 1,
                "current": 1,
                "temperature": 1,
                "vibration": 1,
                "fault": 1,
            },
        )
    )

    result = train_model_from_records(docs, min_records=min_records)
    if result["status"] != "ok":
        raise HTTPException(status_code=400, detail=result)
    return result


@router.get("/model-status")
async def model_status():
    """Quick endpoint to check if the ML model is loaded."""
    status = get_model_status()
    status["ml_min_confidence"] = ML_MIN_CONFIDENCE
    return status


@router.get("/ai/context")
async def ai_context_preview(limit: int = Query(default=5, ge=1, le=20)):
    """Preview what context RAG can access from backend database."""
    rag_docs = _build_rag_documents()
    if not rag_docs:
        return {"message": "No records available for RAG yet."}

    return {
        "records_available": len(rag_docs) - 1,
        "preview": [d["text"] for d in rag_docs[:limit]],
    }


@router.post("/ai/chat")
async def ai_chat(req: ChatRequest):
    """Answer questions using Groq LLM with retrieval over backend DB records."""
    api_key = _get_groq_api_key()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY not configured. Set it in environment or backend/.env.",
        )

    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    rag_docs = _build_rag_documents()
    if not rag_docs:
        return {
            "answer": "No backend records are available yet. Send sensor data first, then ask again.",
            "sources": [],
            "records_scanned": 0,
        }

    top_k = max(3, min(15, int(req.top_k)))
    selected = _retrieve_context(question, rag_docs, top_k=top_k)
    context_block = "\n\n".join(f"[{i+1}] {d['text']}" for i, d in enumerate(selected))

    messages = [
        {
            "role": "system",
            "content": (
                "You are MotorGuard AI assistant. Use only the provided backend context. "
                "If context is insufficient, clearly say what is missing. "
                "Answer with concise, practical diagnostics."
            ),
        },
        {
            "role": "system",
            "content": f"Backend RAG context:\n{context_block}",
        },
    ]

    for turn in req.history[-8:]:
        role = turn.role if turn.role in {"user", "assistant"} else "user"
        messages.append({"role": role, "content": turn.content})

    messages.append({"role": "user", "content": question})

    groq = _call_groq(messages, api_key)
    choices = groq.get("choices", [])
    answer = "No response returned by model."
    if choices:
        answer = choices[0].get("message", {}).get("content", answer)

    return {
        "answer": answer,
        "sources": [d["id"] for d in selected],
        "records_scanned": len(rag_docs) - 1,
        "context_used": len(selected),
        "model": GROQ_MODEL,
    }
