"""
Fixtures globales para el conjunto de tests.

Estrategia:
- Se fuerza DATABASE_URL a SQLite antes de que ningún módulo de la app
  sea importado, de modo que pydantic-settings lo recoge en primer lugar
  (env vars tienen prioridad sobre .env en pydantic-settings v2).
- Se reemplaza el engine y SessionLocal del módulo database por una
  instancia SQLite con StaticPool, lo que garantiza que todos los
  accesos de un mismo test comparten la misma BD en memoria.
- get_db se sobreescribe via dependency_overrides para cada test.
"""

import os

# ── 1. Variables de entorno ANTES de cualquier import de la app ────────────
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "clave-secreta-solo-para-tests-no-usar-en-prod")

# ── 2. Imports (ahora la app leerá las variables de arriba) ────────────────
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.db.database as _db_module
from app.db.models import Base

# ── 3. Motor SQLite en memoria compartido entre conexiones ─────────────────
_TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=_TEST_ENGINE)

# Reemplaza el engine del módulo para que el startup event también lo use
_db_module.engine = _TEST_ENGINE
_db_module.SessionLocal = _TestingSession

# ── 4. Import tardío del app (ya con el engine parcheado) ─────────────────
from app.main import app  # noqa: E402
from app.db.database import get_db  # noqa: E402


# ── 5. Fixtures ────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_db():
    """Crea las tablas antes de cada test y las elimina al acabar."""
    Base.metadata.create_all(bind=_TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=_TEST_ENGINE)


@pytest.fixture
def client(reset_db):
    def _override_get_db():
        db = _TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def registered_user(client):
    """Registra un usuario de prueba y devuelve sus credenciales."""
    email, password = "usuario@test.com", "contrasena_segura"
    client.post("/auth/register", json={"email": email, "password": password})
    return {"email": email, "password": password}


@pytest.fixture
def auth_headers(client, registered_user):
    """Cabeceras Authorization con Bearer token para el usuario de prueba."""
    res = client.post(
        "/auth/login",
        data={"username": registered_user["email"], "password": registered_user["password"]},
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
