"""add_deleted_at_to_alerts

Revision ID: 002_add_deleted_at_to_alerts
Revises: 001_initial_schema
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_add_deleted_at_to_alerts'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add deleted_at TIMESTAMP column for timestamp-based soft deletion
    op.add_column('alerts', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('alerts', 'deleted_at')
