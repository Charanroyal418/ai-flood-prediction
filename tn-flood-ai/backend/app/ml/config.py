import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ML_DIR = BASE_DIR / "app" / "ml"
MODEL_DIR = BASE_DIR / "models"
DATA_DIR = BASE_DIR / "data"

# Create directories if they don't exist
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# File names
MODEL_FILE = MODEL_DIR / "flood_model.pkl"
PREPROCESSOR_FILE = MODEL_DIR / "preprocessor.pkl"

# Model Hyperparameters
XGBOOST_PARAMS = {
    "n_estimators": 100,
    "max_depth": 6,
    "learning_rate": 0.1,
    "objective": "multi:softprob",
    "num_class": 5, # Very Low, Low, Moderate, High, Severe
    "eval_metric": "mlogloss",
    "use_label_encoder": False
}

RANDOM_FOREST_PARAMS = {
    "n_estimators": 100,
    "max_depth": 10,
    "random_state": 42
}

# Features
NUMERIC_FEATURES = [
    "rainfall_24h",
    "rainfall_72h",
    "river_level",
    "river_discharge",
    "elevation",
    "slope",
    "distance_to_river",
    "impervious_area",
    "population_density"
]

CATEGORICAL_FEATURES = [
    "district_name"
]

# Labels Mapping
RISK_LABELS = {
    0: "Very Low",
    1: "Low",
    2: "Moderate",
    3: "High",
    4: "Severe"
}

REVERSE_RISK_LABELS = {v: k for k, v in RISK_LABELS.items()}
