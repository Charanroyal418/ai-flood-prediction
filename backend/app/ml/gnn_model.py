try:
    import torch
    import torch.nn.functional as F
    from torch_geometric.nn import GATConv, global_mean_pool
    torch_base = torch.nn.Module
except ImportError:
    torch = None
    F = None
    GATConv = None
    torch_base = object

class TemporalFloodGNN(torch_base):
    """
    Dynamic Graph Neural Network for Flood Prediction.
    Matches the PPT Architecture: Uses Graph Attention (GAT) for spatial propagation,
    and a recurrent/temporal layer (simulated here) for historical processing.
    """
    def __init__(self, num_node_features: int, num_classes: int):
        super(TemporalFloodGNN, self).__init__()
        
        if GATConv is None:
            raise RuntimeError("PyTorch Geometric is not installed. Please install torch-geometric.")
            
        # 1. Temporal/Regression Head (GRU)
        # Process the sequence of raw features to capture temporal flood patterns per district
        self.gru = torch.nn.GRU(input_size=num_node_features, hidden_size=32, batch_first=True)
        
        # 2. Spatial Embeddings (Graph Attention)
        # Propagates temporal embeddings across the topological network
        self.gat1 = GATConv(32, 64, heads=4, dropout=0.2)
        self.gat2 = GATConv(64 * 4, 32, heads=1, concat=False, dropout=0.2)
        
        self.classifier = torch.nn.Linear(32, num_classes)

    def forward(self, x, edge_index, batch_index=None):
        """
        x: Node feature matrix sequence [num_nodes, seq_len, num_features]
        edge_index: Graph connectivity [2, num_edges]
        """
        num_nodes, seq_len, num_features = x.size()
        
        # 1. Temporal processing first
        gru_out, _ = self.gru(x) # gru_out: [num_nodes, seq_len, 32]
        
        # Take the output of the last time step for spatial propagation
        last_out = gru_out[:, -1, :] # [num_nodes, 32]
        
        # 2. Spatial Message Passing
        # GAT 1
        x_spat, _ = self.gat1(last_out, edge_index, return_attention_weights=True)
        x_spat = F.elu(x_spat)
        x_spat = F.dropout(x_spat, p=0.2, training=self.training)
        
        # GAT 2
        x_spat, (attn_edge_idx, attn_alpha) = self.gat2(x_spat, edge_index, return_attention_weights=True)
        embeddings = F.elu(x_spat) # Shape: [num_nodes, 32]
        
        # Node-level flood risk classification
        out = self.classifier(embeddings)
        log_probs = F.log_softmax(out, dim=1)
        
        if self.training:
            return log_probs
            
        # For inference, return the full computational graph data
        return log_probs, embeddings, [(attn_edge_idx, attn_alpha)]

def train_gnn_epoch(model, optimizer, data):
    """
    Standard training loop for the GDNN.
    """
    model.train()
    optimizer.zero_grad()
    
    out = model(data.x, data.edge_index)
    if isinstance(out, tuple):
        out = out[0]
    
    # Calculate loss only on nodes we have ground truth for
    loss = F.nll_loss(out[data.train_mask], data.y[data.train_mask])
    
    loss.backward()
    optimizer.step()
    return loss.item()
