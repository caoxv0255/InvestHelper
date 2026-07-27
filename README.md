# 投资决策优化助手（Investment Advisor）

面向个人投资者的投资决策优化 Web 应用，整合多平台持仓数据，提供资产概览、K线图表等核心功能。

## 功能特性

### MVP 版本
- **持仓管理**：支持支付宝、招商银行、同花顺等多平台持仓的手动录入、编辑、删除
- **资产仪表盘**：总资产、总收益、各周期收益率一览，资产分布饼图，平台收益对比
- **K线图表**：专业级K线图表，支持日K/周K、MA均线、MACD/KDJ指标、十字光标、缩放拖拽
- **市场概览**：主要指数实时行情展示

### 后续规划
- 风险分散度分析（VaR、相关性矩阵）
- 技术信号研判与择时建议
- 市场情绪仪表盘
- 板块热点轮动
- 财经快讯聚合
- 投资机会捕捉
- 策略回测

## 技术栈

### 前端
- React 18 + TypeScript
- Vite（构建工具）
- TailwindCSS v4（样式框架）
- React Router（路由）
- TanStack Query（数据状态管理）
- Zustand（全局状态）
- Lightweight Charts（K线图表）
- ECharts（数据可视化）
- Lucide React（图标）

### 后端
- Python 3.11 + FastAPI
- SQLAlchemy 2.x（ORM）
- SQLite（本地数据库）
- Pydantic v2（数据校验）
- AKShare（财经数据接口）
- NumPy / pandas（数据处理）

## 项目结构

```
workspace/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── main.py          # 应用入口
│   │   ├── config.py        # 配置管理
│   │   ├── database.py      # 数据库连接
│   │   ├── models/          # 数据模型
│   │   ├── schemas/         # Pydantic 模型
│   │   ├── routers/         # API 路由
│   │   ├── services/        # 业务逻辑
│   │   └── data_providers/  # 数据源接入
│   ├── data/                # SQLite 数据库
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                # React 前端
│   ├── src/
│   │   ├── components/      # 组件
│   │   ├── pages/           # 页面
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── services/        # API 服务
│   │   ├── types/           # TypeScript 类型
│   │   ├── utils/           # 工具函数
│   │   └── store/           # 全局状态
│   └── package.json
│
└── README.md
```

## 快速开始

### 环境要求
- Python 3.11+
- Node.js 18+
- npm 或 pnpm

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务（默认端口 8000）
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API 文档：http://localhost:8000/docs

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器（默认端口 5173）
npm run dev
```

访问：http://localhost:5173

### 同时运行

前端已配置代理，将 `/api` 请求转发到 `http://localhost:8000`，前后端需同时启动。

## API 接口

### 持仓管理
- `GET /api/holdings` - 获取持仓列表
- `POST /api/holdings` - 新增持仓
- `PUT /api/holdings/{id}` - 更新持仓
- `DELETE /api/holdings/{id}` - 删除持仓

### 仪表盘
- `GET /api/dashboard/summary` - 资产总览
- `GET /api/dashboard/distribution` - 资产分布
- `GET /api/dashboard/platform-compare` - 平台收益对比

### 行情数据
- `GET /api/market/search` - 搜索标的
- `GET /api/market/kline/{code}` - K线数据（含技术指标）
- `GET /api/market/quote/{code}` - 实时行情
- `GET /api/market/indices` - 主要指数

## 数据库

首次启动后端时自动创建 SQLite 数据库（`backend/data/investment.db`），包含以下表：

- `holdings` - 持仓表
- `fixed_deposits` - 定期理财表
- `market_data_cache` - 行情缓存表

## 免责声明

本应用仅供个人投资辅助参考，**不构成任何投资建议**。

- 投资有风险，决策需谨慎
- 所有数据来源于公开市场，准确性不作保证
- 用户持仓数据存储在本地，不上传任何第三方服务器

## License

MIT
