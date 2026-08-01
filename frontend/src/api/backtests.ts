import api from './request'

export interface BacktestBar {
  date: string
  close: number
}

export interface BacktestAsset {
  code: string
  name: string
  target_weight: number
  bars: BacktestBar[]
}

export interface BacktestRequest {
  strategy: 'buy_hold' | 'sma_trend' | 'momentum' | 'rebalance'
  initial_capital: number
  fee_rate: number
  slippage_rate: number
  lookback: number
  short_window: number
  long_window: number
  assets: BacktestAsset[]
  constraints: {
    max_drawdown: number
    max_single_weight: number
    max_monthly_trades: number
    min_trade_amount: number
    min_cash_weight: number
  }
}

export interface BacktestResult {
  strategy: string
  metrics: Record<string, number | boolean>
  equity_curve: Array<{ date: string; equity: number; drawdown: number }>
  trades: Array<{ date: string; amount: number; weights: Record<string, number> }>
  warnings: string[]
}

export const runBacktest = (data: BacktestRequest) =>
  api.post<BacktestResult>('/strategy/backtests', data)
