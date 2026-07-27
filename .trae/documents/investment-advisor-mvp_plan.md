# 投资决策优化应用 - MVP 实施计划

## 一、项目概述

### 1.1 项目目标
开发一款面向个人投资者的投资决策优化 Web 应用 MVP 版本，整合多平台持仓数据，提供资产概览、K线图表等核心功能。

### 1.2 技术栈
| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端 | React 18 + TypeScript + Vite | 组件化开发 |
| UI框架 | TailwindCSS + shadcn/ui | 快速构建界面 |
| K线图表 | Lightweight Charts | TradingView 开源轻量版 |
| 数据可视化 | ECharts 5 | 仪表盘、饼图、柱状图 |
| 状态管理 | React Query + Zustand | 服务端状态 + 客户端状态 |
| 后端 | Python 3.11 + FastAPI | 高性能异步框架 |
| 数据库 | SQLite + SQLAlchemy 2.x | 本地存储 + ORM |
| 数据源 | AKShare | 免费A股/基金数据接口 |
| 数据校验 | Pydantic v2 | 请求/响应模型校验 |

### 1.3 架构模式
本地优先架构：后端 + 前端 + SQLite 本地数据库，数据完全存储在本地。

---

## 二、MVP 功能范围

### 2.1 已确认包含功能
| 模块 | 功能点 | 优先级 |
|------|--------|--------|
| **持仓管理** | 手动录入/编辑/删除持仓（基金/股票/定期） | P0 |
| **资产仪表盘** | 总资产、总收益、日/周/月/年收益率 | P0 |
|  | 按平台/资产类型分布饼图 | P0 |
|  | 各平台收益对比 | P1 |
| **K线图表** | 日K/周K切换 | P0 |
|  | MA5/MA10/MA20 均线叠加 | P0 |
|  | MACD 副图指标 | P0 |
|  | KDJ 副图指标 | P1 |
|  | 十字光标跟随 | P0 |
|  | 鼠标滚轮缩放 | P0 |
|  | 拖拽浏览历史K线 | P0 |
|  | 股票/基金/指数搜索 | P0 |
| **市场概览** | 主要指数实时行情 | P1 |
|  | 涨跌家数统计 | P2 |

### 2.2 后续迭代功能（暂不包含）
- 风险分散度分析（VaR、相关性矩阵）
- 技术信号研判与择时建议
- 市场情绪仪表盘
- 板块热点轮动
- 财经快讯聚合
- 投资机会捕捉
- 策略回测
- 定期理财到期提醒

---

## 三、项目目录结构

```
workspace/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI 应用入口
│   │   ├── config.py               # 配置管理
│   │   ├── database.py             # 数据库连接与初始化
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── holding.py          # 持仓模型
│   │   │   ├── fixed_deposit.py    # 定期理财模型
│   │   │   └── market_cache.py     # 行情缓存模型
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── holding.py          # 持仓 Pydantic 模型
│   │   │   ├── fixed_deposit.py    # 定期 Pydantic 模型
│   │   │   ├── dashboard.py        # 仪表盘响应模型
│   │   │   └── market.py           # 行情响应模型
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── holdings.py         # 持仓管理 API
│   │   │   ├── fixed_deposits.py   # 定期理财 API
│   │   │   ├── dashboard.py        # 仪表盘 API
│   │   │   └── market.py           # 行情数据 API
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── holding_service.py  # 持仓业务逻辑
│   │   │   ├── dashboard_service.py# 仪表盘计算逻辑
│   │   │   └── indicator_service.py# 技术指标计算
│   │   └── data_providers/
│   │       ├── __init__.py
│   │       └── akshare_provider.py # AKShare 数据接入
│   ├── data/
│   │   └── investment.db           # SQLite 数据库文件（运行时生成）
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn/ui 基础组件
│   │   │   ├── layout/             # 布局组件
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Layout.tsx
│   │   │   ├── dashboard/          # 仪表盘组件
│   │   │   │   ├── StatCard.tsx
│   │   │   │   ├── AssetPieChart.tsx
│   │   │   │   └── PlatformCompareChart.tsx
│   │   │   ├── holdings/           # 持仓组件
│   │   │   │   ├── HoldingList.tsx
│   │   │   │   ├── HoldingForm.tsx
│   │   │   │   └── HoldingCard.tsx
│   │   │   └── kline/              # K线图表组件
│   │   │       ├── KlineChart.tsx
│   │   │       ├── SearchBar.tsx
│   │   │       └── IndicatorPanel.tsx
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── HoldingsPage.tsx
│   │   │   ├── KlinePage.tsx
│   │   │   └── MarketPage.tsx
│   │   ├── hooks/
│   │   │   ├── useHoldings.ts
│   │   │   ├── useKlineData.ts
│   │   │   └── useDashboard.ts
│   │   ├── services/
│   │   │   ├── api.ts              # Axios 实例与拦截器
│   │   │   ├── holdings.ts         # 持仓 API
│   │   │   ├── dashboard.ts        # 仪表盘 API
│   │   │   └── market.ts           # 行情 API
│   │   ├── types/
│   │   │   ├── holding.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── kline.ts
│   │   │   └── market.ts
│   │   ├── utils/
│   │   │   ├── format.ts           # 数字/日期格式化
│   │   │   └── color.ts            # 颜色工具（红涨绿跌）
│   │   ├── store/
│   │   │   └── useAppStore.ts      # Zustand 全局状态
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
└── README.md
```

