from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Activo, ActivoCartera, Cartera, Usuario
from app.api.deps import get_current_user
from etl.market_data import DataSourceError
from optimizer.markowitz import MarkowitzOptimizer

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


# --- Schemas ---

class OptimizeRequest(BaseModel):
    tickers: list[str]
    capital: float
    max_volatilidad: float
    metodo: str = "markowitz"   # markowitz | min_variance | risk_parity | equal_weight


class GuardarCarteraRequest(BaseModel):
    nombre_estrategia: str
    tickers: list[str]
    pesos: dict[str, float]
    capital: float


class ActualizarCarteraRequest(BaseModel):
    nombre_estrategia: str
    pesos: dict[str, float]   # ticker → peso (deben sumar ~1.0)


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
            metodo=payload.metodo,
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


@router.put("/{cartera_id}")
def actualizar_cartera(
    cartera_id: int,
    payload: ActualizarCarteraRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Actualiza el nombre y los pesos de una cartera del usuario autenticado.
    Reemplaza todos los activos existentes por los nuevos.
    """
    cartera = (
        db.query(Cartera)
        .filter(Cartera.id == cartera_id, Cartera.usuario_id == current_user.id)
        .first()
    )
    if not cartera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cartera no encontrada")

    if len(payload.pesos) < 1:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="La cartera debe tener al menos 1 activo")

    cartera.nombre_estrategia = payload.nombre_estrategia

    # Reemplazar activos
    db.query(ActivoCartera).filter(ActivoCartera.cartera_id == cartera_id).delete()
    for ticker, peso in payload.pesos.items():
        ticker_upper = ticker.upper()
        activo = db.query(Activo).filter(Activo.isin_ticker == ticker_upper).first()
        if not activo:
            activo = Activo(isin_ticker=ticker_upper, nombre_fondo=ticker_upper)
            db.add(activo)
            db.flush()
        db.add(ActivoCartera(cartera_id=cartera.id, activo_id=activo.id, peso_asignado=peso))

    db.commit()
    return {"id": cartera.id, "mensaje": "Cartera actualizada correctamente"}


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
