from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.holdings import Holding
from app.schemas.holdings import HoldingCreate, HoldingUpdate, HoldingResponse

router = APIRouter()


@router.get("/holdings", response_model=List[HoldingResponse])
async def get_holdings(
    platform: Optional[str] = Query(None, description="按平台筛选: alipay/cmb/ths"),
    asset_type: Optional[str] = Query(None, description="按资产类型筛选: fund/stock/deposit"),
    db: Session = Depends(get_db),
):
    """获取持仓列表，支持按平台和资产类型筛选"""
    query = db.query(Holding)
    if platform:
        query = query.filter(Holding.platform == platform)
    if asset_type:
        query = query.filter(Holding.asset_type == asset_type)
    return query.order_by(Holding.created_at.desc()).all()


@router.get("/holdings/{holding_id}", response_model=HoldingResponse)
async def get_holding(holding_id: int, db: Session = Depends(get_db)):
    """根据ID获取单条持仓"""
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="持仓记录不存在")
    return holding


@router.post("/holdings", response_model=HoldingResponse)
async def create_holding(holding: HoldingCreate, db: Session = Depends(get_db)):
    """创建新的持仓记录"""
    db_holding = Holding(**holding.model_dump())
    db.add(db_holding)
    db.commit()
    db.refresh(db_holding)
    return db_holding


@router.put("/holdings/{holding_id}", response_model=HoldingResponse)
async def update_holding(
    holding_id: int,
    holding_update: HoldingUpdate,
    db: Session = Depends(get_db),
):
    """更新持仓记录"""
    db_holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not db_holding:
        raise HTTPException(status_code=404, detail="持仓记录不存在")

    update_data = holding_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_holding, key, value)

    db.commit()
    db.refresh(db_holding)
    return db_holding


@router.delete("/holdings/{holding_id}")
async def delete_holding(holding_id: int, db: Session = Depends(get_db)):
    """删除持仓记录"""
    db_holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not db_holding:
        raise HTTPException(status_code=404, detail="持仓记录不存在")

    db.delete(db_holding)
    db.commit()
    return {"message": "删除成功", "id": holding_id}
