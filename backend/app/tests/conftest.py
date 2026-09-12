import pytest
from app.database.database import engine, Base
from app.database.seed import seed_database, ensure_schema_migrations
from app.main import app
from app.core.security import get_current_user, get_current_active_user
from app.models.models import User

@pytest.fixture(scope="session", autouse=True)
def init_test_db():
    Base.metadata.create_all(bind=engine)
    ensure_schema_migrations(engine)
    seed_database()

    # Provide active test user fallback for unit test client requests
    def mock_current_user():
        return User(id=1, email="test.admin@linkx8.in", full_name="Test Administrator", role="Admin", is_active=True)

    app.dependency_overrides[get_current_active_user] = mock_current_user
    app.dependency_overrides[get_current_user] = mock_current_user
    yield
    app.dependency_overrides.clear()

