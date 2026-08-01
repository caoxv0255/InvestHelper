"""初始数据库迁移 - 创建所有表

Revision ID: 0001_initial
Revises: 
Create Date: 2026-07-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """升级：创建所有表"""
    op.create_table(
        'holdings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('platform', sa.String(length=50), nullable=False, comment='平台类型: alipay/cmb/ths'),
        sa.Column('asset_type', sa.String(length=50), nullable=False, comment='资产类型: fund/stock/deposit'),
        sa.Column('code', sa.String(length=50), nullable=False, comment='标的代码'),
        sa.Column('name', sa.String(length=200), nullable=False, comment='标的名称'),
        sa.Column('quantity', sa.Numeric(precision=20, scale=6), nullable=False, comment='持仓数量/份额'),
        sa.Column('cost_price', sa.Numeric(precision=20, scale=6), nullable=False, comment='成本价'),
        sa.Column('current_price', sa.Numeric(precision=20, scale=6), nullable=True, comment='当前价格'),
        sa.Column('industry', sa.String(length=100), nullable=True, comment='行业'),
        sa.Column('buy_date', sa.Date(), nullable=True, comment='买入日期'),
        sa.Column('notes', sa.Text(), nullable=True, comment='备注'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, comment='创建时间(UTC)'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, comment='更新时间(UTC)'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_holdings_asset_type'), 'holdings', ['asset_type'], unique=False)
    op.create_index(op.f('ix_holdings_code'), 'holdings', ['code'], unique=False)
    op.create_index(op.f('ix_holdings_id'), 'holdings', ['id'], unique=False)
    op.create_index(op.f('ix_holdings_platform'), 'holdings', ['platform'], unique=False)

    op.create_table(
        'deposits',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('bank', sa.String(length=50), nullable=False, comment='银行: cmb'),
        sa.Column('product_name', sa.String(length=200), nullable=False, comment='产品名称'),
        sa.Column('principal', sa.Numeric(precision=20, scale=2), nullable=False, comment='本金'),
        sa.Column('annual_rate', sa.Numeric(precision=10, scale=4), nullable=False, comment='年化利率'),
        sa.Column('start_date', sa.Date(), nullable=False, comment='起息日'),
        sa.Column('maturity_date', sa.Date(), nullable=False, comment='到期日'),
        sa.Column('expected_return', sa.Numeric(precision=20, scale=2), nullable=False, comment='预期收益'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active', comment='状态: active/matured'),
        sa.Column('notes', sa.Text(), nullable=True, comment='备注'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, comment='创建时间(UTC)'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, comment='更新时间(UTC)'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_deposits_bank'), 'deposits', ['bank'], unique=False)
    op.create_index(op.f('ix_deposits_id'), 'deposits', ['id'], unique=False)
    op.create_index(op.f('ix_deposits_maturity_date'), 'deposits', ['maturity_date'], unique=False)
    op.create_index(op.f('ix_deposits_start_date'), 'deposits', ['start_date'], unique=False)
    op.create_index(op.f('ix_deposits_status'), 'deposits', ['status'], unique=False)

    op.create_table(
        'user_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('setting_key', sa.String(length=100), nullable=False, comment='设置项key'),
        sa.Column('setting_value', sa.JSON(), nullable=False, comment='设置值(JSON格式)'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, comment='创建时间(UTC)'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, comment='更新时间(UTC)'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('setting_key')
    )
    op.create_index(op.f('ix_user_settings_id'), 'user_settings', ['id'], unique=False)
    op.create_index(op.f('ix_user_settings_setting_key'), 'user_settings', ['setting_key'], unique=True)

    op.create_table(
        'news',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False, comment='来源: eastmoney/ths/sina'),
        sa.Column('title', sa.String(length=500), nullable=False, comment='标题'),
        sa.Column('content', sa.Text(), nullable=False, comment='内容'),
        sa.Column('url', sa.String(length=1000), nullable=True, comment='原文链接'),
        sa.Column('publish_time', sa.DateTime(timezone=True), nullable=False, comment='发布时间(UTC)'),
        sa.Column('is_important', sa.Boolean(), nullable=False, server_default='0', comment='是否重磅'),
        sa.Column('keywords', sa.JSON(), nullable=True, comment='匹配的关键词(JSON数组)'),
        sa.Column('content_hash', sa.String(length=64), nullable=True, comment='内容哈希(用于去重)'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, comment='创建时间(UTC)'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, comment='更新时间(UTC)'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source', 'url', name='uq_news_source_url')
    )
    op.create_index(op.f('ix_news_id'), 'news', ['id'], unique=False)
    op.create_index(op.f('ix_news_is_important'), 'news', ['is_important'], unique=False)
    op.create_index(op.f('ix_news_publish_time'), 'news', ['publish_time'], unique=False)
    op.create_index(op.f('ix_news_source'), 'news', ['source'], unique=False)

    op.create_table(
        'opportunities',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False, comment='标的代码'),
        sa.Column('name', sa.String(length=200), nullable=False, comment='标的名称'),
        sa.Column('opportunity_type', sa.String(length=50), nullable=False, comment='机会类型: sector_momentum/tech_signal/fund_flow'),
        sa.Column('score', sa.Numeric(precision=5, scale=2), nullable=False, comment='综合评分 0-100'),
        sa.Column('price', sa.Numeric(precision=20, scale=6), nullable=False, comment='当前价格'),
        sa.Column('reason', sa.JSON(), nullable=False, comment='推荐理由(JSON)'),
        sa.Column('discovered_date', sa.Date(), nullable=False, comment='发现日期'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active', comment='状态: active/expired'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, comment='创建时间(UTC)'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, comment='更新时间(UTC)'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_opportunities_code'), 'opportunities', ['code'], unique=False)
    op.create_index(op.f('ix_opportunities_discovered_date'), 'opportunities', ['discovered_date'], unique=False)
    op.create_index(op.f('ix_opportunities_id'), 'opportunities', ['id'], unique=False)
    op.create_index(op.f('ix_opportunities_opportunity_type'), 'opportunities', ['opportunity_type'], unique=False)
    op.create_index(op.f('ix_opportunities_score'), 'opportunities', ['score'], unique=False)
    op.create_index(op.f('ix_opportunities_status'), 'opportunities', ['status'], unique=False)


def downgrade() -> None:
    """降级：删除所有表"""
    op.drop_index(op.f('ix_opportunities_status'), table_name='opportunities')
    op.drop_index(op.f('ix_opportunities_score'), table_name='opportunities')
    op.drop_index(op.f('ix_opportunities_opportunity_type'), table_name='opportunities')
    op.drop_index(op.f('ix_opportunities_id'), table_name='opportunities')
    op.drop_index(op.f('ix_opportunities_discovered_date'), table_name='opportunities')
    op.drop_index(op.f('ix_opportunities_code'), table_name='opportunities')
    op.drop_table('opportunities')

    op.drop_index(op.f('ix_news_source'), table_name='news')
    op.drop_index(op.f('ix_news_publish_time'), table_name='news')
    op.drop_index(op.f('ix_news_is_important'), table_name='news')
    op.drop_index(op.f('ix_news_id'), table_name='news')
    op.drop_table('news')

    op.drop_index(op.f('ix_user_settings_setting_key'), table_name='user_settings')
    op.drop_index(op.f('ix_user_settings_id'), table_name='user_settings')
    op.drop_table('user_settings')

    op.drop_index(op.f('ix_deposits_status'), table_name='deposits')
    op.drop_index(op.f('ix_deposits_start_date'), table_name='deposits')
    op.drop_index(op.f('ix_deposits_maturity_date'), table_name='deposits')
    op.drop_index(op.f('ix_deposits_id'), table_name='deposits')
    op.drop_index(op.f('ix_deposits_bank'), table_name='deposits')
    op.drop_table('deposits')

    op.drop_index(op.f('ix_holdings_platform'), table_name='holdings')
    op.drop_index(op.f('ix_holdings_id'), table_name='holdings')
    op.drop_index(op.f('ix_holdings_code'), table_name='holdings')
    op.drop_index(op.f('ix_holdings_asset_type'), table_name='holdings')
    op.drop_table('holdings')
