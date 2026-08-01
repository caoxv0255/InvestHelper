import api from './request'
import type {
  PositionSuggestionsResponse,
  PositionAlertResponse,
  TakeProfitStopLossResult,
  TakeProfitStopLossUpdate,
} from '../types'

/**
 * 获取所有持仓的仓位建议
 * @param riskTolerance 单笔风险承受比例，默认 0.02
 */
export const getPositionSuggestions = async (riskTolerance: number = 0.02) => {
  return api.get<PositionSuggestionsResponse>('/position/suggestions', {
    params: { risk_tolerance: riskTolerance },
  })
}

/**
 * 获取止盈止损预警
 */
export const getPositionAlerts = async () => {
  return api.get<PositionAlertResponse>('/position/alerts')
}

/**
 * 根据 ATR 自动计算某持仓的止盈止损价（不保存）
 * @param holdingId 持仓ID
 * @param multiplier ATR 倍数，默认 2.0
 */
export const calculateTakeProfitStopLoss = async (
  holdingId: number,
  multiplier: number = 2.0,
) => {
  return api.post<TakeProfitStopLossResult>(
    `/position/${holdingId}/calculate-take-profit-stop-loss`,
    null,
    { params: { multiplier } },
  )
}

/**
 * 更新持仓的止盈止损价格
 * @param holdingId 持仓ID
 * @param data 止盈止损数据
 */
export const updateTakeProfitStopLoss = async (
  holdingId: number,
  data: TakeProfitStopLossUpdate,
) => {
  return api.put<{ message: string; holding_id: number }>(
    `/position/${holdingId}/take-profit-stop-loss`,
    data,
  )
}