---

## 四、数据库设计

### 4.1 holdings 表（持仓表）
| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| platform | String(20) | not null | 平台：alipay/merchants_bank/ths |
| platform_name | String(50) | | 平台显示名称 |
| asset_type | String(20) | not null | 类型：fund/stock/deposit |
| code | String(20) | not null | 标的代码 |
| name | String(100) | not null | 标的名称 |
| quantity | Float | not null, default 0 | 持仓数量/份额 |
| cost_price | Float | not null, default 0 | 成本价/净值 |
| current_price | Float | default 0 | 当前价格（缓存） |
| current_price_updated | DateTime | | 当前价格更新时间 |
| buy_date | Date | | 买入日期 |
| notes | Text | | 备注 |
| created_at | DateTime | default now | 创建时间 |
| updated_at | DateTime | default now, onupdate now | 更新时间 |

### 4.2 fixed_deposits 表（定期理财表）
| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| bank | String(50) | not null | 银行名称 |
| product_name | String(100) | not null | 产品名称 |
| principal | Float | not null, default 0 | 本金 |
| annual_rate | Float | not null, default 0 | 年利率（%） |
| start_date | Date | not null | 起息日 |
| end_date | Date | not null | 到期日 |
| interest_method | String(20) | default 'simple' | 计息方式：simple/compound |
| notes | Text | | 备注 |
| created_at | DateTime | default now | 创建时间 |
| updated_at | DateTime | default now, onupdate now | 更新时间 |

### 4.3 market_data_cache 表（行情缓存表）
| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | Integer | PK, autoincrement | 主键 |
| code | String(20) | not null, index | 标的代码 |
| data_type | String(20) | not null | 类型：daily/weekly/minute |
| data_date | Date | not null | 数据日期 |
| data_json | Text | not null | JSON 格式行情数据 |
| updated_at | DateTime | default now | 更新时间 |

索引：(code, data_type, data_date) 唯一索引

---

## 五、API 接口设计

### 5.1 持仓管理 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/holdings` | 获取所有持仓列表（支持按平台、类型筛选） |
| GET | `/api/holdings/{id}` | 获取单个持仓详情 |
| POST | `/api/holdings` | 新增持仓 |
| PUT | `/api/holdings/{id}` | 更新持仓 |
| DELETE | `/api/holdings/{id}` | 删除持仓 |
| PATCH | `/api/holdings/{id}/refresh-price` | 刷新当前价格 |

### 5.2 定期理财 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/fixed-deposits` | 获取所有定期列表 |
| GET | `/api/fixed-deposits/{id}` | 获取单个定期详情 |
| POST | `/api/fixed-deposits` | 新增定期 |
| PUT | `/api/fixed-deposits/{id}` | 更新定期 |
| DELETE | `/api/fixed-deposits/{id}` | 删除定期 |

### 5.3 仪表盘 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard/summary` | 资产总览（总资产、总收益、各周期收益率） |
| GET | `/api/dashboard/distribution` | 资产分布（按平台、按类型） |
| GET | `/api/dashboard/platform-compare` | 各平台收益对比 |

### 5.4 行情数据 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/market/search` | 搜索标的（股票/基金/指数） |
| GET | `/api/market/quote/{code}` | 获取单只标的实时行情 |
| GET | `/api/market/kline/{code}` | 获取K线数据（支持 period 参数：daily/weekly） |
| GET | `/api/market/indices` | 获取主要指数行情列表 |

### 5.5 技术指标 API
K线数据接口返回时即包含计算好的指标数据，减少前端计算负担。

