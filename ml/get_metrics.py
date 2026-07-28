import os
import time
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, roc_auc_score
from model_config import FEATURES, TARGET, XGB_PARAMS
from train_xgboost import generate_dummy_data

print("Generating Data...")
df = generate_dummy_data()

print(f"Dataset Size: {len(df)} samples")
print(f"Features: {FEATURES}")

X = df[FEATURES]
y = df[TARGET]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
print(f"Train/Test split: {len(X_train)} train, {len(X_test)} test (80/20 split)")

model = xgb.XGBClassifier(**XGB_PARAMS)

print("\n--- Training Model ---")
start_train = time.time()
model.fit(X_train, y_train)
train_time = time.time() - start_train
print(f"Training Time: {train_time * 1000:.2f} ms")

print("\n--- Evaluating Model ---")
start_infer = time.time()
y_pred = model.predict(X_test)
y_pred_proba = model.predict_proba(X_test)[:, 1]
infer_time = time.time() - start_infer
print(f"Inference Time for {len(X_test)} samples: {infer_time * 1000:.2f} ms ({(infer_time / len(X_test)) * 1000:.4f} ms/sample)")

acc = accuracy_score(y_test, y_pred)
prec = precision_score(y_test, y_pred)
rec = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
roc_auc = roc_auc_score(y_test, y_pred_proba)
cm = confusion_matrix(y_test, y_pred)

print(f"\n--- Metrics ---")
print(f"Accuracy:  {acc:.4f}")
print(f"Precision: {prec:.4f}")
print(f"Recall:    {rec:.4f}")
print(f"F1-score:  {f1:.4f}")
print(f"AUC-ROC:   {roc_auc:.4f}")
print("\nConfusion Matrix:")
print(f"True Negatives: {cm[0, 0]} | False Positives: {cm[0, 1]}")
print(f"False Negatives: {cm[1, 0]} | True Positives: {cm[1, 1]}")

print("\n--- Feature Importances ---")
importances = model.feature_importances_
feature_importance = pd.DataFrame({"Feature": FEATURES, "Importance": importances})
feature_importance = feature_importance.sort_values(by="Importance", ascending=False)
for idx, row in feature_importance.iterrows():
    print(f"{row['Feature']}: {row['Importance']:.4f}")
