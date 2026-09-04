from fastapi import APIRouter, Request
from sqlalchemy import inspect
from app.db.session import engine

router = APIRouter()

@router.get("/health", response_model=dict)
def health_check():
    """
    Check if the API is running and healthy.
    """
    return {"status": "online", "message": "FloodSense AI API is running seamlessly."}

@router.get("/ready", response_model=dict)
def ready_check(request: Request):
    """
    Check if the API has finished initialization (DB migrations, seed data, model loading).
    """
    from fastapi import HTTPException
    is_ready = getattr(request.app.state, "is_ready", False)
    if not is_ready:
        raise HTTPException(status_code=503, detail="API is initializing")
    return {"status": "ready", "message": "API is fully initialized."}

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
