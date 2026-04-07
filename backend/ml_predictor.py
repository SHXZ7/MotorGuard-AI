"""Runtime ML model manager used by API routes."""

import os
import threading
from collections import Counter

import joblib

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml", "model.pkl")
_STATE_LOCK = threading.RLock()
_model = None
ML_AVAILABLE = False
_FEATURE_COLUMNS = ["rpm", "current", "temperature", "vibration"]


def _load_model():
    """Load model from disk and update module state."""
    global _model, ML_AVAILABLE

    with _STATE_LOCK:
        try:
            _model = joblib.load(_MODEL_PATH)
            ML_AVAILABLE = True
            return {"ok": True, "message": f"ML model loaded from {_MODEL_PATH}"}
        except Exception as e:
            _model = None
            ML_AVAILABLE = False
            return {"ok": False, "message": f"ML model not loaded ({e})"}


def get_model_status() -> dict:
    """Expose current model runtime state."""
    with _STATE_LOCK:
        return {
            "ml_active": ML_AVAILABLE,
            "model_path": _MODEL_PATH,
            "model_type": type(_model).__name__ if _model is not None else None,
            "message": "ML model active" if ML_AVAILABLE else "Using rule-based classifier",
        }


def reload_model() -> dict:
    """Force model reload from model.pkl."""
    result = _load_model()
    status = get_model_status()
    return {"status": "ok" if result["ok"] else "error", "message": result["message"], **status}


def predict_fault_ml(rpm: float, current: float, temperature: float, vibration: float) -> str:
    """Predict fault label from [rpm, current, temperature, vibration]."""
    pred = predict_fault_with_confidence(rpm, current, temperature, vibration)
    return pred["fault"]


def predict_fault_with_confidence(rpm: float, current: float, temperature: float, vibration: float) -> dict:
    """Predict fault + confidence using current in-memory model."""
    with _STATE_LOCK:
        if not ML_AVAILABLE or _model is None:
            return {"fault": None, "confidence": None, "source": "rule-based"}

        features = [[rpm, current, temperature, vibration]]
        if hasattr(_model, "feature_names_in_"):
            try:
                import pandas as pd

                columns = list(getattr(_model, "feature_names_in_", _FEATURE_COLUMNS))
                features = pd.DataFrame(features, columns=columns)
            except Exception:
                # Fallback to plain numeric matrix if pandas is unavailable.
                pass
        fault = str(_model.predict(features)[0])

        confidence = None
        if hasattr(_model, "predict_proba"):
            proba = _model.predict_proba(features)[0]
            confidence = round(float(max(proba)) * 100, 1)

        return {
            "fault": fault,
            "confidence": confidence,
            "source": "ml-model",
        }


def train_model_from_records(records: list[dict], min_records: int = 200) -> dict:
    """
    Train and persist RandomForest model using labeled DB records.
    Expected keys: rpm, current, temperature, vibration, fault.
    """
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.metrics import accuracy_score, f1_score
        from sklearn.model_selection import train_test_split
    except Exception as e:
        return {
            "status": "error",
            "message": f"scikit-learn not available: {e}",
        }

    cleaned = []
    for r in records:
        try:
            fault = r.get("fault")
            if not fault:
                continue
            cleaned.append(
                {
                    "rpm": float(r["rpm"]),
                    "current": float(r["current"]),
                    "temperature": float(r["temperature"]),
                    "vibration": float(r["vibration"]),
                    "fault": str(fault),
                }
            )
        except Exception:
            continue

    if len(cleaned) < min_records:
        return {
            "status": "error",
            "message": f"Not enough labeled records ({len(cleaned)}). Need at least {min_records}.",
        }

    class_counts = Counter(r["fault"] for r in cleaned)
    if len(class_counts) < 2:
        return {
            "status": "error",
            "message": "Training requires at least 2 fault classes.",
            "class_counts": dict(class_counts),
        }

    X = [[r["rpm"], r["current"], r["temperature"], r["vibration"]] for r in cleaned]
    y = [r["fault"] for r in cleaned]

    stratify = y if min(class_counts.values()) >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=stratify,
    )

    model = RandomForestClassifier(
        n_estimators=300,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced_subsample",
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    accuracy = round(float(accuracy_score(y_test, preds)), 4)
    f1_macro = round(float(f1_score(y_test, preds, average="macro", zero_division=0)), 4)

    joblib.dump(model, _MODEL_PATH)

    with _STATE_LOCK:
        global _model, ML_AVAILABLE
        _model = model
        ML_AVAILABLE = True

    return {
        "status": "ok",
        "message": "Model trained and saved.",
        "records_used": len(cleaned),
        "class_counts": dict(class_counts),
        "metrics": {
            "accuracy": accuracy,
            "f1_macro": f1_macro,
        },
        "model_path": _MODEL_PATH,
    }


_load_model()
