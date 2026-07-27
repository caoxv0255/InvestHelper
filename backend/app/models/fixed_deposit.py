from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text
from datetime import datetime
from ..database import Base


class FixedDeposit(Base):
    __tablename__ = "fixed_deposits"

    id = Column(Integer, primary_key=True, index=True)
    bank = Column(String(50), nullable=False)
    product_name = Column(String(100), nullable=False)
    principal = Column(Float, nullable=False, default=0)
    annual_rate = Column(Float, nullable=False, default=0)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    interest_method = Column(String(20), default="simple")
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
