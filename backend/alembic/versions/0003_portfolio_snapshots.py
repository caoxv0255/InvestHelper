"""每日组合快照"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003_portfolio_snapshots"
down_revision: Union[str, None] = "0002_strategy_lab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "portfolio_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("market_value", sa.Numeric(precision=20, scale=6), nullable=False),
        sa.Column("cost_basis", sa.Numeric(precision=20, scale=6), nullable=False),
        sa.Column("total_profit", sa.Numeric(precision=20, scale=6), nullable=False),
        sa.Column("positions", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("snapshot_date", "currency", name="uq_portfolio_snapshot_date_currency"),
    )
    op.create_index("ix_portfolio_snapshots_id", "portfolio_snapshots", ["id"])
    op.create_index("ix_portfolio_snapshots_snapshot_date", "portfolio_snapshots", ["snapshot_date"])
    op.create_index("ix_portfolio_snapshots_currency", "portfolio_snapshots", ["currency"])


def downgrade() -> None:
    op.drop_index("ix_portfolio_snapshots_currency", table_name="portfolio_snapshots")
    op.drop_index("ix_portfolio_snapshots_snapshot_date", table_name="portfolio_snapshots")
    op.drop_index("ix_portfolio_snapshots_id", table_name="portfolio_snapshots")
    op.drop_table("portfolio_snapshots")
