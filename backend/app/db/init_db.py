"""数据库初始化脚本，运行时自动创建所有表"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import engine, Base
from app.models import *  # noqa: F401, F403 - 导入所有模型以确保注册到 Base.metadata


def init_db():
    """初始化数据库，创建所有表"""
    print("开始初始化数据库...")
    Base.metadata.create_all(bind=engine)
    print("数据库初始化完成，所有表已创建。")


if __name__ == "__main__":
    init_db()
