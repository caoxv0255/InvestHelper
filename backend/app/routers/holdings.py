from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models.holding import Holding
from ..schemas.holding import (
    HoldingCreate,
    HoldingUpdate,
    HoldingResponse,
    HoldingListResponse,
)

router = APIRouter()


@router.get("", response_model=HoldingListResponse)
def get_holdings(
    platform: Optional[str] = Query(None, description="平台筛选"),
    asset_type: Optional[str] = Query(None, description="资产类型筛选"),
    db: Session = Depends(get_db),
):
    query = db.query(Holding)
    if platform:
        query = query.filter(Holding.platform == platform)
    if asset_type:
        query = query.filter(Holding.asset_type == asset_type)
    items = query.order_by(Holding.created_at.desc()).all()
    return HoldingListResponse(total=len(items), items=items)


@router.get("/{holding_id}", response_model=HoldingResponse)
def get_holding(holding_id: int, db: Session = Depends(get_db)):
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="持仓不存在")
    return holding


@router.post("", response_model=HoldingResponse)
def create_holding(holding_data: HoldingCreate, db: Session = Depends(get_db)):
    holding = Holding(**holding_data.model_dump())
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return holding


@router.put("/{holding_id}", response_model=HoldingResponse)
def update_holding(
    holding_id: int, holding_data: HoldingUpdate, db: Session = Depends(get_db)
):
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="持仓不存在")
    update_data = holding_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(holding, key, value)
    db.commit()
    db.refresh(holding)
    return holding


@router.delete("/{holding_id}")
def delete_holding(holding_id: int, db: Session = Depends(get_db)):
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="持仓不存在")
    db.delete(holding)
    db.commit()
    return {"message": "删除成功"}
