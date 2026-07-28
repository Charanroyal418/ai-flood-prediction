"""
FloodSense AI — Production Configuration
==========================================
All settings are loaded from environment variables with sane defaults
for local development. Never commit secrets to git.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os


class Settings(BaseSettings):
    # ── Project Identity ────────────────────────────────────────────────────
    PROJECT_NAME: str = "FloodSense AI"
    API_V1_STR: str = "/api/v1"
    VERSION: str = "2.0.0"
    ENVIRONMENT: str = "development"  # development | production | testing

    # ── Database ────────────────────────────────────────────────────────────
    # Use PostgreSQL in production, SQLite for local dev
    DATABASE_URL: str = "sqlite:///./floodsense.db"

    # ── Redis ───────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_SECONDS: int = 30

    # ── Security ────────────────────────────────────────────────────────────
    SECRET_KEY: str = "floodsense_dev_secret_key_change_in_production_tn_flood_ai_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7   # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── CORS ────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001,https://floodsense-ai.vercel.app"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    # ── ML Model ────────────────────────────────────────────────────────────
    MODEL_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml", "models")
    GNN_MODEL_PATH: str = ""  # Resolved at runtime from MODEL_DIR
    GNN_NUM_FEATURES: int = 12
    GNN_NUM_CLASSES: int = 5
    GNN_SEQ_LEN: int = 3

    # ── ETL / Data Pipeline ─────────────────────────────────────────────────
    OPEN_METEO_TIMEOUT_S: float = 8.0
    OPEN_METEO_BATCH_SIZE: int = 10     # Districts per API call
    ETL_INTERVAL_SECONDS: int = 300     # 5 min weather refresh
    PIPELINE_INTERVAL_SECONDS: int = 20  # 20s inference cycle

    # ── NASA GPM ────────────────────────────────────────────────────────────
    NASA_GPM_ENABLED: bool = False       # Requires Earthdata login
    NASA_GPM_TOKEN: Optional[str] = None

    # ── WebSocket ────────────────────────────────────────────────────────────
    WS_HEARTBEAT_SECONDS: int = 30

    # ── Admin ────────────────────────────────────────────────────────────────
    FIRST_ADMIN_EMAIL: str = "admin@floodsense.ai"
    FIRST_ADMIN_PASSWORD: str = "FloodSense@Admin2026"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    def model_post_init(self, __context):
        # Resolve GNN model path at runtime
        if not self.GNN_MODEL_PATH:
            object.__setattr__(
                self,
                "GNN_MODEL_PATH",
                os.path.join(self.MODEL_DIR, "gnn_model.pth"),
            )


settings = Settings()
