from fastapi import APIRouter
from sqlalchemy import inspect
from app.db.session import engine

router = APIRouter()

@router.get("/health", response_model=dict)
def health_check():
    """
    Check if the API is running and healthy.
    """
    return {"status": "ok", "message": "FloodSense AI API is running seamlessly."}

@router.get("/schema_dump", response_model=dict)
def schema_dump():
    """
    Dump the production PostgreSQL schema for debugging purposes.
    """
    inspector = inspect(engine)
    schema = {}
    for table_name in inspector.get_table_names():
        columns = []
        for c in inspector.get_columns(table_name):
            columns.append({
                "name": c["name"],
                "type": str(c["type"]),
                "nullable": c["nullable"],
                "default": str(c.get("default", ""))
            })
        schema[table_name] = columns
    return {"schema": schema}
