# RetinaVision AI — CVD Risk Prediction

## Overview
RetinaVision AI is a full-stack cardiovascular disease screening prototype that combines:

- an image model for retinal fundus image analysis
- a tabular model for clinical and lifestyle features

The app includes:
- a Vite-based landing page
- a FastAPI backend for prediction
- a separate Streamlit app for model inference

## Project Structure
- backend/ — FastAPI service and prediction API
- frontend/ — Vite frontend for the web UI
- cvd_models/ — updated tabular model files
- cvd_model_improved.keras — updated image model
- streamlit_app.py — standalone Streamlit interface

## Requirements
Python dependencies are listed in backend/requirements.txt.

Install them with:

```bash
cd backend
py -3 -m pip install -r requirements.txt
```

Frontend dependencies:

```bash
cd frontend
npm install
```

## Run the Backend
From the project root:

```bash
cd backend
py -3 -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

The API will be available at:
- http://127.0.0.1:8000/docs

## Run the Frontend
From the project root:

```bash
cd frontend
npm run dev
```

The landing page will be available at:
- http://localhost:5173

## Run the Streamlit App
From the project root:

```bash
streamlit run streamlit_app.py
```

Or with explicit host/port settings:

```bash
python -m streamlit run streamlit_app.py --server.address 127.0.0.1 --server.port 8501
```

## Model Files
The updated model assets are expected in the project root and model folder:
- cvd_model_improved.keras
- cvd_models/model_config.json
- cvd_models/xgb_cvd_model.json
- cvd_models/lgb_cvd_model.txt
- cvd_models/rf_cvd_model.pkl
- cvd_models/mlp_cvd_model.pkl
- cvd_models/robust_scaler.pkl

## API Endpoint
### POST /predict
Accepts:
- image: retinal image file
- patient_data: JSON string with patient biometrics

Example response:

```json
{
  "image_model": {
    "risk": "High",
    "confidence": 92.5,
    "probabilities": {
      "Low": 5.0,
      "Medium": 10.0,
      "High": 85.0
    }
  },
  "tabular_model": {
    "risk": "High",
    "confidence": 88.2
  },
  "combined": {
    "risk": "High",
    "confidence": 90.8
  }
}
```

## Notes
- This project is intended for research and demonstration purposes.
- Predictions should not be used as a substitute for professional medical diagnosis.
