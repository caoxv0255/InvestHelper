# 后端 Dockerfile
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 安装系统依赖（akshare 偶尔需要编译）
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

EXPOSE 8000

# 默认启动 alembic 迁移 + uvicorn。可通过 docker compose 的 command 覆盖。
CMD ["sh", "-c", "alembic upgrade head && python -m scripts.seed --keep || true; uvicorn app.main:app --host 0.0.0.0 --port 8000"]