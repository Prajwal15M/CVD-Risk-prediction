from pathlib import Path
import io
import json
import pickle
import traceback
from typing import Any, Dict, Optional

import joblib
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

try:
    import xgboost as xgb
except Exception:  # pragma: no cover - depends on environment
    xgb = None

try:
    import lightgbm as lgb
except Exception:  # pragma: no cover - depends on environment
    lgb = None

try:
    import tensorflow as tf
except Exception as exc:  # pragma: no cover - depends on environment
    tf = None
    TENSORFLOW_IMPORT_ERROR = str(exc)
else:
    TENSORFLOW_IMPORT_ERROR = None

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "cvd_models"
IMAGE_MODEL_PATH = BASE_DIR / "cvd_model_improved.keras"
MODEL_CONFIG_PATH = MODELS_DIR / "model_config.json"
DEFAULT_CONFIG = {"img_size": [224, 224], "class_names": ["Low", "Medium", "High"]}

MODEL_BACKEND = "unknown"
app = FastAPI(title="CVD Risk Prediction API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "model_backend": MODEL_BACKEND}

@app.get("/health")
async def health():
    return {"status": "ok", "model_backend": MODEL_BACKEND}

print("Loading models...")
config = DEFAULT_CONFIG.copy()
if MODEL_CONFIG_PATH.exists():
    try:
        with open(MODEL_CONFIG_PATH, "r", encoding="utf-8") as f:
            config.update(json.load(f))
    except Exception as exc:
        print(f"Model config could not be loaded: {exc}")


def _load_tabular_bundle():
    if not MODEL_CONFIG_PATH.exists():
        return None

    try:
        with open(MODEL_CONFIG_PATH, "r", encoding="utf-8") as f:
            model_config = json.load(f)
    except Exception as exc:
        print(f"Tabular model config could not be loaded: {exc}")
        return None

    bundle = {"config": model_config}

    xgb_path = MODELS_DIR / "xgb_cvd_model.json"
    if xgb_path.exists() and xgb is not None:
        try:
            xgb_model = xgb.XGBClassifier()
            xgb_model.load_model(str(xgb_path))
            bundle["xgb_model"] = xgb_model
        except Exception as exc:
            print(f"XGBoost model could not be loaded: {exc}")

    lgb_path = MODELS_DIR / "lgb_cvd_model.txt"
    if lgb_path.exists() and lgb is not None:
        try:
            bundle["lgb_model"] = lgb.Booster(model_file=str(lgb_path))
        except Exception as exc:
            print(f"LightGBM model could not be loaded: {exc}")

    rf_path = MODELS_DIR / "rf_cvd_model.pkl"
    if rf_path.exists():
        try:
            bundle["rf_model"] = joblib.load(str(rf_path))
        except Exception as exc:
            print(f"RandomForest model could not be loaded: {exc}")

    mlp_path = MODELS_DIR / "mlp_cvd_model.pkl"
    if mlp_path.exists():
        try:
            bundle["mlp_model"] = joblib.load(str(mlp_path))
        except Exception as exc:
            print(f"MLP model could not be loaded: {exc}")

    scaler_path = MODELS_DIR / "robust_scaler.pkl"
    if scaler_path.exists():
        try:
            bundle["scaler"] = joblib.load(str(scaler_path))
        except Exception as exc:
            print(f"Scaler could not be loaded: {exc}")

    if len(bundle) <= 1:
        return None
    return bundle


image_model = None
if tf is not None:
    try:
        image_model = tf.keras.models.load_model(str(IMAGE_MODEL_PATH), compile=False)
        print("TensorFlow image model loaded successfully!")
    except Exception as exc:
        print(f"TensorFlow model loading failed: {exc}")
        image_model = None
else:
    print(f"TensorFlow is unavailable: {TENSORFLOW_IMPORT_ERROR}")

try:
    tabular_bundle = _load_tabular_bundle()
except Exception as exc:
    print(f"Tabular bundle load failed: {exc}")
    tabular_bundle = None

MODEL_BACKEND = "tensorflow" if image_model is not None else "heuristic"
print(f"Using {MODEL_BACKEND} backend for image inference.")


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _coerce_payload(patient_data: Optional[str]) -> Dict[str, Any]:
    if not patient_data:
        return {}
    try:
        parsed = json.loads(patient_data)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="patient_data must be valid JSON") from exc

    if isinstance(parsed, dict):
        return parsed
    raise HTTPException(status_code=400, detail="patient_data must be an object")


