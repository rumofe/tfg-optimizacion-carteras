from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.database import get_db
from app.db.models import Activo, ActivoCartera, Cartera, Usuario
from etl.market_data import DataSourceError
from optimizer.markowitz import MarkowitzOptimizer

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado o token inválido",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        user_id = decode_access_token(token)
    except JWTError:
        raise credentials_exc
    user = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
    if not user:
        raise credentials_exc
    return user


# --- Schemas ---

class OptimizeRequest(BaseModel):
    tickers: list[str]
    capital: float
    max_volatilidad: float


class GuardarCarteraRequest(BaseModel):
    nombre_estrategia: str
    tickers: list[str]
    pesos: dict[str, float]
    capital: float


# --- Endpoints ---

@router.post("/optimize")
def optimize_portfolio(payload: OptimizeRequest):
    """
    Calcula la cartera óptima (máximo Sharpe Ratio) para los tickers dados
    e incluye la Frontera Eficiente de Markowitz completa.
    No requiere autenticación.
    """
    if len(payload.tickers) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Se necesitan al menos 2 tickers para optimizar",
        )
    try:
        opt = MarkowitzOptimizer(tickers=[t.upper() for t in payload.tickers])
        result = opt.optimizar(
            max_volatilidad=payload.max_volatilidad,
            capital=payload.capital,
        )
    except DataSourceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return result


@router.post("/", status_code=status.HTTP_201_CREATED)
def guardar_cartera(
    payload: GuardarCarteraRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Guarda una cartera optimizada en la BD para el usuario autenticado.
    Requiere JWT en cabecera Authorization: Bearer <token>.
    """
    cartera = Cartera(
        usuario_id=current_user.id,
        nombre_estrategia=payload.nombre_estrategia,
        fecha_creacion=date.today(),
    )
    db.add(cartera)
    db.flush()  # obtiene cartera.id sin cerrar la transacción

    for ticker, peso in payload.pesos.items():
        ticker_upper = ticker.upper()
        activo = db.query(Activo).filter(Activo.isin_ticker == ticker_upper).first()
        if not activo:
            activo = Activo(isin_ticker=ticker_upper, nombre_fondo=ticker_upper)
            db.add(activo)
            db.flush()

        db.add(ActivoCartera(
            cartera_id=cartera.id,
            activo_id=activo.id,
            peso_asignado=peso,
        ))

    db.commit()
    return {"id": cartera.id, "mensaje": "Cartera guardada correctamente"}


@router.get("/")
def listar_carteras(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Devuelve todas las carteras del usuario autenticado con sus activos y pesos.
    """
    carteras = (
        db.query(Cartera)
        .filter(Cartera.usuario_id == current_user.id)
        .order_by(Cartera.fecha_creacion.desc())
        .all()
    )

    return [
        {
            "id": c.id,
            "nombre_estrategia": c.nombre_estrategia,
            "fecha_creacion": c.fecha_creacion,
            "activos": [
                {
                    "ticker": ac.activo.isin_ticker,
                    "peso_asignado": ac.peso_asignado,
                }
                for ac in c.activos
            ],
        }
        for c in carteras
    ]


@router.delete("/{cartera_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cartera(
    cartera_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Elimina una cartera del usuario autenticado (y sus activos asociados).
    """
    cartera = (
        db.query(Cartera)
        .filter(Cartera.id == cartera_id, Cartera.usuario_id == current_user.id)
        .first()
    )
    if not cartera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cartera no encontrada",
        )
    db.query(ActivoCartera).filter(ActivoCartera.cartera_id == cartera_id).delete()
    db.delete(cartera)
    db.commit()
