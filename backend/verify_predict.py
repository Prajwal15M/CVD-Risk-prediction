import json
import pathlib
import requests

files = {
    'image': ('favicon.svg', pathlib.Path('../frontend/public/favicon.svg').read_bytes(), 'image/svg+xml')
}
data = {
    'patient_data': json.dumps({
        'male': 1,
        'age': 55,
        'education': 1,
        'currentSmoker': 1,
        'cigsPerDay': 10,
        'BPMeds': 0,
        'prevalentStroke': 0,
        'prevalentHyp': 1,
        'diabetes': 1,
        'totChol': 240,
        'sysBP': 145,
        'diaBP': 90,
        'BMI': 28.5,
        'heartRate': 72,
        'glucose': 120,
        'pulse_pressure': 55,
        'smoker_intensity': 1,
        'chol_age_ratio': 4.36,
        'hyp_diabetes': 2,
    })
}
response = requests.post('http://127.0.0.1:8000/predict', files=files, data=data, timeout=60)
print(response.status_code)
print(response.text)