返回数据结构示例：
```json
{
  "code": "000001",
  "name": "平安银行",
  "period": "daily",
  "data": [
    {
      "time": "2024-01-15",
      "open": 10.5,
      "high": 10.8,
      "low": 10.3,
      "close": 10.6,
      "volume": 12345678,
      "ma5": 10.55,
      "ma10": 10.42,
      "ma20": 10.38,
      "macd_dif": 0.15,
      "macd_dea": 0.12,
      "macd_hist": 0.06,
      "kdj_k": 65.2,
      "kdj_d": 58.7,
      "kdj_j": 78.2
    }
  ]
}
```

---

## 六、前端页面设计

### 6.1 整体布局
- 顶部导航栏：Logo + 页面导航（仪表盘/持仓管理/K线图表/市场概览）
- 主内容区：当前页面内容
- 采用响应式设计，适配 1366x768 及以上分辨率

### 6.2 仪表盘页面
顶部 4 个统计卡片：
- 总资产
- 总收益（带收益率百分比）
- 今日收益
- 今年收益

中间区域：
- 左：资产分布饼图（按类型 / 按平台切换）
- 右：各平台收益对比柱状图

底部：
- 持仓汇总表格（按平台分组展示）

### 6.3 持仓管理页面
- 顶部：平台筛选 Tab（全部/支付宝/招商银行/同花顺）
- 操作区：新增持仓按钮
- 持仓列表：卡片或表格形式展示
- 点击编辑弹出表单对话框

持仓表单字段：
- 平台（下拉选择）
- 资产类型（下拉：基金/股票/定期）
- 代码（输入框）
- 名称（输入框）
- 持仓数量（数字输入）
- 成本价（数字输入）
- 买入日期（日期选择器）
- 备注（文本域）

### 6.4 K线图表页面
- 顶部：搜索框 + 周期切换按钮（日K/周K）
- 主图：K线 + MA5/MA10/MA20 均线
- 副图1：MACD（DIF/DEA/柱状图）
- 副图2：KDJ（K/D/J 线）
- 指标开关：可切换显示/隐藏各指标
- 十字光标：显示 OHLCV 及各指标数值

### 6.5 市场概览页面
- 主要指数卡片（上证指数、深证成指、创业板指、沪深300）
- 指数展示当前点位、涨跌幅、涨跌额
- 红涨绿跌配色

---

## 七、实施步骤

### Phase 1：项目初始化与基础框架
**目标：** 搭建前后端项目骨架，数据库初始化

1. 初始化后端 FastAPI 项目
   - 创建项目目录结构
   - 配置依赖（requirements.txt）
   - 配置数据库连接（SQLite + SQLAlchemy）
   - 实现数据库初始化脚本
   - 创建 FastAPI 应用入口（main.py）

2. 初始化前端 React 项目
   - 使用 Vite 创建 React + TypeScript 项目
   - 配置 TailwindCSS
   - 初始化 shadcn/ui 组件库
   - 配置路由（React Router）
   - 配置 Axios 与 React Query
   - 创建基础布局组件（Header + Sidebar）

### Phase 2：数据模型与基础 API
**目标：** 完成数据库模型、持仓 CRUD API

1. 后端数据模型
   - 创建 Holding 模型
   - 创建 FixedDeposit 模型
   - 创建 MarketDataCache 模型
   - 数据库迁移/建表

2. 持仓管理 API
   - Pydantic schemas 定义
   - 实现持仓 CRUD 接口
   - 实现定期理财 CRUD 接口
   - API 单元测试

### Phase 3：仪表盘 API 与业务逻辑
**目标：** 完成资产概览计算逻辑与 API

1. 仪表盘业务逻辑
   - 总资产计算逻辑
   - 总收益/收益率计算逻辑
   - 按平台/按类型资产分布统计
   - 各平台收益对比计算

2. 仪表盘 API
   - 实现 summary 接口
   - 实现 distribution 接口
   - 实现 platform-compare 接口

### Phase 4：行情数据接入
**目标：** 接入 AKShare，实现行情数据获取与缓存

1. AKShare 数据接入层
   - 封装 AKShare 调用
   - 股票日线数据获取
   - 基金净值数据获取
   - 指数行情数据获取
   - 标的搜索功能

2. 行情缓存机制
   - 实现行情数据缓存服务
   - 缓存过期策略（日线数据当日有效）
   - 缓存读取/写入逻辑

3. 行情 API
   - 搜索接口
   - 实时行情接口
   - K线数据接口（含指标计算）
   - 主要指数接口