def _heuristic_image_risk(img_array: np.ndarray, payload: Dict[str, Any]) -> Dict[str, Any]:
    gray = np.mean(img_array, axis=-1)
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    edge_density = float(np.mean(np.abs(np.diff(gray, axis=0))))

    score = 0.45 + (contrast / 255.0) * 0.25 + (edge_density / 255.0) * 0.20
    if brightness < 90:
        score += 0.10
    if payload.get("diabetes") == 1:
        score += 0.08
    if payload.get("currentSmoker") == 1:
        score += 0.07
    if payload.get("sysBP", 0) > 140:
        score += 0.08

    score = min(0.99, max(0.05, score))
    class_names = config["class_names"]
    if score >= 0.75:
        risk = class_names[2]
        probabilities = {class_names[0]: 10.0, class_names[1]: 25.0, class_names[2]: 65.0}
    elif score >= 0.45:
        risk = class_names[1]
        probabilities = {class_names[0]: 20.0, class_names[1]: 55.0, class_names[2]: 25.0}
    else:
        risk = class_names[0]
        probabilities = {class_names[0]: 70.0, class_names[1]: 25.0, class_names[2]: 5.0}

    return {
        "risk": risk,
        "confidence": round(score * 100, 2),
        "probabilities": probabilities,
    }


def _fallback_tabular_risk(payload: Dict[str, Any]) -> Dict[str, Any]:
    score = 0.45
    if payload.get("age", 0) > 55:
        score += 0.12
    if payload.get("sysBP", 0) > 140:
        score += 0.15
    if payload.get("totChol", 0) > 220:
        score += 0.10
    if payload.get("glucose", 0) > 120:
        score += 0.08
    if payload.get("currentSmoker") == 1:
        score += 0.10
    if payload.get("diabetes") == 1:
        score += 0.10
    score = min(0.99, max(0.05, score))
    risk = "High" if score >= 0.7 else "Low"
    return {
        "risk": risk,
        "confidence": round(score * 100, 2),
    }


def _build_feature_vector(payload: Dict[str, Any], feature_columns: list[str]) -> np.ndarray:
    normalized: Dict[str, float] = {}
    for key, value in payload.items():
        normalized[key] = _to_float(value)

    if "male" not in normalized and "gender" in normalized:
        normalized["male"] = 1.0 if str(normalized["gender"]).lower() == "male" else 0.0

    if "currentSmoker" not in normalized and "smoking" in normalized:
        normalized["currentSmoker"] = 1.0 if str(normalized["smoking"]).lower() == "current" else 0.0

    if "diabetes" not in normalized and "diabetes_history" in normalized:
        normalized["diabetes"] = 1.0 if str(normalized["diabetes_history"]).lower() in {"yes", "true", "1"} else 0.0

    if "pulse_pressure" not in normalized:
        sys_bp = normalized.get("sysBP", 0.0)
        dia_bp = normalized.get("diaBP", 0.0)
        normalized["pulse_pressure"] = sys_bp - dia_bp

    if "chol_age_ratio" not in normalized:
        age = normalized.get("age", 0.0)
        tot_chol = normalized.get("totChol", 0.0)
        normalized["chol_age_ratio"] = (tot_chol / age) if age else 0.0

    if "hyp_diabetes" not in normalized:
        normalized["hyp_diabetes"] = normalized.get("prevalentHyp", 0.0) + normalized.get("diabetes", 0.0)

    if "smoker_intensity" not in normalized:
        normalized["smoker_intensity"] = normalized.get("currentSmoker", 0.0)

    vector = []
    for feature_name in feature_columns:
        if feature_name in normalized:
            vector.append(normalized[feature_name])
        else:
            vector.append(0.0)
    return np.array([vector], dtype=float)


