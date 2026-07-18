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
        
        # 2. Temporal/Regression Head (GRU)
        # Process the sequence of spatial embeddings to capture temporal flood patterns
        self.gru = torch.nn.GRU(input_size=32, hidden_size=32, batch_first=True)
        self.classifier = torch.nn.Linear(32, num_classes)

    def forward(self, x, edge_index, batch_index=None):
        """
        x: Node feature matrix sequence [num_nodes, seq_len, num_features]
        edge_index: Graph connectivity (Neo4j relationships) [2, num_edges]
        """
        num_nodes, seq_len, num_features = x.size()
        
        # Spatial Message Passing per time step
        out_seq = []
        for t in range(seq_len):
            x_t = x[:, t, :] # Shape: [num_nodes, num_features]
            x_t = F.dropout(x_t, p=0.2, training=self.training)
            x_t = F.elu(self.gat1(x_t, edge_index))
            
            x_t = F.dropout(x_t, p=0.2, training=self.training)
            x_t = F.elu(self.gat2(x_t, edge_index)) # Shape: [num_nodes, 32]
            out_seq.append(x_t)
            
        # Stack temporal outputs to [num_nodes, seq_len, 32]
        out_seq = torch.stack(out_seq, dim=1)
        
        # Temporal processing
        gru_out, _ = self.gru(out_seq) # gru_out: [num_nodes, seq_len, 32]
        
        # Take the output of the last time step for prediction
        last_out = gru_out[:, -1, :] # [num_nodes, 32]
        
        # Node-level flood risk classification
        out = self.classifier(last_out)
        
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
