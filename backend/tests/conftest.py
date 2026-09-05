"""
conftest.py — Shared test fixtures for FloodSense AI backend
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base_class import Base
from app.api import deps

# ── In-Memory SQLite for Tests ────────────────────────────────────────────────
TEST_DATABASE_URL = "sqlite:///./test_floodsense.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_test_tables():
    """Create all tables in the test DB before any tests run."""
    import app.db.base  # Import all models
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    """Yield a test database session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def client(db):
    """Yield a FastAPI TestClient with DB dependency overridden."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[deps.get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def seeded_db(db):
    """Seed the test DB with Tamil Nadu districts."""
    from app.models.district import District
    from app.services.seeder import seed_districts
    seed_districts(db)
    return db


@pytest.fixture()
def admin_token(client, db):
    """Create admin user and return JWT access token."""
    resp = client.post("/api/v1/auth/register", json={
        "name": "Test Admin",
        "email": "testadmin@floodsense.ai",
        "password": "TestAdmin@2026!",
    })
    assert resp.status_code in (200, 201, 409)
    from app.models.user import User
    user = db.query(User).filter_by(email="testadmin@floodsense.ai").first()
    if user and user.role != "Admin":
        user.role = "Admin"
        db.commit()
    resp = client.post("/api/v1/auth/login", json={
        "email": "testadmin@floodsense.ai",
        "password": "TestAdmin@2026!",
    })
    return resp.json()["access_token"]


@pytest.fixture()
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}
