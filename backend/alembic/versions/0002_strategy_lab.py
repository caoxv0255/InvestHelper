"""策略实验室：交易流水与回测记录"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "0002_strategy_lab"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("account", sa.String(length=50), nullable=False),
        sa.Column("asset_type", sa.String(length=50), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("side", sa.String(length=10), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=20, scale=6), nullable=False),
        sa.Column("price", sa.Numeric(precision=20, scale=6), nullable=False),
        sa.Column("fee", sa.Numeric(precision=20, scale=6), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="CNY"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transactions_id", "transactions", ["id"])
    op.create_index("ix_transactions_account", "transactions", ["account"])
    op.create_index("ix_transactions_asset_type", "transactions", ["asset_type"])
    op.create_index("ix_transactions_code", "transactions", ["code"])
    op.create_index("ix_transactions_trade_date", "transactions", ["trade_date"])

    op.create_table(
        "backtest_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("strategy", sa.String(length=50), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("initial_capital", sa.Numeric(precision=20, scale=2), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("equity_curve", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_backtest_runs_id", "backtest_runs", ["id"])
    op.create_index("ix_backtest_runs_strategy", "backtest_runs", ["strategy"])


def downgrade() -> None:
    op.drop_index("ix_backtest_runs_strategy", table_name="backtest_runs")
    op.drop_index("ix_backtest_runs_id", table_name="backtest_runs")
    op.drop_table("backtest_runs")
    for index in ("ix_transactions_trade_date", "ix_transactions_code", "ix_transactions_asset_type", "ix_transactions_account", "ix_transactions_id"):
        op.drop_index(index, table_name="transactions")
    op.drop_table("transactions")