def _predict_tabular(payload: Dict[str, Any], bundle: Dict[str, Any]) -> Dict[str, Any]:
    feature_columns = bundle.get("config", {}).get("feature_columns", [])
    if not feature_columns:
        return {}

    X_p = _build_feature_vector(payload, feature_columns)
    results = {}

    if "xgb_model" in bundle:
        try:
            results["XGBoost"] = float(bundle["xgb_model"].predict_proba(X_p)[:, 1][0])
        except Exception:
            pass

    if "lgb_model" in bundle:
        try:
            preds = bundle["lgb_model"].predict(X_p)
            results["LightGBM"] = float(preds[0])
        except Exception:
            pass

    if "rf_model" in bundle:
        try:
            results["RandomForest"] = float(bundle["rf_model"].predict_proba(X_p)[:, 1][0])
        except Exception:
            pass

    if "mlp_model" in bundle and "scaler" in bundle:
        try:
            X_scaled = bundle["scaler"].transform(X_p)
            results["MLP"] = float(bundle["mlp_model"].predict_proba(X_scaled)[:, 1][0])
        except Exception:
            pass

    if not results:
        return {}

    weights = bundle.get("config", {}).get("ensemble_weights", {})
    key_map = {"XGBoost": "xgb", "LightGBM": "lgb", "MLP": "mlp", "RandomForest": "rf"}
    total_weight = 0.0
    weighted_sum = 0.0
    for name, prob in results.items():
        weight = float(weights.get(key_map.get(name, ""), 1.0))
        total_weight += weight
        weighted_sum += weight * prob

    ensemble_proba = float(weighted_sum / total_weight) if total_weight > 0 else float(np.mean(list(results.values())))
    threshold = float(bundle.get("config", {}).get("optimal_threshold", 0.5))
    label = "High" if ensemble_proba >= threshold else "Low"
    return {
        "risk": label,
        "confidence": round(ensemble_proba * 100, 2),
        "breakdown": results,
        "threshold": threshold,
    }


@app.post("/predict")
async def predict(
    image: UploadFile = File(...),
    patient_data: Optional[str] = Form(default=None),
):
    try:
        img_data = await image.read()
        try:
            img = Image.open(io.BytesIO(img_data)).convert("RGB")
        except Exception:
            img = Image.new("RGB", (224, 224), color=(255, 255, 255))
        img = img.resize(tuple(config.get("img_size", DEFAULT_CONFIG["img_size"])))
        img_array = np.array(img, dtype=np.float32) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        payload = _coerce_payload(patient_data)
        if image_model is not None:
            image_pred = image_model.predict(img_array, verbose=0)
            image_pred_probs = image_pred[0]
            image_class = int(np.argmax(image_pred_probs))
            image_confidence = float(np.max(image_pred_probs))
            image_risk = config["class_names"][image_class]
            image_result = {
                "risk": image_risk,
                "confidence": round(image_confidence * 100, 2),
                "probabilities": {
                    config["class_names"][i]: round(float(image_pred_probs[i]) * 100, 2)
                    for i in range(len(config["class_names"]))
                },
            }
        else:
            image_result = _heuristic_image_risk(img_array[0], payload)
            image_confidence = image_result["confidence"] / 100.0
            image_risk = image_result["risk"]

        if tabular_bundle is not None:
            tabular_result = _predict_tabular(payload, tabular_bundle)
            tabular_confidence = tabular_result["confidence"] / 100.0 if tabular_result else 0.0
            if not tabular_result:
                tabular_result = _fallback_tabular_risk(payload)
                tabular_confidence = tabular_result["confidence"] / 100.0
        else:
            tabular_result = _fallback_tabular_risk(payload)
            tabular_confidence = tabular_result["confidence"] / 100.0

        combined_score = (image_confidence * 0.6) + (tabular_confidence * 0.4)
        if combined_score >= 0.72:
            final_risk = "High"
        elif combined_score >= 0.55:
            final_risk = "Medium"
        else:
            final_risk = "Low"

        return {
            "image_model": image_result,
            "tabular_model": tabular_result,
            "combined": {
                "risk": final_risk,
                "confidence": round(combined_score * 100, 2),
            },
            "model_backend": MODEL_BACKEND,
        }
    except Exception as exc:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc)) from exc
