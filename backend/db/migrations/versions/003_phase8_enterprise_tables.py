"""phase8_enterprise_tables

Revision ID: 003_phase8_enterprise_tables
Revises: 002_add_deleted_at_to_alerts
Create Date: 2026-08-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003_phase8_enterprise_tables'
down_revision: Union[str, None] = '002_add_deleted_at_to_alerts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extend alerts table with Phase 8 fields
    op.add_column('alerts', sa.Column('assigned_to', sa.String(length=64), nullable=True))
    op.add_column('alerts', sa.Column('notes', sa.Text(), nullable=True))
    op.add_column('alerts', sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('alerts', sa.Column('reviewed', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('alerts', sa.Column('feedback_label', sa.String(length=32), nullable=True))
    op.add_column('alerts', sa.Column('threat_intel', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # 2. Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('username', sa.String(length=64), nullable=False),
        sa.Column('email', sa.String(length=128), nullable=False),
        sa.Column('hashed_password', sa.String(length=256), nullable=False),
        sa.Column('role', sa.String(length=16), nullable=False, server_default='analyst'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    # 3. Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('username', sa.String(length=64), nullable=False),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('target', sa.String(length=128), nullable=False),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_timestamp'), 'audit_logs', ['timestamp'], unique=False)

    # 4. Create threat_intel_cache table
    op.create_table(
        'threat_intel_cache',
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('ip_address')
    )

    # 5. Create analyst_feedback table
    op.create_table(
        'analyst_feedback',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('alert_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('username', sa.String(length=64), nullable=False),
        sa.Column('stage', sa.Integer(), nullable=False),
        sa.Column('predicted_label', sa.String(length=64), nullable=True),
        sa.Column('confirmed_label', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_analyst_feedback_alert_id'), 'analyst_feedback', ['alert_id'], unique=False)

    # 6. Create reports table
    op.create_table(
        'reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('report_type', sa.String(length=32), nullable=False),
        sa.Column('title', sa.String(length=128), nullable=False),
        sa.Column('summary', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('reports')
    op.drop_index(op.f('ix_analyst_feedback_alert_id'), table_name='analyst_feedback')
    op.drop_table('analyst_feedback')
    op.drop_table('threat_intel_cache')
    op.drop_index(op.f('ix_audit_logs_timestamp'), table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_table('users')

    op.drop_column('alerts', 'threat_intel')
    op.drop_column('alerts', 'feedback_label')
    op.drop_column('alerts', 'reviewed')
    op.drop_column('alerts', 'tags')
    op.drop_column('alerts', 'notes')
    op.drop_column('alerts', 'assigned_to')
