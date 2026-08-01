import api from './request'
import type {
  SectorFundFlowResponse,
  SectorHeatmapResponse,
  SectorStrengthSwitchResponse,
  StyleRotationResponse,
  BondStockSeesawResponse,
  SectorRotationOverview,
} from '../types'

/**
 * 获取行业板块资金流入流出排名
 * @param period daily / weekly
 */
export const getSectorFundFlow = (period: 'daily' | 'weekly' = 'daily') =>
  api.get<SectorFundFlowResponse>('/sector/fund-flow', { params: { period } })

/**
 * 获取板块热力图数据（涨跌幅 + 成交额 + 资金流）
 */
export const getSectorHeatmap = () =>
  api.get<SectorHeatmapResponse>('/sector/heatmap')

/**
 * 获取板块强弱切换信号（弱势转强 / 强势转弱）
 */
export const getSectorStrengthSwitch = () =>
  api.get<SectorStrengthSwitchResponse>('/sector/strength-switch')

/**
 * 获取风格轮动指标（大盘vs小盘、成长vs价值）
 */
export const getStyleRotation = () =>
  api.get<StyleRotationResponse>('/sector/style-rotation')

/**
 * 获取债股跷跷板效应数据
 */
export const getBondStockSeesaw = () =>
  api.get<BondStockSeesawResponse>('/sector/bond-stock')

/**
 * 获取板块轮动汇总数据
 */
export const getSectorRotationOverview = () =>
  api.get<SectorRotationOverview>('/sector/overview')
