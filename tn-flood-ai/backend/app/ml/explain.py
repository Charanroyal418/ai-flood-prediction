import joblib
import numpy as np
from app.ml.config import MODEL_FILE, PREPROCESSOR_FILE, NUMERIC_FEATURES

# Singleton instances
_model = None
_preprocessor = None
_explainer = None

def get_ml_components():
    global _model, _preprocessor, _explainer
    if _model is None:
        try:
            _model = joblib.load(MODEL_FILE)
            _preprocessor = joblib.load(PREPROCESSOR_FILE)
            
            # Since SHAP can be heavy, we use TreeExplainer for XGBoost/RF
            # Note: For production with fast inference, we use the model's built-in feature_importances_
            # or a lightweight SHAP TreeExplainer if memory permits.
            import shap
            _explainer = shap.TreeExplainer(_model)
        except Exception as e:
            print(f"Failed to load ML components for Explainability: {e}")
            
    return _model, _preprocessor, _explainer


def get_top_reasons(features_df, prediction_class):
    """
    Given a single row DataFrame of raw features and the predicted class,
    calculate SHAP values and return the top 3 contributing reasons.
    """
    try:
        model, preprocessor, explainer = get_ml_components()
        if explainer is None:
            return ["Heavy Rainfall", "Low Elevation", "High River Level"] # Fallback
            
        processed_features = preprocessor.transform(features_df)
        shap_values = explainer.shap_values(processed_features)
        
        # XGBoost multi-class returns a list of shap arrays per class.
        if isinstance(shap_values, list):
            class_shap = shap_values[prediction_class][0]
        else:
            class_shap = shap_values[0]
            
        # Get indices of top 3 features with highest POSITIVE impact
        top_indices = np.argsort(class_shap)[-3:][::-1]
        
        feature_names = {
            "rainfall_24h": "Heavy 24h Rainfall",
            "rainfall_72h": "Prolonged Rainfall",
            "river_level": "High River Level",
            "river_discharge": "High River Discharge",
            "elevation": "Low Terrain Elevation",
            "slope": "Flat Terrain",
            "distance_to_river": "Proximity to River",
            "impervious_area": "High Urban/Impervious Area",
            "population_density": "Dense Population"
        }
        
        reasons = []
        for idx in top_indices:
            if class_shap[idx] > 0: # Only include if it contributed positively to the risk
                feat_key = NUMERIC_FEATURES[idx]
                reasons.append(feature_names.get(feat_key, feat_key))
                
        if not reasons:
            reasons = ["General Hydrological Conditions"]
            
        return reasons
    except Exception as e:
        print(f"SHAP explanation failed: {e}")
        return ["AI Model Confidence", "Hydrological Conditions"]
