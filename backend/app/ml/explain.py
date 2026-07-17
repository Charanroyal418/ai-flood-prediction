import numpy as np

def explain_prediction(features_dict, prediction_class):
    """
    Generate an explainability report based on feature values and the prediction.
    Outputs percentages of contribution for each feature.
    features_dict: Dict of feature names to their raw values
    prediction_class: The predicted risk level (0-3 or 0-4)
    """
    
    # Base feature weights (simulating learned weights from GNN)
    feature_importance_base = {
        "rainfall_24h": 0.35,
        "river_level": 0.25,
        "historical_floods": 0.15,
        "elevation": 0.10,
        "humidity": 0.05,
        "pressure": 0.05,
        "slope": 0.05
    }
    
    # Adjust weights dynamically based on the input values
    # e.g., if rainfall is extremely high, its contribution goes up
    contributions = {}
    total_weight = 0.0
    
    for feature, base_weight in feature_importance_base.items():
        val = features_dict.get(feature, 0)
        # Apply a simple non-linear scaling to simulate actual impact
        # In a real scenario, this would come directly from GNNExplainer edge/node masks
        multiplier = 1.0
        
        if feature == "rainfall_24h" and val > 100:
            multiplier = 2.0
        elif feature == "river_level" and val > 5:
            multiplier = 1.8
        elif feature == "elevation" and val < 10:
            multiplier = 1.5
            
        weight = base_weight * multiplier
        contributions[feature] = weight
        total_weight += weight
        
    # Normalize to percentages
    explanations = []
    
    friendly_names = {
        "rainfall_24h": "Heavy rainfall",
        "river_level": "River overflow",
        "historical_floods": "Historical flooding",
        "elevation": "Low elevation",
        "humidity": "High humidity",
        "pressure": "Low atmospheric pressure",
        "slope": "Flat terrain"
    }
    
    for feature, weight in contributions.items():
        percentage = int(round((weight / total_weight) * 100))
        if percentage > 5: # Only show significant factors
            name = friendly_names.get(feature, feature)
            if feature in ["rainfall_24h", "river_level"]:
                explanations.append(f"{name} contributes {percentage}% to the risk")
            elif feature == "elevation":
                explanations.append(f"{name} contributes {percentage}%")
            else:
                explanations.append(f"{name} contributes {percentage}%")
                
    # Sort by percentage descending
    explanations.sort(key=lambda x: int(x.split(' contributes ')[1].replace('%', '').split()[0]), reverse=True)
    
    return explanations
