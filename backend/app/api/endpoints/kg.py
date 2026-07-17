from fastapi import APIRouter
from app.kg.builder import kg_builder

router = APIRouter()

@router.get("/graph")
def get_knowledge_graph():
    """
    Returns the Knowledge Graph nodes and edges for visualization in the UI.
    """
    return kg_builder.get_graph_data()

