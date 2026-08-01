import api from './request'

export interface DailyReport {
  report_date: string
  title: string
  transaction_count: number
  positions: Array<{ name: string; code: string; currency: string; market_value: number; total_profit: number }>
  risk_by_currency: Record<string, { largest_position_weight: number; position_count: number; market_value: number }>
  attention: string[]
  disclaimer: string
}

export const getDailyReport = () => api.get<DailyReport>('/portfolio/daily-report')
