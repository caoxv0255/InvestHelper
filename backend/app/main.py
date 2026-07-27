from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import init_db
from .routers import holdings, fixed_deposits, dashboard, market

app = FastAPI(
    title=settings.app_name,
    description="面向个人投资者的投资决策优化应用",
    version="0.1.0",
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": settings.app_name}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": str(exc), "data": None},
    )


app.include_router(holdings.router, prefix=f"{settings.api_prefix}/holdings", tags=["持仓管理"])
app.include_router(fixed_deposits.router, prefix=f"{settings.api_prefix}/fixed-deposits", tags=["定期理财"])
app.include_router(dashboard.router, prefix=f"{settings.api_prefix}/dashboard", tags=["仪表盘"])
app.include_router(market.router, prefix=f"{settings.api_prefix}/market", tags=["行情数据"])
