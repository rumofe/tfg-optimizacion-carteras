from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Usuario(Base):
    __tablename__ = "usuario"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    capital_base = Column(Float, nullable=True)
    tolerancia_riesgo = Column(Float, nullable=True)

    carteras = relationship("Cartera", back_populates="usuario")


class Cartera(Base):
    __tablename__ = "cartera"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuario.id"), nullable=False)
    nombre_estrategia = Column(String, nullable=False)
    fecha_creacion = Column(Date, nullable=False)

    usuario = relationship("Usuario", back_populates="carteras")
    activos = relationship("ActivoCartera", back_populates="cartera")


class Activo(Base):
    __tablename__ = "activo"

    id = Column(Integer, primary_key=True, index=True)
    isin_ticker = Column(String, unique=True, nullable=False, index=True)
    nombre_fondo = Column(String, nullable=False)
    carteras = relationship("ActivoCartera", back_populates="activo")


class ActivoCartera(Base):
    __tablename__ = "activo_cartera"

    cartera_id = Column(Integer, ForeignKey("cartera.id"), primary_key=True)
    activo_id = Column(Integer, ForeignKey("activo.id"), primary_key=True)
    peso_asignado = Column(Float, nullable=False)

    cartera = relationship("Cartera", back_populates="activos")
    activo = relationship("Activo", back_populates="carteras")


class CarteraSnapshot(Base):
    """
    Versión histórica de una cartera. Cada vez que el usuario modifica los pesos
    o el nombre de una cartera, el estado anterior se guarda como snapshot.
    Permite ver la evolución de la cartera en el tiempo.
    """
    __tablename__ = "cartera_snapshot"

    id = Column(Integer, primary_key=True, index=True)
    cartera_id = Column(Integer, ForeignKey("cartera.id"), nullable=False, index=True)
    fecha = Column(DateTime, nullable=False)
    nombre_estrategia = Column(String, nullable=False)
    # Pesos en formato {"AAPL": 0.4, "MSFT": 0.6}
    pesos = Column(JSON, nullable=False)
    # Motivo del snapshot: "edicion" | "creacion" | "manual"
    motivo = Column(String, nullable=False, default="edicion")


