import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATASETS_DIR = BASE_DIR / "datasets"
RAW_DIR = DATASETS_DIR / "raw"
CLEANED_DIR = DATASETS_DIR / "cleaned"
PROCESSED_DIR = DATASETS_DIR / "processed"
REPORTS_DIR = DATASETS_DIR / "reports"
ARCHIVE_DIR = DATASETS_DIR / "archive"

# Ensure core directories exist
for directory in [DATASETS_DIR, RAW_DIR, CLEANED_DIR, PROCESSED_DIR, REPORTS_DIR, ARCHIVE_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# PostGIS Database Connection
# Update with correct credentials
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "tn_flood_ai")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
