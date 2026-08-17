# InvestHelper - 投资助手

一个现代化的投资分析与管理工具，帮助用户进行投资决策、持仓管理、风险分析和机会发现。

## 项目结构

```
InvestHelper/
├── frontend/          # 前端 (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/   # 组件
│   │   ├── pages/        # 页面
│   │   ├── api/          # API 接口
│   │   ├── utils/        # 工具函数
│   │   ├── types/        # TypeScript 类型
│   │   ├── hooks/        # 自定义 Hooks
│   │   └── styles/       # 样式文件
│   ├── .env.development
│   ├── .env.production
│   └── package.json
├── backend/           # 后端 (FastAPI + Python)
│   ├── app/
│   │   ├── api/          # API 路由
│   │   ├── models/       # 数据模型
│   │   ├── schemas/      # Pydantic 模式
│   │   ├── services/     # 业务逻辑
│   │   ├── core/         # 核心配置
│   │   └── db/           # 数据库
│   ├── requirements.txt
│   └── .env
├── .gitignore
└── README.md
```

## 功能模块

- **仪表盘** - 投资概览与数据总览
- **持仓管理** - 管理投资组合
- **K线图表** - 股票/基金走势分析
- **风险分析** - 投资组合风险评估
- **市场快讯** - 实时市场动态
- **投资机会** - 基于数据的机会推荐
- **策略实验室** - 在本地用历史价格测试趋势、动量、再平衡和买入持有策略

## 快速开始

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端将在 http://localhost:5173 启动

### 后端

```bash
cd backend
uv sync                              # 或 pip install -r requirements.txt（兼容路径）
uv run alembic upgrade head          # 首次启动必须
uv run uvicorn app.main:app --reload --port 8000
```

后端将在 http://localhost:8000 启动

## 技术栈

### 前端
- React 18
- TypeScript
- Vite
- React Router
- ECharts
- Lightweight Charts
- Axios
- ESLint + Prettier

### 后端
- FastAPI
- SQLAlchemy
- Pydantic
- SQLite (开发)
- Alembic

## API 接口

- `GET /api/health` - 健康检查
- `GET /api/dashboard/summary` - 仪表盘汇总（含基于快照差分的真实周期收益）
- `GET /api/holdings` `POST /api/holdings` `PUT /api/holdings/{id}` `DELETE /api/holdings/{id}`
- `GET /api/deposits` `POST /api/deposits` `PUT /api/deposits/{id}` `DELETE /api/deposits/{id}`
- `GET /api/transactions` `POST /api/transactions` `PUT /api/transactions/{id}` `DELETE /api/transactions/{id}`
- `GET /api/market/kline` `GET /api/market/search`
- `GET /api/signals/batch`
- `GET /api/position/suggestions` `GET /api/position/alerts`
- `POST /api/strategy/backtests` `POST /api/strategy/optimize`
- `GET /api/portfolio/snapshot/capture` `GET /api/portfolio/history` `GET /api/portfolio/daily-report`
- `GET /api/risk/analysis`
- `GET /api/news` `GET /api/news/important`
- `GET /api/sector/strength` `GET /api/sector/heatmap` `GET /api/sector/style-rotation`
- `GET /api/sentiment/fear-greed` `GET /api/sentiment/composite` `GET /api/sentiment/overview`
- `GET /api/opportunities` `GET /api/opportunities/history` `POST /api/opportunities/scan`

完整 OpenAPI 文档：启动后访问 `http://localhost:8000/docs`。

## 开发说明

- 前端代理 `/api` 到后端 8000 端口
- 后端 CORS 允许前端 5173 端口访问
- 开发模式使用 SQLite 数据库
- **首次启动请运行 `alembic upgrade head`**，再可选 `python -m scripts.seed` 写入样例数据

## 第一次启动踩坑提示

1. **数据全部为空** → 默认安装后数据库为空，仪表盘/风险/机会页面都会"暂无数据"。先到 `/portfolio` 录入持仓，或运行 `python -m scripts.seed` 写入样例持仓/定期/交易/新闻/机会。
2. **AKShare 报接口错误** → 多为 IP 限流，重试即可；Tushare token 可在 `.env` 中配置作为备用源。
3. **CORS 报错** → 确认 `backend/.env` 中 `CORS_ORIGINS` 包含 `http://localhost:5173`。
4. **仪表盘周期收益显示"暂无历史"** → 这是预期行为。`portfolio_snapshots` 表需要积累历史，每日 0 点 15 分钟后由后台任务写入快照；之后即可看到真实日/周/月/年收益。也可以手动访问 `/api/portfolio/snapshot/capture` 触发。
5. **策略实验室默认用示例数据** → 顶部会显示橙色"⚠️ 当前使用示例数据"横幅；先点击"加载 AKShare 行情"再"运行回测"才会得到真实结果。
6. **风险分析报 504** → 已为接口加 60 秒超时，因行情数据源限流可能短暂超时，请稍后重试。
7. **板块轮动"强弱切换"** → 已改用 `ak.stock_board_industry_hist_em` 对每个板块单独取历史 K 线后差分计算，结果真实可信。

## 一键启动（Docker）

```bash
docker compose up --build
```

启动后访问 http://localhost:8080 ；后端服务在容器内 :8000，redis 在容器内 :6379。
停止：`docker compose down`（加 `-v` 同时删除卷）。

## 本地开发

后端用 [uv](https://docs.astral.sh/uv/) 管理依赖（pyproject.toml + uv.lock）；前端用 npm。

```bash
# 后端
cd backend
uv sync                                # 按 uv.lock 装依赖到 .venv
cp .env.example .env
uv run alembic upgrade head            # 首次启动必须
uv run python -m scripts.seed          # 可选：写入样例数据
uv run uvicorn app.main:app --reload --port 8000

# 前端（另开终端）
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173 （前端）+ http://localhost:8000/docs （后端 OpenAPI）。

> **pip 兼容路径**：`requirements.txt` 仍保留作为等价依赖清单供 pip 用户使用；新增依赖请同步改 `pyproject.toml` 并 `uv lock`。

## 运行测试

所有测试使用 pytest，统一通过 `conftest.py` 提供 in-memory SQLite + FastAPI TestClient fixture：

```bash
cd backend
pip install pytest httpx          # 一次性：装测试 deps
pytest                            # 跑全部
pytest tests/test_api.py          # 只跑 API 集成
pytest -m "not slow"              # 跳过标记为 slow 的测试
pytest -k "holdings"              # 按名字过滤
```

测试结构：

```
backend/tests/
├── conftest.py            # 共享 fixtures：engine / db_session / client / 禁后台任务
├── test_core.py           # 核心业务逻辑（MemoryCache / 周期收益差分 / sentiment）
├── test_crud.py           # 各模型 CRUD
├── test_api.py            # API 集成（health + holdings + deposits CRUD）
├── test_dashboard.py      # 仪表盘 API
└── test_risk.py           # 风险分析 API
```

## 策略实验室说明

策略实验室前端默认加载"示例数据"以验证功能。顶部出现橙色横幅时表示当前为示例资产；点击"加载 AKShare 行情"输入真实代码（例如 `000300,510300`）即可获取真实历史 K 线后回测。回测引擎严格执行无未来函数（按 `index+1` 决定当期权重）并应用最大回撤、单标的上限、月度交易次数、最低调仓金额约束。

**回测结果仅用于研究，不代表未来收益，也不构成投资建议。**
