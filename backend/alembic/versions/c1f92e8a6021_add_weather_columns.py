"""add weather columns

Revision ID: c1f92e8a6021
Revises: 98f2a3c5ba06
Create Date: 2026-08-03 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c1f92e8a6021'
down_revision = '98f2a3c5ba06'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use batch operations for SQLite compatibility if needed, though this is for Postgres.
    with op.batch_alter_table('weather', schema=None) as batch_op:
        batch_op.add_column(sa.Column('wind_speed', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('rainfall_mm', sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('weather', schema=None) as batch_op:
        batch_op.drop_column('rainfall_mm')
        batch_op.drop_column('wind_speed')
