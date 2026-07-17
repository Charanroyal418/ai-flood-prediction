import pytest
from app.services.prediction_service import calculate_risk_score
import numpy as np

def test_calculate_risk_score_severe():
    # If model is 100% sure it's class 4 (Severe)
    probs = np.array([0.0, 0.0, 0.0, 0.0, 1.0])
    score = calculate_risk_score(probs)
    assert score == 95.5 # the expected weight we set

def test_calculate_risk_score_low():
    # If model is 100% sure it's class 1 (Low)
    probs = np.array([0.0, 1.0, 0.0, 0.0, 0.0])
    score = calculate_risk_score(probs)
    assert score == 38.0

def test_calculate_risk_score_mixed():
    # Mixed probability
    probs = np.array([0.1, 0.2, 0.5, 0.1, 0.1])
    score = calculate_risk_score(probs)
    # 0.1(12.5) + 0.2(38) + 0.5(63) + 0.1(83) + 0.1(95.5) = 1.25 + 7.6 + 31.5 + 8.3 + 9.55 = 58.2
    assert abs(score - 58.2) < 0.1
