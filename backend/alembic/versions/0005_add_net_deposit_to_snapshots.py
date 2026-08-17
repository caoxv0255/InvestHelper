"""add net_deposit to portfolio_snapshots"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_add_net_deposit_to_snapshots"
down_revision: Union[str, None] = "0004_add_tp_sl_to_holdings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # å¼ºå¯¼å¸­å¡å¯¼åºæç«
    op.add_column(
        "portfolio_snapshots",
        sa.Column("net_deposit", sa.Numeric(precision=20, scale=6), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("portfolio_snapshots", "net_deposit")
