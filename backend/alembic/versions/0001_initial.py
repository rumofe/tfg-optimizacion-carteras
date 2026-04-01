"""initial

Revision ID: 0001
Revises:
Create Date: 2026-04-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("capital_base", sa.Float(), nullable=True),
        sa.Column("tolerancia_riesgo", sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_usuario_id"), "usuario", ["id"], unique=False)
    op.create_index(op.f("ix_usuario_email"), "usuario", ["email"], unique=True)

    op.create_table(
        "activo",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("isin_ticker", sa.String(), nullable=False),
        sa.Column("nombre_fondo", sa.String(), nullable=False),
        sa.Column("categoria", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_activo_id"), "activo", ["id"], unique=False)
    op.create_index(op.f("ix_activo_isin_ticker"), "activo", ["isin_ticker"], unique=True)

    op.create_table(
        "cartera",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("nombre_estrategia", sa.String(), nullable=False),
        sa.Column("fecha_creacion", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuario.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cartera_id"), "cartera", ["id"], unique=False)

    op.create_table(
        "activo_cartera",
        sa.Column("cartera_id", sa.Integer(), nullable=False),
        sa.Column("activo_id", sa.Integer(), nullable=False),
        sa.Column("peso_asignado", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["activo_id"], ["activo.id"]),
        sa.ForeignKeyConstraint(["cartera_id"], ["cartera.id"]),
        sa.PrimaryKeyConstraint("cartera_id", "activo_id"),
    )

    op.create_table(
        "historico_precios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("activo_id", sa.Integer(), nullable=False),
        sa.Column("fecha_cotizacion", sa.Date(), nullable=False),
        sa.Column("valor_liquidativo", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["activo_id"], ["activo.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_historico_precios_id"), "historico_precios", ["id"], unique=False)


def downgrade() -> None:
    op.drop_table("historico_precios")
    op.drop_table("activo_cartera")
    op.drop_index(op.f("ix_cartera_id"), table_name="cartera")
    op.drop_table("cartera")
    op.drop_index(op.f("ix_activo_isin_ticker"), table_name="activo")
    op.drop_index(op.f("ix_activo_id"), table_name="activo")
    op.drop_table("activo")
    op.drop_index(op.f("ix_usuario_email"), table_name="usuario")
    op.drop_index(op.f("ix_usuario_id"), table_name="usuario")
    op.drop_table("usuario")
