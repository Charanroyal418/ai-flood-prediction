# Enterprise ETL & APScheduler Architecture

The TN FloodAI backend runs a fully autonomous ETL engine managed by `APScheduler`.

## 1. The Base ETL Framework
Located in `app/etl/base.py`, every ETL pipeline (Weather, Forecast, Rivers) extends `BaseETLPipeline` which enforces a strict 5-step process:
1. `extract()`: Pulls data (e.g., from Open-Meteo).
2. `validate()`: Passes data through strict Pydantic schemas (e.g., rejecting negative rainfall or future timestamps).
3. `transform()`: Converts valid data into SQLAlchemy ORM objects.
4. `load()`: Executes batch inserts into PostgreSQL.
5. `execute()`: Wraps the entire flow in a `try/except` block and guarantees an `EtlLog` entry is written to the database.

## 2. APScheduler Lifecycle
The `BackgroundScheduler` is hooked directly into FastAPI's `@asynccontextmanager lifespan`. 
- **Startup**: When Uvicorn boots, `init_scheduler()` fires, registering the 15-minute weather cron job and writing a `SchedulerLog`.
- **Running**: Jobs execute in separate threads without blocking the ASGI event loop.
- **Shutdown**: A graceful shutdown ensures jobs finish before the database connection pool closes.

## 3. High-Performance Dashboard API
Instead of the Next.js frontend making 10 different requests (weather, rivers, alerts, stats), we implemented `/api/v1/dashboard/live`. This endpoint executes highly optimized SQLAlchemy queries to return the exact payload the UI needs in one shot.

## Monitoring
You can monitor the exact health of the server hardware and background jobs by hitting `/api/v1/system/status`.
