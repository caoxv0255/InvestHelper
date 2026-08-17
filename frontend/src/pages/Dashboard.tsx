import { useState, useEffect, useRef, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import { TableSkeleton } from '../components/TableSkeleton'
import { getDashboardSummary } from '../api/dashboard'
import { refreshHoldingPrices, getRefreshPricesStatus } from '../api/holdings'
import type { DashboardSummary } from '../types'
import { getPortfolioSnapshot, type PortfolioSnapshot } from '../api/portfolio'
import {
  formatCurrency,
  formatPercent,
  formatLargeCurrency,
  getProfitColor,
} from '../utils/format'
import '../styles/Dashboard.css'

const Dashboard = () => {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null)
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')
  const [refreshMsg, setRefreshMsg] = useState('')
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  /** 加载 Dashboard 数据（不等待行情刷新） */
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getDashboardSummary()
      setData(result)
      try {
        setSnapshot(await getPortfolioSnapshot())
      } catch {
        setSnapshot(null)
      }
    } catch (err: any) {
      setError(err.message || '加载仪表盘数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  /** 触发异步刷新 + 轮询结果 */
  const triggerRefresh = useCallback(async () => {
    if (refreshStatus === 'running') return
    setRefreshStatus('running')
    setRefreshMsg('正在后台刷新实时行情...')
    try {
      await refreshHoldingPrices() // 立即返回
      // 开始轮询
      startPolling()
    } catch {
      setRefreshStatus('failed')
      setRefreshMsg('行情刷新触发失败')
    }
  }, [refreshStatus])

  const startPolling = useCallback(() => {
    // 清理已有轮询
    if (pollTimer.current) clearInterval(pollTimer.current)
    let attempts = 0
    pollTimer.current = setInterval(async () => {
      attempts++
      try {
        const res = await getRefreshPricesStatus()
        if (res.status === 'done' || res.status === 'failed') {
          if (pollTimer.current) clearInterval(pollTimer.current)
          pollTimer.current = null
          setRefreshStatus(res.status)
          if (res.status === 'done' && res.result) {
            const r = res.result
            setRefreshMsg(`行情刷新完成：${r.updated ?? 0} 条更新，${r.failed ?? 0} 条失败`)
            // 刷新完成后重新拉取 Dashboard 数据
            await fetchData()
          } else {
            setRefreshMsg(`行情刷新失败：${res.result?.error || '未知错误'}`)
          }
        } else if (attempts > 60) {
          // 60 次（30秒）超时
          if (pollTimer.current) clearInterval(pollTimer.current)
          pollTimer.current = null
          setRefreshStatus('failed')
          setRefreshMsg('行情刷新超时')
        }
      } catch {
        // 单次轮询失败，继续
      }
    }, 500) // 每 0.5 秒轮询一次
  }, [fetchData])

  /** 页面加载：先显示数据，后台触发刷新 */
  useEffect(() => {
    fetchData()
    triggerRefresh()
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const platformPieOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ¥{c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: {
        fontSize: 12,
        color: '#666',
      },
    },
    series: [
      {
        name: '平台分布',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        data: data?.by_platform.map((item) => ({
          name: item.name,
          value: item.value,
        })),
        color: ['#667eea', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'],
      },
    ],
  }

  const assetTypePieOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ¥{c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: {
        fontSize: 12,
        color: '#666',
      },
    },
    series: [
      {
        name: '资产类型分布',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        data: data?.by_asset_type.map((item) => ({
          name: item.name,
          value: item.value,
        })),
        color: ['#667eea', '#10b981', '#f59e0b', '#8b5cf6'],
      },
    ],
  }

  const platformBarOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params: any) => {
        const item = params[0]
        return `${item.name}<br/>年化收益率: ${item.value.toFixed(2)}%`
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value}%',
        color: '#999',
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0',
        },
      },
    },
    yAxis: {
      type: 'category',
      data: data?.platform_comparison.map((item) => item.platform).reverse(),
      axisLabel: {
        color: '#666',
        fontSize: 12,
      },
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
    },
    series: [
      {
        name: '年化收益率',
        type: 'bar',
        data: data?.platform_comparison
          .map((item) => ({
            value: item.annualized_rate,
            itemStyle: {
              color: item.annualized_rate >= 0 ? '#ef4444' : '#22c55e',
              borderRadius: [0, 4, 4, 0],
            },
          }))
          .reverse(),
        barWidth: 24,
        label: {
          show: true,
          position: 'right',
          formatter: '{c}%',
          color: '#666',
          fontSize: 12,
        },
      },
    ],
  }

  return (
    <div className="dashboard-page">
      <div className="page-title-row">
        <h1 className="page-title">资产概览</h1>
        {data && (
          <button
            className="btn-refresh-prices"
            onClick={triggerRefresh}
            disabled={refreshStatus === 'running'}
          >
            {refreshStatus === 'running' ? '刷新中...' : '刷新行情'}
          </button>
        )}
      </div>
      {refreshMsg && (
        <div className={`refresh-msg ${refreshStatus === 'running' ? 'refreshing' : ''}`}>
          {refreshMsg}
        </div>
      )}

      {loading && !data ? (
        <div className="dashboard-skeleton">
          <TableSkeleton rows={4} columns={3} />
        </div>
      ) : loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>加载中...</span>
        </div>
      ) : null}

      {error && (
        <div className="error-message">
          {error}
          <button className="btn-link" onClick={() => fetchData()}>
            重试
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* 顶部概览卡片 */}
          <div className="overview-cards">
            <div className="overview-card card-primary">
              <div className="card-label">总资产</div>
              <div className="card-value large">{formatLargeCurrency(data.total_assets)}</div>
              <div className="card-sub">总市值</div>
            </div>

            <div className="overview-card">
              <div className="card-label">总收益</div>
              <div
                className="card-value"
                style={{ color: getProfitColor(data.total_profit) }}
              >
                {data.total_profit >= 0 ? '+' : ''}
                {formatLargeCurrency(data.total_profit)}
              </div>
              <div className="card-sub">
                <span style={{ color: getProfitColor(data.total_profit) }}>
                  {formatPercent(data.total_profit_rate)}
                </span>
                <span className="text-muted"> 收益率</span>
              </div>
            </div>

            <div className="overview-card">
              <div className="card-label">今日收益</div>
              <div
                className="card-value"
                style={{ color: getProfitColor(data.daily_profit) }}
              >
                {data.data_status?.daily?.available
                  ? `${data.daily_profit >= 0 ? '+' : ''}${formatCurrency(data.daily_profit)}`
                  : '暂无历史'}
              </div>
              <div className="card-sub">
                <span className="text-muted">
                  {data.data_status?.daily?.available
                    ? `对比 ${data.data_status.daily.snapshot_date}`
                    : '需有昨日组合快照'}
                </span>
              </div>
            </div>

            <div className="overview-card">
              <div className="card-label">持仓统计</div>
              <div className="card-stats">
                <div className="stat-item">
                  <span className="stat-value">{data.holding_count}</span>
                  <span className="stat-label">持仓只数</span>
                </div>
                <div className="stat-divider"></div>
                <div className="stat-item">
                  <span className="stat-value">{data.deposit_count}</span>
                  <span className="stat-label">定期数</span>
                </div>
              </div>
            </div>
          </div>

          {/* 收益周期卡片 */}
          <div className="profit-period-cards">
            <div className="period-card">
              <div className="period-label">本周收益</div>
              <div
                className="period-value"
                style={{ color: getProfitColor(data.weekly_profit) }}
              >
                {data.data_status?.weekly?.available
                  ? `${data.weekly_profit >= 0 ? '+' : ''}${formatCurrency(data.weekly_profit)}`
                  : '暂无历史'}
              </div>
            </div>
            <div className="period-card">
              <div className="period-label">本月收益</div>
              <div
                className="period-value"
                style={{ color: getProfitColor(data.monthly_profit) }}
              >
                {data.data_status?.monthly?.available
                  ? `${data.monthly_profit >= 0 ? '+' : ''}${formatCurrency(data.monthly_profit)}`
                  : '暂无历史'}
              </div>
            </div>
            <div className="period-card">
              <div className="period-label">本年收益</div>
              <div
                className="period-value"
                style={{ color: getProfitColor(data.yearly_profit) }}
              >
                {data.data_status?.yearly?.available
                  ? `${data.yearly_profit >= 0 ? '+' : ''}${formatCurrency(data.yearly_profit)}`
                  : '暂无历史'}
              </div>
            </div>
          </div>

          {/* 资金流向 & 真实收益率 */}
          {data.cash_flow_summary && data.cash_flow_summary.length > 0 && (
            <div className="dashboard-section cash-flow-section">
              <div className="section-header"><h2>资金流向</h2><span className="text-muted">基于资金流水计算真实收益率</span></div>
              <div className="cash-flow-grid">
                {data.cash_flow_summary.map((cf) => {
                  const symbol = cf.currency === 'HKD' ? 'HK$' : cf.currency === 'USD' ? '$' : '¥'
                  const hasData = cf.net_deposit > 0
                  return <div key={cf.currency} className="cash-flow-card">
                    <div className="cf-header"><span className="cf-currency">{symbol} {cf.currency}</span></div>
                    <div className="cf-row"><span className="cf-label">累计入金</span><span className="cf-value positive">+{formatCurrency(cf.total_deposit)}</span></div>
                    <div className="cf-row"><span className="cf-label">累计出金</span><span className="cf-value negative">-{formatCurrency(cf.total_withdraw)}</span></div>
                    <div className="cf-row"><span className="cf-label">净入金</span><span className="cf-value" style={{ color: getProfitColor(cf.net_deposit) }}>{formatCurrency(cf.net_deposit)}</span></div>
                    <div className="cf-divider"></div>
                    <div className="cf-row"><span className="cf-label">真实收益</span><span className="cf-value" style={{ color: getProfitColor(cf.real_return) }}>{hasData ? `${cf.real_return >= 0 ? '+' : ''}${formatCurrency(cf.real_return)}` : 'N/A'}</span></div>
                    <div className="cf-row"><span className="cf-label">真实收益率</span><span className="cf-value" style={{ color: getProfitColor(cf.real_return_rate) }}>{hasData ? formatPercent(cf.real_return_rate) : 'N/A'}</span></div>
                  </div>
                })}
              </div>
            </div>
          )}

          {snapshot && snapshot.positions.length > 0 && (
            <div className="dashboard-section portfolio-risk-strip">
              <div className="section-header"><h2>流水重建组合风险</h2><span className="text-muted">按币种计算，未做汇率换算</span></div>
              <div className="risk-strip-grid">
                {Object.entries(snapshot.risk_by_currency).map(([currency, risk]) => (
                  <div className="risk-strip-card" key={currency}>
                    <span>{currency} 最大单标的仓位</span>
                    <strong>{(risk.largest_position_weight * 100).toFixed(1)}%</strong>
                    <small>{risk.position_count} 个持仓 · 市值 {risk.market_value.toFixed(2)}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 图表区域 - 饼图 */}
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">按平台分布</div>
              <div className="chart-container">
                {data.by_platform.length > 0 ? (
                  <ReactECharts option={platformPieOption} style={{ height: '280px' }} />
                ) : (
                  <div className="empty-chart">暂无数据</div>
                )}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-title">按资产类型分布</div>
              <div className="chart-container">
                {data.by_asset_type.length > 0 ? (
                  <ReactECharts option={assetTypePieOption} style={{ height: '280px' }} />
                ) : (
                  <div className="empty-chart">暂无数据</div>
                )}
              </div>
            </div>
          </div>

          {/* 下方区域 - 柱状图 + 快捷操作 */}
          <div className="chart-row">
            <div className="chart-card chart-large">
              <div className="chart-title">各平台年化收益率对比</div>
              <div className="chart-container">
                {data.platform_comparison.length > 0 ? (
                  <ReactECharts option={platformBarOption} style={{ height: '300px' }} />
                ) : (
                  <div className="empty-chart">暂无数据</div>
                )}
              </div>
            </div>

            <div className="quick-actions-card">
              <div className="chart-title">快捷操作</div>
              <div className="action-buttons">
                <button className="action-btn" onClick={() => window.location.href = '/portfolio'}>
                  <span className="action-icon">📈</span>
                  <span>添加持仓</span>
                </button>
                <button className="action-btn" onClick={() => window.location.href = '/portfolio'}>
                  <span className="action-icon">💰</span>
                  <span>添加定期</span>
                </button>
                <button className="action-btn" onClick={() => { fetchData(); triggerRefresh(); }}>
                  <span className="action-icon">🔄</span>
                  <span>刷新数据</span>
                </button>
                <button className="action-btn" onClick={() => window.location.href = '/portfolio'}>
                  <span className="action-icon">📊</span>
                  <span>查看详情</span>
                </button>
              </div>

              <div className="platform-list">
                <div className="platform-list-title">平台明细</div>
                {data.platform_comparison.map((item) => (
                  <div key={item.platform} className="platform-row">
                    <div className="platform-name">{item.platform}</div>
                    <div className="platform-info">
                      <span className="platform-value">{formatLargeCurrency(item.total_value)}</span>
                      <span
                        className="platform-profit"
                        style={{ color: getProfitColor(item.profit) }}
                      >
                        {item.profit >= 0 ? '+' : ''}
                        {formatPercent(item.annualized_rate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
