import torch
import torch.nn.functional as F
try:
    from torch_geometric.nn import GATConv, global_mean_pool
except ImportError:
    # Fail gracefully if PyTorch Geometric isn't installed yet
    GATConv = None

class TemporalFloodGNN(torch.nn.Module):
    """
    Dynamic Graph Neural Network for Flood Prediction.
    Matches the PPT Architecture: Uses Graph Attention (GAT) for spatial propagation,
    and a recurrent/temporal layer (simulated here) for historical processing.
    """
    def __init__(self, num_node_features: int, num_classes: int):
        super(TemporalFloodGNN, self).__init__()
        
        if GATConv is None:
            raise RuntimeError("PyTorch Geometric is not installed. Please install torch-geometric.")
            
        # 1. Spatial Embeddings (Graph Attention)
        # Propagates rainfall and river levels across the topological network
        self.gat1 = GATConv(num_node_features, 64, heads=4, dropout=0.2)
        self.gat2 = GATConv(64 * 4, 32, heads=1, concat=False, dropout=0.2)
        
        # 2. Temporal/Regression Head
        # In a full Temporal Graph Network, we would use a GRU here.
        # For the MVP prediction step, we project to classes (Low, Moderate, High, Severe)
        self.classifier = torch.nn.Linear(32, num_classes)

    def forward(self, x, edge_index, batch_index=None):
        """
        x: Node feature matrix (Rainfall, Elevation, Humidity, etc.) [num_nodes, num_node_features]
        edge_index: Graph connectivity (Neo4j relationships) [2, num_edges]
        """
        # Spatial Message Passing
        x = F.dropout(x, p=0.2, training=self.training)
        x = F.elu(self.gat1(x, edge_index))
        
        x = F.dropout(x, p=0.2, training=self.training)
        x = F.elu(self.gat2(x, edge_index))
        
        # Node-level flood risk classification
        out = self.classifier(x)
        
        # Return log_softmax for CrossEntropyLoss
        return F.log_softmax(out, dim=1)

def train_gnn_epoch(model, optimizer, data):
    """
    Standard training loop for the GDNN.
    """
    model.train()
    optimizer.zero_grad()
    
    out = model(data.x, data.edge_index)
    
    # Calculate loss only on nodes we have ground truth for
    loss = F.nll_loss(out[data.train_mask], data.y[data.train_mask])
    
    loss.backward()
    optimizer.step()
    return loss.item()
