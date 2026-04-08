import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.assets import router as assets_router
from app.api.backtesting import router as backtesting_router
from app.api.portfolio import router as portfolio_router
from app.db.database import engine
from app.db.models import Base

logger = logging.getLogger(__name__)

app = FastAPI(
    title="TFG Optimización de Carteras",
    servers=[{"url": "http://127.0.0.1:8000"}],
)


@app.on_event("startup")
def create_tables() -> None:
    """Crea las tablas si no existen (útil cuando se arranca sin pasar por alembic)."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Tablas verificadas/creadas correctamente.")
    except Exception as exc:
        logger.error("Error al crear tablas en startup: %s", exc)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(assets_router)
app.include_router(portfolio_router)
app.include_router(backtesting_router)
