import pytest
from app.database.database import engine, Base
from app.database.seed import seed_database, ensure_schema_migrations

@pytest.fixture(scope="session", autouse=True)
def init_test_db():
    Base.metadata.create_all(bind=engine)
    ensure_schema_migrations(engine)
    seed_database()
