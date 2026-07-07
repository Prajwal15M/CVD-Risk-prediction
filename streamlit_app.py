import json
import os
import joblib

import pandas as pd
import streamlit as st
import tensorflow as tf
import xgboost as xgb
import lightgbm as lgb
import numpy as np

# ── Config ──────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(__file__)
IMAGE_MODEL_PATH = os.path.join(BASE_DIR, "cvd_model_improved.keras")
CVD_MODELS_DIR = os.path.join(BASE_DIR, "cvd_models")
ENSEMBLE_BUNDLE_PATH = os.path.join(CVD_MODELS_DIR, "cvd_ensemble.pkl")
MODEL_CONFIG_PATH = os.path.join(CVD_MODELS_DIR, "model_config.json")
IMG_SIZE = (224, 224)
CLASS_NAMES = ["Low", "Medium", "High"]
LOW_CONFIDENCE_THRESHOLD = 0.50

st.set_page_config(page_title="CVD Risk Classifier", page_icon="🫀", layout="centered")


def load_keras_model(model_path: str):
    if not os.path.exists(model_path):
        return None
    try:
        return tf.keras.models.load_model(model_path)
    except Exception:
        return None


@st.cache_resource
def load_tabular_bundle(bundle_path: str):
    if not os.path.exists(bundle_path):
        return None
    try:
        bundle = joblib.load(bundle_path)
        if isinstance(bundle, dict) and "config" in bundle:
            return bundle
    except Exception:
        return None
    return None


