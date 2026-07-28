"""
GNN Training Pipeline
======================
Trains the TemporalFloodGNN (GAT+GRU) model using:
  1. Real feature vectors from database (via app.ml.features)
  2. Physics-engine calibrated labels (semi-supervised)
  3. 80/10/10 temporal split (no data leakage)
  4. Early stopping with patience
  5. Model checkpointing (saves best validation loss only)

Usage:
    python -m app.ml.train_gnn
    # or via admin API: POST /api/v1/admin/ml/retrain-gnn
"""
import os
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

import torch
import torch.nn.functional as F
import numpy as np

from app.ml.gnn_model import TemporalFloodGNN, train_gnn_epoch
from app.kg.builder import kg_builder
from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
MODEL_DIR = Path(settings.MODEL_DIR)
MODEL_PATH = MODEL_DIR / "gnn_model.pth"
METRICS_PATH = MODEL_DIR / "gnn_metrics.json"
BEST_CHECKPOINT_PATH = MODEL_DIR / "gnn_best.pth"

NUM_FEATURES = settings.GNN_NUM_FEATURES  # 12
NUM_CLASSES = settings.GNN_NUM_CLASSES    # 5
SEQ_LEN = settings.GNN_SEQ_LEN            # 3

# Training hyperparameters
LR = 0.005
WEIGHT_DECAY = 5e-4
MAX_EPOCHS = 200
PATIENCE = 15  # Early stopping patience


def _get_physics_label(features_last_step: torch.Tensor) -> int:
    """
    Compute physics-based flood risk class from the last time step of features.
    Matches the inference.py physics engine exactly for consistency.
    """
    f = features_last_step.tolist()
    rainfall = f[0]
    river_risk = f[1]
    humidity = f[2]
    elevation_inv = f[5]  # inverted: 1.0 = low elevation (high risk)
    hist_floods = f[8]

    r_mm = rainfall * 204.4
    r_score = min(40.0, (r_mm / 204.4) * 40.0)
    rv_score = min(25.0, river_risk * 25.0)
    # elevation_inv=1 means near sea level → high risk
    elev_score = elevation_inv * 15.0
    hist_score = min(10.0, hist_floods * 10.0)
    hum_boost = max(0, (humidity - 0.75) / 0.25) * 5.0

    risk_raw = r_score + rv_score + elev_score + hist_score + hum_boost
    risk_score = min(99.0, max(1.0, risk_raw))

    if risk_score >= 70:
        return 4
    elif risk_score >= 50:
        return 3
    elif risk_score >= 30:
        return 2
    elif risk_score >= 15:
        return 1
    return 0


def build_training_dataset(n_snapshots: int = 150):
    """
    Build training dataset from real KG snapshots with physics-based labels.

    Each snapshot is a slightly perturbed version of the real current state,
    covering the full range from dry conditions to extreme storm.

    Perturbation strategy:
      - Rainfall scale: linearly swept 0→1.0 over snapshots
      - River risk: swept 0→0.95 over snapshots
      - Other features: taken from real KG snapshot (actual DB values)
      - Labels: computed from physics engine (consistent with inference)
    """
    logger.info("[Train] Fetching real KG snapshot from database...")
    x_base, edge_index = kg_builder.fetch_graph_snapshot(seq_len=SEQ_LEN)

    n_nodes = x_base.shape[0]
    logger.info(
        f"[Train] Graph: {n_nodes} nodes, {edge_index.shape[1]} edges, "
        f"seq_len={SEQ_LEN}, features={NUM_FEATURES}"
    )

    X_list = []
    y_list = []

    for snap_idx in range(n_snapshots):
        # Create a smooth sweep from calm to extreme conditions
        t = snap_idx / max(n_snapshots - 1, 1)  # 0.0 → 1.0

        # Rainfall intensity: 0 (calm) to 1.0 (extreme IMD)
        rain_scale = t

        # River risk: 0 (empty) to 0.95 (near-overflow)
        river_scale = t * 0.95

        # Add Gaussian noise for robustness (small, physics-consistent)
        noise_std = 0.04 * (1 - abs(t - 0.5) * 2)  # Smaller noise in extremes

        x_snap = x_base.clone()

        # Apply rainfall and river perturbation
        x_snap[:, :, 0] = torch.clamp(
            x_base[:, :, 0] * (1.0 - t) + torch.ones_like(x_base[:, :, 0]) * rain_scale
            + torch.randn_like(x_base[:, :, 0]) * noise_std,
            0.0, 1.0
        )
        x_snap[:, :, 1] = torch.clamp(
            x_base[:, :, 1] * (1.0 - t) + torch.ones_like(x_base[:, :, 1]) * river_scale
            + torch.randn_like(x_base[:, :, 1]) * noise_std,
            0.0, 1.0
        )

        # Compute physics-based labels for each node
        y_snap = torch.zeros(n_nodes, dtype=torch.long)
        for node_i in range(n_nodes):
            y_snap[node_i] = _get_physics_label(x_snap[node_i, -1, :])

        X_list.append(x_snap)
        y_list.append(y_snap)

    return X_list, y_list, edge_index


