export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface HealthInfo {
  status: string
  timestamp: string
}

export interface StockInfo {
  code: string
  name: string
  price: number
  change: number
  changePercent: number
}

export interface PortfolioItem {
  id: string
  stockCode: string
  stockName: string
  quantity: number
  costPrice: number
  currentPrice: number
  profit: number
  profitPercent: number
}

/** K线数据 */
export interface KLineData {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** 均线数据 */
export interface MALineData {
  time: string
  value: number
}

/** MACD 指标数据 */
export interface MACDData {
  time: string
  dif: number
  dea: number
  histogram: number
}

/** KDJ 指标数据 */
export interface KDJData {
  time: string
  k: number
  d: number
  j: number
}

/** 成交量数据 */
export interface VolumeData {
  time: string
  value: number
  color: string
}

/** 指标数据集 */
export interface IndicatorData {
  ma5: MALineData[]
  ma10: MALineData[]
  ma20: MALineData[]
  macd: MACDData[]
  kdj: KDJData[]
  volume: VolumeData[]
}

/** K线周期 */
export type Period = 'daily' | 'weekly' | '60min' | '30min' | '15min' | '5min'

/** 技术信号评级 */
export type SignalRating = 'buy' | 'sell' | 'hold' | 'neutral'

/** 单维度技术信号 */
export interface TechnicalSignalItem {
  category: 'MA' | 'MACD' | 'KDJ' | 'VOLUME'
  valid: boolean
  reason?: string
  signals: string[]
  ma5?: number
  ma10?: number
  ma20?: number
  dif?: number
  dea?: number
  histogram?: number
  k?: number
  d?: number
  j?: number
  volume?: number
  vol_ma5?: number
}

/** 技术信号分析结果 */
export interface TechnicalSignal {
  code: string
  name: string
  period: string
  signals: TechnicalSignalItem[]
  rating: SignalRating
  score: number
  reasons: string[]
  error?: string
}

/** 批量信号请求单项 */
export interface SignalBatchItem {
  code: string
  period?: string
  asset_type?: string
}

/** 批量信号响应 */
export interface SignalBatchResponse {
  total: number
  success: number
  failed: number
  results: TechnicalSignal[]
  errors: { item: SignalBatchItem; error: string }[]
}

/** 搜索结果 */
export interface StockSearchResult {
  code: string
  name: string
  type: 'stock' | 'fund' | 'index'
}

/** 平台类型 */
export type PlatformType = 'alipay' | 'cmb' | 'ths'

/** 资产类型 */
export type AssetType = 'fund' | 'stock' | 'deposit'

/** 持仓信息 */
export interface Holding {
  id: number
  platform: string
  asset_type: string
  code: string
  name: string
  quantity: number
  cost_price: number
  current_price: number | null
  take_profit_price: number | null
  stop_loss_price: number | null
  industry: string | null
  buy_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** 创建持仓 */
export interface HoldingCreate {
  platform: string
  asset_type: string
  code: string
  name: string
  quantity: number
  cost_price: number
  current_price?: number | null
  take_profit_price?: number | null
  stop_loss_price?: number | null
  industry?: string | null
  buy_date?: string | null
  notes?: string | null
}

/** 更新持仓 */
export interface HoldingUpdate {
  platform?: string
  asset_type?: string
  code?: string
  name?: string
  quantity?: number
  cost_price?: number
  current_price?: number | null
  take_profit_price?: number | null
  stop_loss_price?: number | null
  industry?: string | null
  buy_date?: string | null
  notes?: string | null
}

/** 定期理财状态 */
export type DepositStatus = 'active' | 'matured'

/** 定期理财信息 */
export interface Deposit {
  id: number
  bank: string
  product_name: string
  principal: number
  annual_rate: number
  start_date: string
  maturity_date: string
  expected_return: number
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

/** 创建定期理财 */
export interface DepositCreate {
  bank: string
  product_name: string
  principal: number
  annual_rate: number
  start_date: string
  maturity_date: string
  expected_return: number
  status?: string
  notes?: string | null
}

/** 更新定期理财 */
export interface DepositUpdate {
  bank?: string
  product_name?: string
  principal?: number
  annual_rate?: number
  start_date?: string
  maturity_date?: string
  expected_return?: number
  status?: string
  notes?: string | null
}

/** 平台分布数据 */
export interface PlatformDistribution {
  name: string
  value: number
}

/** 资产类型分布数据 */
export interface AssetTypeDistribution {
  name: string
  value: number
}

/** 平台收益对比数据 */
export interface PlatformComparison {
  platform: string
  total_value: number
  profit: number
  profit_rate: number
  annualized_rate: number
}

/** 仪表盘汇总数据 */
export interface DashboardSummary {
  total_assets: number
  total_profit: number
  total_profit_rate: number
  daily_profit: number
  weekly_profit: number
  monthly_profit: number
  yearly_profit: number
  by_platform: PlatformDistribution[]
  by_asset_type: AssetTypeDistribution[]
  platform_comparison: PlatformComparison[]
  holding_count: number
  deposit_count: number
  /** 各周期收益的快照可用状态 */
  data_status?: Record<
    string,
    { available: boolean; snapshot_date?: string | null; baseline_value?: string; reason?: string }
  >
}

/** 风险等级 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high'

/** 行业集中度单项 */
export interface IndustryConcentrationItem {
  industry: string
  weight: number
  amount: number
}

/** 相关性矩阵 */
export interface CorrelationMatrix {
  codes: string[]
  correlations: number[][]
}

/** VaR 结果 */
export interface VaRResult {
  amount: number
  percentage: number
  confidence: number
}

/** 风险评分因子 */
export interface RiskScoreFactors {
  concentration_score: number
  correlation_score: number
  var_score: number
  total_score: number
  hhi: number
  max_industry_weight: number
}

/** 综合风险评分 */
export interface RiskScore {
  level: RiskLevel
  label: string
  factors: RiskScoreFactors
}

/** 最大单一持仓 */
export interface LargestPosition {
  code: string
  weight: number
}

/** 风险分析汇总 */
export interface RiskSummary {
  total_value: number
  position_count: number
}

/** 单因子暴露 */
export interface FactorExposureItem {
  factor: string
  value: number
}

/** 单因子贡献 */
export interface FactorAttributionItem {
  factor: string
  contribution: number
}

/** 雷达图单项 */
export interface FactorRadarItem {
  indicator: string
  value: number
}

/** 个股 Beta 信息 */
export interface StockBetaItem {
  code: string
  beta: number
  weight: number
  industry?: string | null
}

/** 完整风险分析结果 */
export interface RiskAnalysisResult {
  industry_concentration: IndustryConcentrationItem[]
  correlation_matrix: CorrelationMatrix
  var: VaRResult
  risk_score: RiskScore
  largest_position: LargestPosition
  summary: RiskSummary
  factor_exposures: FactorExposureItem[]
  factor_attribution: FactorAttributionItem[]
  factor_radar: FactorRadarItem[]
  stock_betas: StockBetaItem[]
  warnings: string[]
}

/** 仓位建议单项 */
export interface PositionSuggestion {
  holding_id: number
  code: string
  name: string
  asset_type: string
  rating: SignalRating
  score: number
  current_price: number
  total_assets: number
  current_position_ratio: number
  suggested_ratio: number
  suggested_value: number
  suggested_quantity: number
  risk_amount: number
  reason: string
}

/** 仓位建议响应 */
export interface PositionSuggestionsResponse {
  total_assets: number
  risk_tolerance: number
  suggestions: PositionSuggestion[]
}

/** 止盈止损预警单项 */
export interface PositionAlertItem {
  holding_id: number
  code: string
  name: string
  current_price: number
  take_profit_price: number | null
  stop_loss_price: number | null
  triggered_types: ('take_profit' | 'stop_loss')[]
  trigger_price: number | null
  quantity: number
  cost_price: number
  profit: number
  message: string
}

/** 止盈止损预警响应 */
export interface PositionAlertResponse {
  alerts: PositionAlertItem[]
}

/** 止盈止损计算结果 */
export interface TakeProfitStopLossResult {
  cost_price: number
  current_price: number
  atr: number | null
  multiplier: number
  stop_loss_price: number | null
  take_profit_price: number | null
  reason: string
}

/** 更新止盈止损请求 */
export interface TakeProfitStopLossUpdate {
  take_profit_price: number | null
  stop_loss_price: number | null
}

// ====================================================================
// 市场情绪相关类型
// ====================================================================

/** 趋势数据点 */
export interface SentimentTrendPoint {
  date: string
  value: number
}

/** 北向资金数据 */
export interface NorthFlowData {
  net_flow: number
  trend: SentimentTrendPoint[]
}

/** 市场宽度数据 */
export interface MarketBreadthData {
  up_count: number
  down_count: number
  flat_count: number
  limit_up: number
  limit_down: number
}

/** 成交量趋势数据 */
export interface VolumeTrendData {
  today: number
  avg_5d: number
  trend: SentimentTrendPoint[]
}

/** 涨跌停比数据 */
export interface LimitUpDownRatioData {
  ratio: number
  limit_up: number
  limit_down: number
  score: number
}

/** 恐惧贪婪指数因子得分 */
export interface FearGreedFactors {
  breadth: number
  volatility: number
  volume: number
  north_flow: number
  limit_ratio: number
}

/** 恐惧贪婪指数 */
export interface FearGreedData {
  value: number
  label: string
  percentile: number
  factors: FearGreedFactors
}

/** 复合情绪指数 */
export interface CompositeSentimentData {
  value: number
  label: string
  percentile: number
  history: SentimentTrendPoint[]
  history_method?: string
  history_note?: string
}

/** 市场情绪仪表盘完整数据 */
export interface MarketSentimentOverview {
  north_flow: NorthFlowData
  market_breadth: MarketBreadthData
  volume_trend: VolumeTrendData
  limit_up_down_ratio: LimitUpDownRatioData
  fear_greed: FearGreedData
  composite: CompositeSentimentData
  warnings: string[]
  timestamp: string
}

// ====================================================================
// 板块轮动相关类型
// ====================================================================

/** 板块资金流单项 */
export interface SectorFundFlowItem {
  /** 板块名称 */
  name: string
  /** 板块涨跌幅（%） */
  change_pct: number
  /** 主力净流入额（亿元） */
  net_inflow: number
  /** 排名 */
  rank: number
}

/** 板块资金流响应 */
export interface SectorFundFlowResponse {
  period: 'daily' | 'weekly'
  items: SectorFundFlowItem[]
  warnings: string[]
}

/** 板块热力图单项 */
export interface SectorHeatmapItem {
  /** 板块名称 */
  name: string
  /** 涨跌幅（%） */
  change_percent: number
  /** 成交额（亿元） */
  amount: number
  /** 主力净流入额（亿元） */
  fund_flow: number
}

/** 板块热力图响应 */
export interface SectorHeatmapResponse {
  items: SectorHeatmapItem[]
  warnings: string[]
}

/** 强弱切换板块单项 */
export interface StrengthSwitchItem {
  name: string
  rank_5d: number
  rank_20d: number
  /** 排名变化（正=走强，负=走弱） */
  change: number
  pct_5d: number
  pct_20d: number
}

/** 板块强弱切换响应 */
export interface SectorStrengthSwitchResponse {
  /** 弱势转强板块列表 */
  strengthening: StrengthSwitchItem[]
  /** 强势转弱板块列表 */
  weakening: StrengthSwitchItem[]
  warnings: string[]
}

/** 大盘 vs 小盘 / 成长 vs 价值对比 */
export interface StyleComparison {
  /** 沪深300 / 创业板指 收益 % */
  large_return?: number
  /** 中证500 / 沪深300 收益 % */
  small_return?: number
  growth_return?: number
  value_return?: number
  /** 收益差 */
  ratio: number
  /** 轮动趋势：large_cap/small_cap/balanced 或 growth/value/balanced */
  trend: string
}

/** 风格轮动响应 */
export interface StyleRotationResponse {
  large_vs_small: StyleComparison
  growth_vs_value: StyleComparison
  warnings: string[]
}

/** 债股跷跷板响应 */
export interface BondStockSeesawResponse {
  /** 国债指数近 20 日收益 % */
  bond_return: number
  /** 沪深300 近 20 日收益 % */
  stock_return: number
  /** 简化的反向信号（差异越大越负相关） */
  correlation: number
  /** 信号：stock_strong / bond_strong / balanced */
  signal: string
  warnings: string[]
}

/** 板块轮动汇总数据 */
export interface SectorRotationOverview {
  fund_flow_daily: SectorFundFlowResponse
  fund_flow_weekly: SectorFundFlowResponse
  heatmap: SectorHeatmapResponse
  strength_switch: SectorStrengthSwitchResponse
  style_rotation: StyleRotationResponse
  bond_stock: BondStockSeesawResponse
  warnings: string[]
}

// ===== News 快讯相关 =====
export interface NewsItem {
  id: number
  source: string
  title: string
  content: string
  url: string | null
  publish_time: string
  is_important: boolean
  keywords: string[] | null
  content_hash: string | null
  created_at: string
}
export interface NewsListResponse {
  items: NewsItem[]
  total: number
}
export interface NewsSource {
  id: string
  name: string
}
export interface NewsKeywordsResponse {
  keywords: string[]
}

// ===== Opportunities 投资机会相关 =====
export interface Opportunity {
  id: number
  code: string
  name: string
  opportunity_type: string
  score: number
  price: number
  reason: OpportunityReason
  discovered_date: string
  status: string
  created_at: string
}
export interface OpportunityReason {
  tech_score?: number
  sector_score?: number
  fund_score?: number
  rating?: string
  sector?: string
  fund_flow?: number
  details?: string[]
}
export interface OpportunityListResponse {
  items: Opportunity[]
  total: number
  scanned_at: string | null
}
export interface OpportunityHistoryResponse {
  items: Opportunity[]
  total: number
}
