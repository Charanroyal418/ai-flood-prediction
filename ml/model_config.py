"""
Model Configuration for Flood Prediction XGBoost Model
"""

FEATURES = [
    "elevation_m",          # From DEM
    "distance_to_river_m",  # From Hydrology vectors
    "rainfall_24h_mm",      # From Realtime Weather ETL
    "soil_moisture_index",  # From Landcover / Satellite
    "slope_degrees",        # Derived from DEM
]

TARGET = "is_flooded"       # 1 = Flooded, 0 = Safe

# XGBoost Hyperparameters
XGB_PARAMS = {
    "objective": "binary:logistic",
    "max_depth": 6,
    "learning_rate": 0.05,
    "n_estimators": 200,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "eval_metric": "logloss",
    "random_state": 42
}