def train_gnn(
    n_snapshots: int = 150,
    progress_callback=None,
) -> dict:
    """
    Full training pipeline with temporal split, early stopping, and checkpointing.

    Returns:
        dict with training metrics (accuracy, loss, epochs, time)
    """
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    start_time = time.perf_counter()

    logger.info("[Train] === FloodSense GAT+GRU Training Pipeline ===")
    logger.info(f"[Train] Model: {NUM_FEATURES} features → {NUM_CLASSES} risk classes")
    logger.info(f"[Train] Architecture: GRU(hidden=32) → GAT(4-heads) → GAT(1-head) → Linear")

    # ── 1. Build Dataset ──────────────────────────────────────────────────────
    logger.info(f"[Train] Building {n_snapshots} training snapshots from real KG data...")
    if progress_callback:
        progress_callback({"stage": "dataset", "pct": 5, "message": "Fetching KG snapshot..."})

    X_list, y_list, edge_index = build_training_dataset(n_snapshots)

    # ── 2. Temporal Split (no data leakage) ───────────────────────────────────
    # Temporal snapshots: first 80% = train, next 10% = val, last 10% = test
    n = len(X_list)
    n_train = int(0.80 * n)
    n_val = int(0.10 * n)

    X_train = X_list[:n_train]
    y_train = y_list[:n_train]
    X_val = X_list[n_train: n_train + n_val]
    y_val = y_list[n_train: n_train + n_val]
    X_test = X_list[n_train + n_val:]
    y_test = y_list[n_train + n_val:]

    logger.info(
        f"[Train] Split: train={n_train}, val={n_val}, test={len(X_test)} snapshots"
    )

    # ── 3. Initialize Model ───────────────────────────────────────────────────
    model = TemporalFloodGNN(num_node_features=NUM_FEATURES, num_classes=NUM_CLASSES)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", patience=5, factor=0.5, verbose=False
    )

    # Class weights to handle imbalance (critical class underrepresented in calm weather)
    class_counts = torch.zeros(NUM_CLASSES)
    for y in y_train:
        for cls in range(NUM_CLASSES):
            class_counts[cls] += (y == cls).sum().item()
    class_counts = class_counts.clamp(min=1)
    class_weights = (class_counts.sum() / (NUM_CLASSES * class_counts)).float()
    logger.info(f"[Train] Class weights: {[round(w.item(), 3) for w in class_weights]}")

    # ── 4. Training Loop with Early Stopping ─────────────────────────────────
    best_val_loss = float("inf")
    patience_counter = 0
    train_losses = []
    val_losses = []
    best_epoch = 0

    for epoch in range(1, MAX_EPOCHS + 1):
        # ─ Train ─
        model.train()
        total_train_loss = 0.0
        for X, y in zip(X_train, y_train):
            optimizer.zero_grad()
            out = model(X, edge_index)
            if isinstance(out, tuple):
                out = out[0]
            loss = F.nll_loss(out, y, weight=class_weights)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            total_train_loss += loss.item()
        avg_train_loss = total_train_loss / max(len(X_train), 1)

        # ─ Validate ─
        model.eval()
        total_val_loss = 0.0
        with torch.no_grad():
            for X, y in zip(X_val, y_val):
                out = model(X, edge_index)
                if isinstance(out, tuple):
                    out = out[0]
                loss = F.nll_loss(out, y, weight=class_weights)
                total_val_loss += loss.item()
        avg_val_loss = total_val_loss / max(len(X_val), 1)

        train_losses.append(avg_train_loss)
        val_losses.append(avg_val_loss)
        scheduler.step(avg_val_loss)

        # ─ Checkpoint best model ─
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            best_epoch = epoch
            patience_counter = 0
            torch.save(model.state_dict(), BEST_CHECKPOINT_PATH)
        else:
            patience_counter += 1

        if epoch % 20 == 0 or epoch <= 5:
            logger.info(
                f"[Train] Epoch {epoch:03d} | "
                f"Train Loss: {avg_train_loss:.4f} | "
                f"Val Loss: {avg_val_loss:.4f} | "
                f"Best: {best_val_loss:.4f} @ ep{best_epoch} | "
                f"Patience: {patience_counter}/{PATIENCE}"
            )
            if progress_callback:
                pct = int(10 + (epoch / MAX_EPOCHS) * 80)
                progress_callback({
                    "stage": "training",
                    "pct": pct,
                    "message": f"Epoch {epoch}: val_loss={avg_val_loss:.4f}",
                    "epoch": epoch,
                    "train_loss": round(avg_train_loss, 4),
                    "val_loss": round(avg_val_loss, 4),
                })

        # ─ Early stopping ─
        if patience_counter >= PATIENCE:
            logger.info(f"[Train] Early stopping at epoch {epoch} (patience={PATIENCE})")
            break

    # ── 5. Test Evaluation ────────────────────────────────────────────────────
    # Load best checkpoint
    if BEST_CHECKPOINT_PATH.exists():
        model.load_state_dict(torch.load(BEST_CHECKPOINT_PATH, map_location="cpu"))
    model.eval()

    correct = 0
    total = 0
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for X, y in zip(X_test, y_test):
            out = model(X, edge_index)
            if isinstance(out, tuple):
                out = out[0]
            probs = torch.exp(out)
            preds = probs.argmax(dim=1)
            correct += (preds == y).sum().item()
            total += y.size(0)
            all_preds.extend(preds.tolist())
            all_labels.extend(y.tolist())

    test_accuracy = correct / max(total, 1)

    # Per-class accuracy
    per_class_acc = {}
    risk_names = ["Very Low", "Low", "Moderate", "High", "Critical"]
    for cls in range(NUM_CLASSES):
        cls_mask = [l == cls for l in all_labels]
        cls_preds = [p for p, m in zip(all_preds, cls_mask) if m]
        cls_labels = [l for l, m in zip(all_labels, cls_mask) if m]
        if cls_labels:
            acc = sum(p == l for p, l in zip(cls_preds, cls_labels)) / len(cls_labels)
            per_class_acc[risk_names[cls]] = round(acc, 3)

    elapsed_s = time.perf_counter() - start_time

    # ── 6. Save Model & Metrics ───────────────────────────────────────────────
    torch.save(model.state_dict(), MODEL_PATH)
    logger.info(f"[Train] Saved model to {MODEL_PATH}")

    metrics = {
        "accuracy": round(test_accuracy, 4),
        "best_val_loss": round(best_val_loss, 4),
        "best_epoch": best_epoch,
        "total_epochs_trained": epoch,
        "per_class_accuracy": per_class_acc,
        "train_snapshots": n_train,
        "val_snapshots": n_val,
        "test_snapshots": len(X_test),
        "model_params": sum(p.numel() for p in model.parameters()),
        "training_time_s": round(elapsed_s, 1),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "architecture": f"GRU(32)+GAT(4-head,64)+GAT(1-head,32)+Linear({NUM_CLASSES})",
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    logger.info(f"[Train] Metrics: accuracy={test_accuracy:.1%}, best_epoch={best_epoch}")

    if progress_callback:
        progress_callback({
            "stage": "complete",
            "pct": 100,
            "message": f"Training complete. Accuracy: {test_accuracy:.1%}",
            **metrics,
        })

    return metrics


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)

    snapshots = int(sys.argv[1]) if len(sys.argv) > 1 else 150
    print(f"Training GNN with {snapshots} snapshots...")
    m = train_gnn(n_snapshots=snapshots)
    print(f"\nResults:")
    print(f"  Accuracy:    {m['accuracy']:.1%}")
    print(f"  Best Val Loss: {m['best_val_loss']:.4f} @ epoch {m['best_epoch']}")
    print(f"  Train Time:  {m['training_time_s']}s")
    print(f"  Model saved: {MODEL_PATH}")