### Phase 5：技术指标计算
**目标：** 在后端完成常用技术指标计算

1. 指标计算服务
   - MA 均线计算（MA5/MA10/MA20）
   - MACD 计算（DIF/DEA/MACD）
   - KDJ 计算（K/D/J）
   - 指标计算单元测试

2. K线数据集成
   - K线接口整合指标数据
   - 数据格式统一

### Phase 6：前端 - 持仓管理页面
**目标：** 完成持仓录入、编辑、列表展示

1. 前端类型定义
   - Holding / FixedDeposit 类型
   - API 响应类型

2. API 服务层
   - 封装持仓相关 API 调用
   - React Query Hooks

3. 持仓列表组件
   - 持仓卡片/表格
   - 平台筛选
   - 新增/编辑/删除操作

4. 持仓表单组件
   - 表单验证
   - 平台/类型联动
   - 对话框形式

### Phase 7：前端 - 仪表盘页面
**目标：** 完成资产概览仪表盘

1. 仪表盘 API Hooks
   - useDashboardSummary
   - useDashboardDistribution

2. 统计卡片组件
   - 总资产卡片
   - 收益卡片（带颜色区分涨跌）
   - 数字格式化（千分位、百分比）

3. 图表组件
   - 资产分布饼图（ECharts）
   - 平台收益对比柱状图（ECharts）
   - 图表配色（红涨绿跌）

4. 仪表盘页面组装

### Phase 8：前端 - K线图表页面
**目标：** 完成专业K线图表功能

1. K线数据服务
   - K线数据 API 封装
   - 搜索 API 封装

2. 搜索组件
   - 搜索输入框
   - 搜索结果下拉列表
   - 热门标的快捷选择

3. K线图表组件（Lightweight Charts）
   - K线主图渲染
   - MA 均线叠加
   - 十字光标实现
   - 缩放与拖拽
   - 周期切换（日K/周K）

4. 副图指标
   - MACD 副图（双线 + 柱状图）
   - KDJ 副图（三线）
   - 指标显示/隐藏切换

5. K线页面组装

### Phase 9：前端 - 市场概览页面
**目标：** 完成主要指数行情展示

1. 市场行情 API Hooks
2. 指数卡片组件
3. 市场概览页面

### Phase 10：联调与优化
**目标：** 前后端联调，功能完善，性能优化

1. 前后端联调
   - 修复接口联调问题
   - 数据格式对齐
   - 错误处理完善

2. 体验优化
   - 加载状态
   - 空状态提示
   - 错误提示
   - 响应式布局调整

3. 性能优化
   - 数据缓存策略优化
   - 图表懒加载
   - 接口请求防抖

---

## 八、关键技术点与解决方案

### 8.1 K线图表性能
- 使用 Lightweight Charts 的 Canvas 渲染
- 数据按需加载，初始加载最近 N 条
- 历史数据滚动加载

### 8.2 数据缓存策略
- SQLite 本地缓存行情数据
- 日线数据：当日缓存，收盘后失效
- 缓存 key：code + data_type + date
- AKShare 请求失败时使用缓存数据降级

### 8.3 红涨绿跌配色
- A 股惯例：红色表示涨，绿色表示跌
- 定义全局颜色常量
- 涨跌颜色判断工具函数

### 8.4 前后端数据契约
- 使用 Pydantic 严格定义接口数据结构
- 前端 TypeScript 类型与后端对齐
- 统一响应格式：
  ```json
  {
    "code": 0,
    "message": "success",
    "data": {}
  }
  ```

### 8.5 错误处理
- 后端统一异常处理中间件
- 前端 Axios 拦截器统一处理错误
- 用户友好的错误提示

---

## 九、风险与应对

| 风险点 | 影响 | 应对措施 |
|--------|------|----------|
| AKShare 接口变更或不可用 | 行情数据获取失败 | 1. 做好本地缓存降级 2. 预留 Tushare 接入能力 |
| AKShare 请求频率限制 | 数据获取慢 | 1. 加强本地缓存 2. 请求间隔控制 |
| Lightweight Charts 学习成本 | K线开发进度 | 1. 先实现基础功能 2. 参考官方文档示例 |
| 基金净值数据质量 | 收益计算不准 | 1. 数据源验证 2. 允许用户手动修正 |

---

## 十、交付物

1. 完整源代码（前端 + 后端）
2. 数据库自动初始化（首次运行自动建表）
3. README.md（项目说明、启动方式）
4. 配置示例文件（.env.example）
5. API 文档（FastAPI 自动生成 Swagger UI）
