from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.transactions import Transaction
from app.schemas.transactions import TransactionCreate, TransactionResponse

router = APIRouter()


@router.get("/transactions", response_model=List[TransactionResponse])
async def list_transactions(db: Session = Depends(get_db)):
    return db.query(Transaction).order_by(Transaction.trade_date.desc(), Transaction.id.desc()).all()


@router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(item: TransactionCreate, db: Session = Depends(get_db)):
    record = Transaction(**item.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    record = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="交易流水不存在")
    db.delete(record)
    db.commit()
    return {"message": "删除成功", "id": transaction_id}
