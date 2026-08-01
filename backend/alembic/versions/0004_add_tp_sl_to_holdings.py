"""add take_profit_price and stop_loss_price to holdings"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_add_tp_sl_to_holdings"
down_revision: Union[str, None] = "0003_portfolio_snapshots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 为 holdings 表新增止盈价、止损价字段
    op.add_column(
        "holdings",
        sa.Column("take_profit_price", sa.Numeric(precision=20, scale=6), nullable=True, comment="止盈价"),
    )
    op.add_column(
        "holdings",
        sa.Column("stop_loss_price", sa.Numeric(precision=20, scale=6), nullable=True, comment="止损价"),
    )


def downgrade() -> None:
    op.drop_column("holdings", "stop_loss_price")
    op.drop_column("holdings", "take_profit_price")
