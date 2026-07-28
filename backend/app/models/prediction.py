"""
Prediction model — alias for PredictionHistory
Provides backward-compatible import for any module importing from app.models.prediction
"""
from app.models.history import PredictionHistory as Prediction  # noqa: F401

__all__ = ["Prediction"]
