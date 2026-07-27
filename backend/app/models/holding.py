from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text
from datetime import datetime, date
from ..database import Base


class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(20), nullable=False)
    platform_name = Column(String(50))
    asset_type = Column(String(20), nullable=False)
    code = Column(String(20), nullable=False)
    name = Column(String(100), nullable=False)
    quantity = Column(Float, nullable=False, default=0)
    cost_price = Column(Float, nullable=False, default=0)
    current_price = Column(Float, default=0)
    current_price_updated = Column(DateTime)
    buy_date = Column(Date)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
