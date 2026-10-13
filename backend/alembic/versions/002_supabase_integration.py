"""Supabase PostgreSQL & PostGIS Integration Migration

Revision ID: 002_supabase_integration
Revises: 001_initial_schema
Create Date: 2026-09-21 12:00:00.000000

"""
import os
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_supabase_integration'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Loads DDL if executing against Postgres/Supabase
    connection = op.get_bind()
    if connection.dialect.name == "postgresql":
        sql_file_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "app", "database", "supabase_schema.sql"
        )
        if os.path.exists(sql_file_path):
            with open(sql_file_path, "r", encoding="utf-8") as f:
                ddl = f.read()
            connection.execute(sa.text(ddl))

def downgrade() -> None:
    pass
