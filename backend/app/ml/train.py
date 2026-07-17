import os
import json
import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support
from xgboost import XGBClassifier

from app.ml.config import (
    MODEL_FILE, PREPROCESSOR_FILE, MODEL_DIR,
    NUMERIC_FEATURES, CATEGORICAL_FEATURES,
    XGBOOST_PARAMS, RANDOM_FOREST_PARAMS
)
from app.ml.features import get_training_data, generate_labels

def build_preprocessor():
    """Build Scikit-Learn preprocessing pipeline"""
    numeric_transformer = Pipeline(steps=[
        ('scaler', StandardScaler())
    ])

    # For this simplified model, we drop categorical features or use them via embedding if needed.
    # Currently dropping district_name as it might cause overfitting in a small synthetic dataset.
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, NUMERIC_FEATURES)
        ],
        remainder='drop'
    )
    return preprocessor

def train_and_evaluate():
    """Main ML Pipeline runner"""
    print("Fetching and synthesizing training data...")
    df = get_training_data()
    df = generate_labels(df)
    
    print(f"Total training records: {len(df)}")
    print(df['risk_label'].value_counts())
    
    X = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y = df['risk_label']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    preprocessor = build_preprocessor()
    
    print("Fitting preprocessor...")
    X_train_processed = preprocessor.fit_transform(X_train)
    X_test_processed = preprocessor.transform(X_test)
    
    # Save preprocessor immediately
    joblib.dump(preprocessor, PREPROCESSOR_FILE)
    
    # Model 1: XGBoost
    print("Training XGBoost...")
    xgb_model = XGBClassifier(**XGBOOST_PARAMS)
    xgb_model.fit(X_train_processed, y_train)
    xgb_preds = xgb_model.predict(X_test_processed)
    
    # Model 2: Random Forest
    print("Training Random Forest...")
    rf_model = RandomForestClassifier(**RANDOM_FOREST_PARAMS)
    rf_model.fit(X_train_processed, y_train)
    rf_preds = rf_model.predict(X_test_processed)
    
    # Evaluation
    xgb_acc = accuracy_score(y_test, xgb_preds)
    rf_acc = accuracy_score(y_test, rf_preds)
    
    print(f"XGBoost Accuracy: {xgb_acc:.4f}")
    print(f"Random Forest Accuracy: {rf_acc:.4f}")
    
    # Select Best Model
    best_model = xgb_model if xgb_acc >= rf_acc else rf_model
    best_name = "XGBoost" if xgb_acc >= rf_acc else "RandomForest"
    best_preds = xgb_preds if xgb_acc >= rf_acc else rf_preds
    
    print(f"Selected {best_name} as the production model.")
    joblib.dump(best_model, MODEL_FILE)
    
    # Save Metadata
    metadata = {
        "best_model": best_name,
        "accuracy": float(max(xgb_acc, rf_acc)),
        "features": NUMERIC_FEATURES
    }
    with open(MODEL_DIR / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=4)
        
    # Generate Report
    generate_report(y_test, best_preds, best_name, metadata)
    print("ML Pipeline Complete.")

def generate_report(y_test, preds, model_name, metadata):
    report_dict = classification_report(y_test, preds, output_dict=True)
    report_str = f"# AI Flood Prediction Engine - Model Report\n\n"
    report_str += f"## Selected Model: {model_name}\n"
    report_str += f"- **Overall Accuracy**: {metadata['accuracy'] * 100:.2f}%\n\n"
    
    report_str += "## Classification Metrics\n"
    report_str += "| Class | Precision | Recall | F1-Score | Support |\n"
    report_str += "|-------|-----------|--------|----------|---------|\n"
    for label, metrics in report_dict.items():
        if isinstance(metrics, dict):
            report_str += f"| {label} | {metrics['precision']:.3f} | {metrics['recall']:.3f} | {metrics['f1-score']:.3f} | {metrics['support']} |\n"
            
    with open(MODEL_DIR / "MODEL_REPORT.md", "w") as f:
        f.write(report_str)

if __name__ == "__main__":
    train_and_evaluate()
