import os
import pandas as pd
import xgboost as xgb
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import logging
from model_config import FEATURES, TARGET, XGB_PARAMS

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

def generate_dummy_data():
    """
    In production, this queries the PostgreSQL database joining Rainfall, DEM, and Flood_Events.
    Here we generate synthetic data to validate the pipeline architecture.
    """
    import numpy as np
    np.random.seed(42)
    n_samples = 1000
    
    data = pd.DataFrame({
        "elevation_m": np.random.uniform(2, 500, n_samples),
        "distance_to_river_m": np.random.uniform(10, 5000, n_samples),
        "rainfall_24h_mm": np.random.uniform(0, 300, n_samples),
        "soil_moisture_index": np.random.uniform(0.1, 0.9, n_samples),
        "slope_degrees": np.random.uniform(0, 30, n_samples),
    })
    
    # Simple rule-based generation for synthetic target
    # High rain, low elevation, close to river -> high chance of flood
    flood_prob = (data["rainfall_24h_mm"] / 300) * 0.4 + \
                 (1 - data["elevation_m"] / 500) * 0.3 + \
                 (1 - data["distance_to_river_m"] / 5000) * 0.3
                 
    data[TARGET] = (flood_prob > 0.6).astype(int)
    return data

def train_model():
    logger.info("Loading training data from PostgreSQL...")
    df = generate_dummy_data()
    
    X = df[FEATURES]
    y = df[TARGET]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    logger.info("Initializing XGBoost Classifier...")
    model = xgb.XGBClassifier(**XGB_PARAMS)
    
    logger.info("Training model...")
    model.fit(X_train, y_train)
    
    logger.info("Evaluating model...")
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    logger.info(f"Model Accuracy: {acc * 100:.2f}%")
    logger.info("\n" + classification_report(y_test, y_pred))
    
    # Save the model
    os.makedirs(os.path.join(os.path.dirname(__file__), "artifacts"), exist_ok=True)
    model_path = os.path.join(os.path.dirname(__file__), "artifacts", "flood_xgboost_v1.pkl")
    joblib.dump(model, model_path)
    logger.info(f"Model saved successfully to {model_path}")

if __name__ == "__main__":
    train_model()
