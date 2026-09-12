"""initial schema for LINK X8

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Tables are dynamically managed by Base.metadata.create_all for SQLite/Postgres
    # This migration baseline provides a versioned ledger for production DDL
    pass

def downgrade() -> None:
    pass
