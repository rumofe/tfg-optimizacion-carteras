"""cartera snapshot table

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-07

Añade tabla cartera_snapshot para guardar el historial de versiones
de cada cartera (pesos + nombre + fecha + motivo del cambio).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cartera_snapshot",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cartera_id", sa.Integer(), nullable=False),
        sa.Column("fecha", sa.DateTime(), nullable=False),
        sa.Column("nombre_estrategia", sa.String(), nullable=False),
        sa.Column("pesos", sa.JSON(), nullable=False),
        sa.Column("motivo", sa.String(), nullable=False, server_default="edicion"),
        sa.ForeignKeyConstraint(["cartera_id"], ["cartera.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cartera_snapshot_id"), "cartera_snapshot", ["id"], unique=False)
    op.create_index(op.f("ix_cartera_snapshot_cartera_id"), "cartera_snapshot", ["cartera_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_cartera_snapshot_cartera_id"), table_name="cartera_snapshot")
    op.drop_index(op.f("ix_cartera_snapshot_id"), table_name="cartera_snapshot")
    op.drop_table("cartera_snapshot")
