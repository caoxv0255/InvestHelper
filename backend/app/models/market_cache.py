from sqlalchemy import Column, Integer, String, Date, DateTime, Text, UniqueConstraint
from datetime import datetime
from ..database import Base


class MarketDataCache(Base):
    __tablename__ = "market_data_cache"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), nullable=False, index=True)
    data_type = Column(String(20), nullable=False)
    data_date = Column(Date, nullable=False)
    data_json = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("code", "data_type", "data_date", name="uq_code_type_date"),
    )
