"""
Pytest fixtures for API tests. Uses in-memory SQLite so tests don't touch the real DB.
"""
import os

import pytest
from fastapi.testclient import TestClient

# Use in-memory SQLite for tests (must set before any app import)
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
