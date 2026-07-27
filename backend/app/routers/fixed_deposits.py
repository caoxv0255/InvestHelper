from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.fixed_deposit import FixedDeposit
from ..schemas.fixed_deposit import (
    FixedDepositCreate,
    FixedDepositUpdate,
    FixedDepositResponse,
    FixedDepositListResponse,
)

router = APIRouter()


@router.get("", response_model=FixedDepositListResponse)
def get_fixed_deposits(db: Session = Depends(get_db)):
    items = db.query(FixedDeposit).order_by(FixedDeposit.start_date.desc()).all()
    return FixedDepositListResponse(total=len(items), items=items)


@router.get("/{deposit_id}", response_model=FixedDepositResponse)
def get_fixed_deposit(deposit_id: int, db: Session = Depends(get_db)):
    deposit = db.query(FixedDeposit).filter(FixedDeposit.id == deposit_id).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="定期产品不存在")
    return deposit


@router.post("", response_model=FixedDepositResponse)
def create_fixed_deposit(deposit_data: FixedDepositCreate, db: Session = Depends(get_db)):
    deposit = FixedDeposit(**deposit_data.model_dump())
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    return deposit


@router.put("/{deposit_id}", response_model=FixedDepositResponse)
def update_fixed_deposit(
    deposit_id: int, deposit_data: FixedDepositUpdate, db: Session = Depends(get_db)
):
    deposit = db.query(FixedDeposit).filter(FixedDeposit.id == deposit_id).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="定期产品不存在")
    update_data = deposit_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(deposit, key, value)
    db.commit()
    db.refresh(deposit)
    return deposit


@router.delete("/{deposit_id}")
def delete_fixed_deposit(deposit_id: int, db: Session = Depends(get_db)):
    deposit = db.query(FixedDeposit).filter(FixedDeposit.id == deposit_id).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="定期产品不存在")
    db.delete(deposit)
    db.commit()
    return {"message": "删除成功"}
