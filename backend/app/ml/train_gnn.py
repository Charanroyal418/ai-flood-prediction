import os
import torch
import torch.nn.functional as F
from torch_geometric.data import Data
from app.ml.gnn_model import TemporalFloodGNN, train_gnn_epoch
from app.kg.builder import kg_builder

def generate_synthetic_graph_data():
    """Generate synthetic graph data for training the GNN if real Neo4j data is missing."""
    x, edge_index = kg_builder.fetch_graph_snapshot()
    
    # Generate mock labels for classification (4 classes: Low, Moderate, High, Severe)
    y = torch.randint(0, 4, (x.size(0),))
    
    # Create train mask
    train_mask = torch.rand(x.size(0)) < 0.8
    test_mask = ~train_mask
    
    data = Data(x=x, edge_index=edge_index, y=y, train_mask=train_mask, test_mask=test_mask)
    return data

def train_gnn():
    print("Initializing Dynamic Graph Neural Network (GDNN)...")
    data = generate_synthetic_graph_data()
    
    num_node_features = data.x.size(1)
    num_classes = 4
    
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
    test_correct = pred[data.test_mask] == data.y[data.test_mask]
    test_acc = int(test_correct.sum()) / int(data.test_mask.sum())
    print(f'GNN Test Accuracy: {test_acc:.4f}')
    
    # Save Model
    model_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, 'gnn_model.pth')
    torch.save(model.state_dict(), model_path)
    print(f"Saved Trained GDNN to {model_path}")

if __name__ == "__main__":
    train_gnn()
