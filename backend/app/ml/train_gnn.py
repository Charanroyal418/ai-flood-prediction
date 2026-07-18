import os
import torch
import torch.nn.functional as F
from torch_geometric.data import Data
from app.ml.gnn_model import TemporalFloodGNN, train_gnn_epoch
from app.kg.builder import kg_builder

def generate_synthetic_graph_data():
    """Generate synthetic graph data for training the GNN if real Neo4j data is missing."""
    x, edge_index = kg_builder.fetch_graph_snapshot()
    
    # Generate mock labels for classification (5 classes: Very Low, Low, Moderate, High, Severe)
    y = torch.randint(0, 5, (x.size(0),))
    
    # Create train mask
    train_mask = torch.rand(x.size(0)) < 0.8
    test_mask = ~train_mask
    
    data = Data(x=x, edge_index=edge_index, y=y, train_mask=train_mask, test_mask=test_mask)
    return data

def train_gnn():
    print("Initializing Dynamic Graph Neural Network (GDNN)...")
    data = generate_synthetic_graph_data()
    
    num_node_features = data.x.size(2)
    num_classes = 5
    
    model = TemporalFloodGNN(num_node_features=num_node_features, num_classes=num_classes)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)
    
    print("Training GDNN for 100 epochs...")
    for epoch in range(1, 101):
        loss = train_gnn_epoch(model, optimizer, data)
        if epoch % 20 == 0:
            print(f'Epoch: {epoch:03d}, Loss: {loss:.4f}')
            
    # Evaluation
    model.eval()
    out = model(data.x, data.edge_index)
    pred = out.argmax(dim=1)
    
    y_true = data.y[data.test_mask].numpy()
    y_pred = pred[data.test_mask].numpy()
    y_prob = torch.exp(out[data.test_mask]).detach().numpy() # exp because we return log_softmax
    
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
    import json
    
    # Calculate Metrics
    test_acc = accuracy_score(y_true, y_pred)
    precision = precision_score(y_true, y_pred, average='weighted', zero_division=0)
    recall = recall_score(y_true, y_pred, average='weighted', zero_division=0)
    f1 = f1_score(y_true, y_pred, average='weighted', zero_division=0)
    
    # ROC AUC requires probabilities and can be tricky for multi-class if classes are missing in test set
    try:
        roc_auc = roc_auc_score(y_true, y_prob, multi_class='ovr', average='weighted')
    except Exception as e:
        roc_auc = 0.5
        
    cm = confusion_matrix(y_true, y_pred).tolist()
    
    metrics = {
        "accuracy": float(test_acc),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "roc_auc": float(roc_auc),
        "confusion_matrix": cm
    }
    
    print(f'GNN Test Metrics: {json.dumps(metrics, indent=2)}')
    
    # Save Metrics
    model_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(model_dir, exist_ok=True)
    with open(os.path.join(model_dir, 'gnn_metrics.json'), 'w') as f:
        json.dump(metrics, f)
    
    # Save Model
    model_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, 'gnn_model.pth')
    torch.save(model.state_dict(), model_path)
    print(f"Saved Trained GDNN to {model_path}")

if __name__ == "__main__":
    train_gnn()
