"""pytest 共享 fixtures

设计目标：
- 每个测试函数用独立内存 SQLite，完全隔离（不污染 invest_helper.db）
- 通过 FastAPI dependency override 把 /api/* 路由拉到测试 DB
- 禁用 lifespan 中的后台任务（避免测试期间跑真实网络/定时）

使用示例：

    def test_health(client):
        r = client.get("/api/health")
        assert r.status_code == 200


    def test_create_holding(client, db_session):
        r = client.post("/api/holdings", json={...})
        assert r.status_code == 200
        # db_session 可选：用于直接断言数据库状态
"""
import os
import sys
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# 让 pytest 能 import app（与项目 src-layout 配合）
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings  # noqa: E402
from app.db.session import Base, get_db  # noqa: E402
from app.models import *  # noqa: E402, F401, F403 - 注册所有模型到 Base.metadata
import app.main as main_module  # noqa: E402


# ===== 后台任务控制 =====

@pytest.fixture(autouse=True)
def _disable_background_tasks(monkeypatch: pytest.MonkeyPatch) -> None:
    """默认禁用 lifespan 启动的后台任务（每日快照、新闻抓取）。

    理由：测试不应触发真实网络请求或定时写入。
    """
    monkeypatch.setattr(settings, "DAILY_SNAPSHOT_ENABLED", False)
    monkeypatch.setattr(settings, "NEWS_CRAWL_ENABLED", False)


# ===== 数据库 fixtures =====

@pytest.fixture(scope="function")
def engine():
    """每个测试函数一个全新的内存 SQLite engine。

    用 StaticPool 强制单连接（SQLite in-memory 默认每个连接独立 DB）。
    """
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    try:
        yield eng
    finally:
        eng.dispose()


@pytest.fixture(scope="function")
def db_session(engine) -> Session:
    """函数级 SQLAlchemy Session，每个测试干净开始干净结束。"""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ===== FastAPI client =====

@pytest.fixture(scope="function")
def client(db_session: Session) -> Any:
    """FastAPI TestClient，get_db 被 override 到测试 session。

    测试结束后清理 dependency_overrides，防止跨测试污染。
    """
    def _override_get_db():
        try:
            yield db_session
        finally:
            # session 由 db_session fixture 管理，此处不再 close
            pass

    main_module.app.dependency_overrides[get_db] = _override_get_db
    try:
        with TestClient(main_module.app) as c:
            yield c
    finally:
        main_module.app.dependency_overrides.clear()