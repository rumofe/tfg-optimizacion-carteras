from datetime import date

from sqlalchemy import Column, Date, Float, ForeignKey, Integer, String
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
    categoria = Column(String, nullable=True)

    carteras = relationship("ActivoCartera", back_populates="activo")
    historico = relationship("HistoricoPrecios", back_populates="activo")


class ActivoCartera(Base):
    __tablename__ = "activo_cartera"

    cartera_id = Column(Integer, ForeignKey("cartera.id"), primary_key=True)
    activo_id = Column(Integer, ForeignKey("activo.id"), primary_key=True)
    peso_asignado = Column(Float, nullable=False)

    cartera = relationship("Cartera", back_populates="activos")
    activo = relationship("Activo", back_populates="carteras")


class HistoricoPrecios(Base):
    __tablename__ = "historico_precios"

    id = Column(Integer, primary_key=True, index=True)
    activo_id = Column(Integer, ForeignKey("activo.id"), nullable=False)
    fecha_cotizacion = Column(Date, nullable=False)
    valor_liquidativo = Column(Float, nullable=False)

    activo = relationship("Activo", back_populates="historico")
