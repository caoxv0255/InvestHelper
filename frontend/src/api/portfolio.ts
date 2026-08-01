import api from './request'

export interface PortfolioPosition {
  account: string
  asset_type: string
  code: string
  name: string
  currency: string
  quantity: number
  cost_basis: number
  average_cost: number
  current_price: number
  market_value: number
  realized_profit: number
  unrealized_profit: number
  dividends: number
  total_profit: number
}

export interface PortfolioSnapshot {
  as_of: string
  method: string
  positions: PortfolioPosition[]
  summary_by_currency: Record<string, Record<string, number>>
  risk_by_currency: Record<string, { largest_position_weight: number; position_count: number; market_value: number }>
  transaction_count: number
  warnings: string[]
}

export const getPortfolioSnapshot = (asOf?: string) =>
  api.get<PortfolioSnapshot>('/portfolio/snapshot', { params: asOf ? { as_of: asOf } : undefined })

export interface PortfolioHistoryPoint { date: string; market_value: number; total_profit: number; drawdown: number }
export interface PortfolioHistory { currencies: Record<string, { points: PortfolioHistoryPoint[]; max_drawdown: number; return: number }>; snapshot_count: number }
export const capturePortfolioSnapshot = (asOf?: string) => api.post<{ snapshot_date: string; currency_count: number; transaction_count: number }>('/portfolio/snapshot/capture', undefined, { params: asOf ? { as_of: asOf } : undefined })
export const getPortfolioHistory = () => api.get<PortfolioHistory>('/portfolio/history')
