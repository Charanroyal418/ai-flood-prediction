from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.api.deps import get_db

router = APIRouter()

def run_etl_task(db: Session):
    try:
        from app.etl.weather import WeatherETL
        pipeline = WeatherETL(db)
        pipeline.execute()
    except Exception as e:
        print(f"ETL Background Task Failed: {e}")

def run_ml_train_task():
    try:
        from app.ml.train import train_and_evaluate
        train_and_evaluate()
    except Exception as e:
        print(f"ML Train Background Task Failed: {e}")

@router.post("/etl/run")
def trigger_etl_pipeline(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Admin: Manually trigger the Weather ETL pipeline asynchronously.
    """
    background_tasks.add_task(run_etl_task, db)
    return {"message": "ETL Pipeline execution started in the background."}

@router.post("/ml/retrain")
def trigger_ml_retraining(background_tasks: BackgroundTasks):
    """
    Admin: Manually trigger the XGBoost/RandomForest training pipeline asynchronously.
    """
    background_tasks.add_task(run_ml_train_task)
    return {"message": "AI Model retraining started in the background. Check logs for metrics."}
