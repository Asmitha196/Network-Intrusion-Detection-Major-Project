"""initial_schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-08-03 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create flow_records table
    op.create_table(
        'flow_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('src_ip', sa.String(length=45), nullable=False),
        sa.Column('dst_ip', sa.String(length=45), nullable=False),
        sa.Column('src_port', sa.Integer(), nullable=False),
        sa.Column('dst_port', sa.Integer(), nullable=False),
        sa.Column('protocol', sa.String(length=10), nullable=False),
        sa.Column('features', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint('id', 'timestamp')
    )
    op.create_index(op.f('ix_flow_records_timestamp'), 'flow_records', ['timestamp'], unique=False)

    # 2. Create alerts table
    op.create_table(
        'alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('flow_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('stage', sa.Integer(), nullable=False),
        sa.Column('attack_type', sa.String(length=64), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('severity', sa.String(length=16), nullable=False),
        sa.Column('reconstruction_error', sa.Float(), nullable=True),
        sa.Column('shap_values', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('raw_features', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.PrimaryKeyConstraint('id', 'timestamp')
    )
    op.create_index(op.f('ix_alerts_flow_id'), 'alerts', ['flow_id'], unique=False)
    op.create_index(op.f('ix_alerts_severity'), 'alerts', ['severity'], unique=False)
    op.create_index(op.f('ix_alerts_timestamp'), 'alerts', ['timestamp'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_alerts_timestamp'), table_name='alerts')
    op.drop_index(op.f('ix_alerts_severity'), table_name='alerts')
    op.drop_index(op.f('ix_alerts_flow_id'), table_name='alerts')
    op.drop_table('alerts')
    op.drop_index(op.f('ix_flow_records_timestamp'), table_name='flow_records')
    op.drop_table('flow_records')
