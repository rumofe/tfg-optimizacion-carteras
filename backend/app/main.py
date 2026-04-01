from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.assets import router as assets_router
from app.api.portfolio import router as portfolio_router

app = FastAPI(
    title="TFG Optimización de Carteras",
    servers=[{"url": "http://127.0.0.1:8000"}],
)

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
