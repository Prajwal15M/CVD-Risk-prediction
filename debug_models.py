import json
import joblib
from pathlib import Path
import xgboost as xgb
import lightgbm as lgb

root = Path('.').resolve()
models_dir = root / 'cvd_models'
print('models dir exists', models_dir.exists())
with open(models_dir / 'model_config.json', 'r', encoding='utf-8') as f:
    config = json.load(f)
print('config ok', config)
print('loading xgb...')
try:
    xm = xgb.XGBClassifier()
    xm.load_model(str(models_dir / 'xgb_cvd_model.json'))
    print('xgb ok')
except Exception as e:
    print('xgb err', repr(e))
print('loading lgb...')
try:
    lm = lgb.Booster(model_file=str(models_dir / 'lgb_cvd_model.txt'))
    print('lgb ok')
except Exception as e:
    print('lgb err', repr(e))
print('loading rf...')
try:
    rf = joblib.load(str(models_dir / 'rf_cvd_model.pkl'))
    print('rf ok', type(rf))
except Exception as e:
    print('rf err', repr(e))
print('loading mlp...')
try:
    mlp = joblib.load(str(models_dir / 'mlp_cvd_model.pkl'))
    print('mlp ok', type(mlp))
except Exception as e:
    print('mlp err', repr(e))
print('loading scaler...')
try:
    sc = joblib.load(str(models_dir / 'robust_scaler.pkl'))
    print('scaler ok', type(sc))
except Exception as e:
    print('scaler err', repr(e))