@st.cache_resource
def load_tabular_components():
    if not os.path.exists(MODEL_CONFIG_PATH):
        return None

    try:
        with open(MODEL_CONFIG_PATH, "r") as f:
            config = json.load(f)
    except Exception:
        return None

    bundle = {"config": config}

    xgb_path = os.path.join(CVD_MODELS_DIR, "xgb_cvd_model.json")
    if os.path.exists(xgb_path):
        try:
            xgb_model = xgb.XGBClassifier()
            xgb_model.load_model(xgb_path)
            bundle["xgb_model"] = xgb_model
        except Exception:
            pass

    lgb_path = os.path.join(CVD_MODELS_DIR, "lgb_cvd_model.txt")
    if os.path.exists(lgb_path):
        try:
            bundle["lgb_model"] = lgb.Booster(model_file=lgb_path)
        except Exception:
            pass

    rf_path = os.path.join(CVD_MODELS_DIR, "rf_cvd_model.pkl")
    if os.path.exists(rf_path):
        try:
            bundle["rf_model"] = joblib.load(rf_path)
        except Exception:
            pass

    mlp_path = os.path.join(CVD_MODELS_DIR, "mlp_cvd_model.pkl")
    if os.path.exists(mlp_path):
        try:
            bundle["mlp_model"] = joblib.load(mlp_path)
        except Exception:
            pass

    scaler_path = os.path.join(CVD_MODELS_DIR, "robust_scaler.pkl")
    if os.path.exists(scaler_path):
        try:
            bundle["scaler"] = joblib.load(scaler_path)
        except Exception:
            pass

    if len(bundle) <= 1:
        return None
    return bundle


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["age_years"] = df["age"] / 365.25
    df["age_decade"] = (df["age_years"] // 10).astype(int)
    df["bmi"] = df["weight"] / ((df["height"] / 100) ** 2)
    df["bmi_category"] = pd.cut(
        df["bmi"],
        bins=[0, 18.5, 25, 30, 100],
        labels=[0, 1, 2, 3],
    ).astype(int)
    df["pulse_pressure"] = df["ap_hi"] - df["ap_lo"]
    df["map"] = (df["ap_hi"] + 2 * df["ap_lo"]) / 3
    df["bp_ratio"] = df["ap_hi"] / df["ap_lo"]
    df["hypertension"] = ((df["ap_hi"] >= 140) | (df["ap_lo"] >= 90)).astype(int)
    df["prehypertension"] = (((df["ap_hi"] >= 120) & (df["ap_hi"] < 140)) |
                               ((df["ap_lo"] >= 80) & (df["ap_lo"] < 90))).astype(int)
    df["stage2_htn"] = ((df["ap_hi"] >= 160) | (df["ap_lo"] >= 100)).astype(int)
    df["lifestyle_risk"] = df["smoke"] + df["alco"] + (1 - df["active"])
    df["age_bmi"] = df["age_years"] * df["bmi"]
    df["age_bp"] = df["age_years"] * df["ap_hi"]
    df["chol_gluc"] = df["cholesterol"] * df["gluc"]
    df["bp_bmi"] = df["ap_hi"] * df["bmi"]
    df["metabolic_risk"] = (
        (df["bmi"] > 30).astype(int) +
        (df["cholesterol"] > 1).astype(int) +
        (df["gluc"] > 1).astype(int) +
        df["hypertension"]
    )
    return df


def predict_tabular(patient_data: dict, bundle: dict) -> dict:
    df_p = pd.DataFrame([patient_data])
    df_p = engineer_features(df_p)
    feature_cols = bundle["config"]["feature_columns"]
    X_p = df_p[feature_cols]

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

    weights = bundle["config"].get("ensemble_weights", {})
    key_map = {"XGBoost": "xgb", "LightGBM": "lgb", "MLP": "mlp", "RandomForest": "rf"}
    total_weight = 0.0
    weighted_sum = 0.0
    for name, prob in results.items():
        weight = float(weights.get(key_map.get(name, ""), 1.0))
        total_weight += weight
        weighted_sum += weight * prob

    ensemble_proba = float(weighted_sum / total_weight) if total_weight > 0 else float(np.mean(list(results.values())))
    threshold = float(bundle["config"].get("optimal_threshold", 0.5))
    label = "High" if ensemble_proba >= threshold else "Low"
    return {
        "ensemble_probability": ensemble_proba,
        "label": label,
        "breakdown": results,
        "threshold": threshold,
    }


def build_combined_conclusion(image_result, tabular_result):
    if image_result is None or tabular_result is None:
        return "Both image and tabular predictions are required for a combined conclusion."

    image_label = image_result["class"]
    image_conf = image_result["confidence"]
    tabular_label = tabular_result["label"]
    tabular_prob = tabular_result["ensemble_probability"]

    if image_label == "High" and tabular_label == "High":
        return (
            f"Final conclusion: HIGH RISK. Both the image model ({image_label}, "
            f"{image_conf:.1%}) and the tabular model ({tabular_label}, "
            f"{tabular_prob:.1%}) agree on elevated cardiovascular risk."
        )

    if image_label == "Low" and tabular_label == "Low":
        return (
            f"Final conclusion: LOW RISK. Both models are aligned: image model "
            f"({image_label}, {image_conf:.1%}) and tabular model ({tabular_label}, "
            f"{tabular_prob:.1%})."
        )

    if image_label == "High" or tabular_label == "High":
        return (
            f"Final conclusion: ELEVATED RISK WARNING. The image model predicts "
            f"{image_label} risk ({image_conf:.1%}) and the tabular model predicts "
            f"{tabular_label} risk ({tabular_prob:.1%}). Consider the higher-risk "
            "signal as the priority."
        )

    if image_label == "Medium" and tabular_label == "Medium":
        return (
            f"Final conclusion: MODERATE RISK. Both the image model ({image_label}, "
            f"{image_conf:.1%}) and the tabular model ({tabular_label}, {tabular_prob:.1%}) "
            "point toward a moderate level of cardiovascular risk."
        )

    return (
        f"Final conclusion: MIXED RISK SIGNAL. The image model predicts {image_label} "
        f"risk ({image_conf:.1%}) while the tabular model predicts {tabular_label} "
        f"risk ({tabular_prob:.1%}). Review both outputs carefully."
    )


image_model = load_keras_model(IMAGE_MODEL_PATH)
cvd_bundle = load_tabular_bundle(ENSEMBLE_BUNDLE_PATH) or load_tabular_components()

st.title("🫀 CVD Risk Classifier")
st.caption("Retinal fundus image → cardiovascular risk tier (research prototype)")

st.warning(
    ""
)

if image_model is None:
    st.error(f"Image model not found: {IMAGE_MODEL_PATH}. Please make sure the updated image model is present in the project root.")

if cvd_bundle is None:
    st.warning(
        f"Tabular CVD bundle not found in {CVD_MODELS_DIR}. The second model will be unavailable until the updated model files are present."
    )

image_result = None
col1, col2 = st.columns(2)

with col1:
    st.header("Image model")
    uploaded_file = st.file_uploader(
        "Upload a retinal fundus photograph", type=["jpg", "jpeg", "png"]
    )
    if uploaded_file is not None:
        if image_model is None:
            st.error(f"Image model is unavailable. Please add the updated image model at {IMAGE_MODEL_PATH}.")
        else:
            file_bytes = uploaded_file.read()
            image_tensor = tf.image.decode_image(file_bytes, channels=3, expand_animations=False)
            image_tensor.set_shape([None, None, 3])
            st.image(image_tensor.numpy(), caption="Uploaded image", use_column_width=True)

            img_resized = tf.image.resize(image_tensor, IMG_SIZE)
            img_array = tf.cast(img_resized, tf.float32)
            img_batch = tf.expand_dims(img_array, axis=0)

            with st.spinner("Analyzing image..."):
                probs = image_model.predict(img_batch, verbose=0)[0]
            pred_idx = int(np.argmax(probs))
            result_class = CLASS_NAMES[pred_idx]
            confidence = float(probs[pred_idx])
            image_result = {
                "class": result_class,
                "confidence": confidence,
                "probs": {cls: float(p) for cls, p in zip(CLASS_NAMES, probs)},
            }

            st.info(
                "Fill all information in the tabular form to get a combined prediction from both models."
            )
    else:
        st.info("Upload an image here and then fill the tabular form to get a combined prediction.")

with col2:
    st.header("Tabular CVD model")
    st.write("Use the clinical feature form to predict CVD risk from `cvd_models`.")
    with st.form("tabular_form"):
        age_years = st.number_input("Age (years)", min_value=0, max_value=120, value=55)
        gender = st.selectbox("Gender", options=[0, 1], format_func=lambda x: "Female" if x == 0 else "Male")
        height = st.number_input("Height (cm)", min_value=130, max_value=220, value=170)
        weight = st.number_input("Weight (kg)", min_value=30.0, max_value=200.0, value=70.0)
        ap_hi = st.number_input("Systolic BP (ap_hi)", min_value=60, max_value=250, value=120)
        ap_lo = st.number_input("Diastolic BP (ap_lo)", min_value=40, max_value=200, value=80)
        cholesterol = st.selectbox("Cholesterol", options=[1, 2, 3])
        gluc = st.selectbox("Glucose", options=[1, 2, 3])
        smoke = st.selectbox("Smoke", options=[0, 1], format_func=lambda x: "No" if x == 0 else "Yes")
        alco = st.selectbox("Alcohol", options=[0, 1], format_func=lambda x: "No" if x == 0 else "Yes")
        active = st.selectbox("Active", options=[0, 1], format_func=lambda x: "Yes" if x == 1 else "No")
        submitted = st.form_submit_button("Run both models")

    if submitted:
        if cvd_bundle is None:
            st.error(f"Tabular model bundle unavailable. Add the updated files in {CVD_MODELS_DIR}.")
        else:
            patient_data = {
                "age": int(age_years * 365.25),
                "gender": int(gender),
                "height": float(height),
                "weight": float(weight),
                "ap_hi": int(ap_hi),
                "ap_lo": int(ap_lo),
                "cholesterol": int(cholesterol),
                "gluc": int(gluc),
                "smoke": int(smoke),
                "alco": int(alco),
                "active": int(active),
            }
            tabular_result = predict_tabular(patient_data, cvd_bundle)
            if not tabular_result:
                st.error(f"Unable to compute tabular prediction with the available files in {CVD_MODELS_DIR}.")
            else:
                if image_result is None:
                    st.info(
                        "Upload image to get result"
                    )
                else:
                    st.subheader("Dual-model assessment")
                    st.write("Both image and tabular model outputs are available. The final conclusion is shown below.")
                    st.markdown("**Image model output:**")
                    st.write(f"- Risk tier: **{image_result['class']}"
                             f" ({image_result['confidence']:.1%})")
                    st.markdown("**Tabular model output:**")
                    st.write(f"- Risk probability: **{tabular_result['ensemble_probability']:.1%}**")
                    st.write(f"- Label: **{tabular_result['label']} risk**")
                    st.write(f"- Threshold: **{tabular_result['threshold']:.2f}**")
                    with st.expander("Tabular model breakdown"):
                        for name, prob in tabular_result["breakdown"].items():
                            st.write(f"{name}: {prob:.4f}")

                    conclusion = build_combined_conclusion(image_result, tabular_result)
                    st.success(conclusion)
