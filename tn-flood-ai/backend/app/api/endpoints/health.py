from fastapi import APIRouter

router = APIRouter()

@router.get("/health", response_model=dict)
def health_check():
    """
    Check if the API is running and healthy.
    """
    return {"status": "ok", "message": "FloodSense AI API is running seamlessly."}
