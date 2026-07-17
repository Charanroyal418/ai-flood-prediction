from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "FloodSense AI"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str
    SECRET_KEY: str = "supersecretkey_please_change_in_production_tn_flood_ai"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
