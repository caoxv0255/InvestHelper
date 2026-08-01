from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.deposits import Deposit
from app.schemas.deposits import DepositCreate, DepositUpdate, DepositResponse

router = APIRouter()


@router.get("/deposits", response_model=List[DepositResponse])
async def get_deposits(
    status: Optional[str] = Query(None, description="按状态筛选: active/matured"),
    db: Session = Depends(get_db),
):
    """获取定期理财列表，支持按状态筛选"""
    query = db.query(Deposit)
    if status:
        query = query.filter(Deposit.status == status)
    return query.order_by(Deposit.start_date.desc()).all()


@router.get("/deposits/{deposit_id}", response_model=DepositResponse)
async def get_deposit(deposit_id: int, db: Session = Depends(get_db)):
    """根据ID获取单条定期理财"""
    deposit = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="定期理财记录不存在")
    return deposit


@router.post("/deposits", response_model=DepositResponse)
async def create_deposit(deposit: DepositCreate, db: Session = Depends(get_db)):
    """创建新的定期理财记录"""
    db_deposit = Deposit(**deposit.model_dump())
    db.add(db_deposit)
    db.commit()
    db.refresh(db_deposit)
    return db_deposit


@router.put("/deposits/{deposit_id}", response_model=DepositResponse)
async def update_deposit(
    deposit_id: int,
    deposit_update: DepositUpdate,
    db: Session = Depends(get_db),
):
    """更新定期理财记录"""
    db_deposit = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not db_deposit:
        raise HTTPException(status_code=404, detail="定期理财记录不存在")

    update_data = deposit_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_deposit, key, value)

    db.commit()
    db.refresh(db_deposit)
    return db_deposit


@router.delete("/deposits/{deposit_id}")
async def delete_deposit(deposit_id: int, db: Session = Depends(get_db)):
    """删除定期理财记录"""
    db_deposit = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not db_deposit:
        raise HTTPException(status_code=404, detail="定期理财记录不存在")

    db.delete(db_deposit)
    db.commit()
    return {"message": "删除成功", "id": deposit_id}
