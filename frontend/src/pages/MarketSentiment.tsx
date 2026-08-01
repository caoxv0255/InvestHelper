import { useState, useEffect, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { getMarketSentiment } from '../api/sentiment'
import type { MarketSentimentOverview } from '../types'
import { getProfitColor, formatLargeNumber } from '../utils/format'
import '../styles/MarketSentiment.css'

// ECharts 统一配色
const CHART_COLORS = {
  primary: '#667eea',
  red: '#ef4444',
  green: '#22c55e',
  orange: '#f59e0b',
  purple: '#8b5cf6',
  blue: '#3b82f6',
  gray: '#9ca3af',
}

// 根据情绪分值返回颜色（0=极度恐惧-绿，100=极度贪婪-红）
const getSentimentColor = (value: number): string => {
  if (value >= 80) return '#ef4444' // 极度贪婪-红
  if (value >= 60) return '#f59e0b' // 贪婪-橙
  if (value >= 40) return '#3b82f6' // 中性-蓝
  if (value >= 20) return '#10b981' // 恐惧-绿
  return '#22c55e' // 极度恐惧-深绿
}

const MarketSentiment = () => {
  const [data, setData] = useState<MarketSentimentOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getMarketSentiment()
      setData(result)
    } catch (err: any) {
      setError(err.message || '加载市场情绪数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // 恐惧贪婪指数仪表盘
  const fearGreedGaugeOption = useMemo(() => {
    if (!data) return null
    const value = data.fear_greed.value
    const color = getSentimentColor(value)
    return {
      series: [
        {
          type: 'gauge',
          min: 0,
          max: 100,
          splitNumber: 5,
          axisLine: {
            lineStyle: {
              width: 20,
              color: [
                [0.2, '#22c55e'],
                [0.4, '#10b981'],
                [0.6, '#3b82f6'],
                [0.8, '#f59e0b'],
                [1, '#ef4444'],
              ],
            },
          },
          pointer: {
            itemStyle: {
              color: color,
            },
          },
          axisTick: {
            distance: -20,
            length: 6,
            lineStyle: {
              color: '#fff',
              width: 1,
            },
          },
          splitLine: {
            distance: -20,
            length: 20,
            lineStyle: {
              color: '#fff',
              width: 2,
            },
          },
          axisLabel: {
            distance: -10,
            color: '#999',
            fontSize: 11,
          },
          detail: {
            valueAnimation: true,
            formatter: '{value}',
            color: color,
            fontSize: 36,
            fontWeight: 'bold',
            offsetCenter: [0, '70%'],
          },
          title: {
            offsetCenter: [0, '95%'],
            fontSize: 14,
            color: '#666',
          },
          data: [
            {
              value: value,
              name: data.fear_greed.label,
            },
          ],
        },
      ],
    }
  }, [data])

  // 北向资金近5日趋势条形图
  const northFlowOption = useMemo(() => {
    if (!data || data.north_flow.trend.length === 0) return null
    const trend = data.north_flow.trend
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = params[0]
          return `${item.name}<br/>净流入: ${item.value.toFixed(2)} 亿元`
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
        type: 'category',
        data: trend.map((t) => t.date.slice(5)), // MM-DD
        axisLabel: {
          color: '#999',
          fontSize: 11,
        },
        axisLine: { lineStyle: { color: '#eee' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#999',
          fontSize: 11,
          formatter: '{value}',
        },
        splitLine: { lineStyle: { color: '#f5f5f5' } },
      },
      series: [
        {
          name: '北向资金净流入',
          type: 'bar',
          data: trend.map((t) => ({
            value: t.value,
            itemStyle: {
              color: t.value >= 0 ? CHART_COLORS.red : CHART_COLORS.green,
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barWidth: '50%',
          label: {
            show: true,
            position: 'top',
            formatter: (p: any) => p.value.toFixed(2),
            color: '#666',
            fontSize: 10,
          },
        },
      ],
    }
  }, [data])

  // 市场宽度对比条形图
  const breadthOption = useMemo(() => {
    if (!data) return null
    const { up_count, down_count, flat_count } = data.market_breadth
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const total = up_count + down_count + flat_count
          let html = ''
          params.forEach((p: any) => {
            const pct = total > 0 ? (p.value / total * 100).toFixed(1) : '0'
            html += `${p.marker}${p.name}: ${p.value} 家 (${pct}%)<br/>`
          })
          return html
        },
      },
      grid: {
        left: '3%',
        right: '8%',
        bottom: '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#999', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f5f5f5' } },
      },
      yAxis: {
        type: 'category',
        data: ['平盘', '下跌', '上涨'],
        axisLabel: { color: '#666', fontSize: 12 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: '家数',
          type: 'bar',
          data: [
            { value: flat_count, itemStyle: { color: CHART_COLORS.gray, borderRadius: [0, 4, 4, 0] } },
            { value: down_count, itemStyle: { color: CHART_COLORS.green, borderRadius: [0, 4, 4, 0] } },
            { value: up_count, itemStyle: { color: CHART_COLORS.red, borderRadius: [0, 4, 4, 0] } },
          ],
          barWidth: 20,
          label: {
            show: true,
            position: 'right',
            formatter: '{c}',
            color: '#666',
            fontSize: 11,
          },
        },
      ],
    }
  }, [data])

  // 成交量趋势折线图
  const volumeTrendOption = useMemo(() => {
    if (!data || data.volume_trend.trend.length === 0) return null
    const trend = data.volume_trend.trend
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const item = params[0]
          return `${item.name}<br/>成交额: ${item.value.toFixed(2)} 亿元`
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
        type: 'category',
        data: trend.map((t) => t.date.slice(5)),
        boundaryGap: false,
        axisLabel: { color: '#999', fontSize: 11 },
        axisLine: { lineStyle: { color: '#eee' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#999', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f5f5f5' } },
      },
      series: [
        {
          name: '成交额',
          type: 'line',
          data: trend.map((t) => t.value),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: CHART_COLORS.primary, width: 2 },
          itemStyle: { color: CHART_COLORS.primary },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(102, 126, 234, 0.3)' },
                { offset: 1, color: 'rgba(102, 126, 234, 0)' },
              ],
            },
          },
          markLine: {
            silent: true,
            data: [
              {
                type: 'line',
                yAxis: data.volume_trend.avg_5d,
                lineStyle: { color: CHART_COLORS.orange, type: 'dashed' },
                label: {
                  formatter: '5日均值',
                  color: CHART_COLORS.orange,
                  fontSize: 10,
                },
              },
            ],
          },
        },
      ],
    }
  }, [data])

  // 复合情绪历史趋势
  const compositeHistoryOption = useMemo(() => {
    if (!data || data.composite.history.length === 0) return null
    const history = data.composite.history
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const item = params[0]
          return `${item.name}<br/>情绪指数: ${item.value.toFixed(2)}`
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
        type: 'category',
        data: history.map((h) => h.date.slice(5)),
        boundaryGap: false,
        axisLabel: { color: '#999', fontSize: 10 },
        axisLine: { lineStyle: { color: '#eee' } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: { color: '#999', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f5f5f5' } },
      },
      series: [
        {
          name: '复合情绪',
          type: 'line',
          data: history.map((h) => h.value),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: CHART_COLORS.purple, width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(139, 92, 246, 0.3)' },
                { offset: 1, color: 'rgba(139, 92, 246, 0)' },
              ],
            },
          },
          markLine: {
            silent: true,
            data: [
              {
                yAxis: data.composite.value,
                lineStyle: { color: getSentimentColor(data.composite.value), type: 'solid', width: 2 },
                label: {
                  formatter: '当前',
                  color: getSentimentColor(data.composite.value),
                  fontSize: 10,
                },
              },
            ],
          },
        },
      ],
    }
  }, [data])

  return (
    <div className="market-sentiment-page">
      <div className="page-header">
        <h1 className="page-title">市场情绪仪表盘</h1>
        {data && (
          <div className="header-meta">
            <span className="text-muted">数据时间: {data.timestamp}</span>
            <button className="btn-refresh" onClick={fetchData} disabled={loading}>
              刷新
            </button>
          </div>
        )}
      </div>

      {loading && !data && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>加载中...</span>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
          <button className="btn-link" onClick={fetchData}>
            重试
          </button>
        </div>
      )}

      {/* 数据缺失警告 */}
      {data && data.warnings.length > 0 && (
        <div className="warnings-banner">
          <div className="warnings-title">⚠️ 数据警告</div>
          <ul className="warnings-list">
            {data.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* 顶部 - 恐惧贪婪指数 + 复合情绪指数 */}
          <div className="sentiment-top-row">
            <div className="chart-card fear-greed-card">
              <div className="chart-title">恐惧贪婪指数</div>
              <div className="chart-container">
                {fearGreedGaugeOption ? (
                  <ReactECharts option={fearGreedGaugeOption} style={{ height: '300px' }} />
                ) : (
                  <div className="empty-chart">暂无数据</div>
                )}
              </div>
              <div className="fear-greed-meta">
                <span className="meta-item">
                  历史分位: <strong>{data.fear_greed.percentile.toFixed(1)}%</strong>
                </span>
                <span className="meta-item">
                  标签: <strong style={{ color: getSentimentColor(data.fear_greed.value) }}>{data.fear_greed.label}</strong>
                </span>
              </div>
            </div>

            <div className="chart-card composite-card">
              <div className="chart-title">复合情绪指数</div>
              <div className="composite-main">
                <div className="composite-value" style={{ color: getSentimentColor(data.composite.value) }}>
                  {data.composite.value.toFixed(2)}
                </div>
                <div className="composite-label" style={{ color: getSentimentColor(data.composite.value) }}>
                  {data.composite.label}
                </div>
                <div className="composite-percentile">
                  历史分位数: <strong>{data.composite.percentile.toFixed(1)}%</strong>
                </div>
              </div>
              <div className="chart-container composite-history">
                {compositeHistoryOption ? (
                  <ReactECharts option={compositeHistoryOption} style={{ height: '160px' }} />
                ) : (
                  <div className="empty-chart small">暂无历史数据</div>
                )}
              </div>
              {data.composite.history_note && (
                <div className="history-note">ℹ️ {data.composite.history_note}</div>
              )}
            </div>
          </div>

          {/* 北向资金 + 涨跌停比 */}
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">北向资金净流入（近5日）</div>
              <div className="north-flow-summary">
                <div className="summary-item">
                  <span className="summary-label">今日净流入</span>
                  <span
                    className="summary-value"
                    style={{ color: getProfitColor(data.north_flow.net_flow) }}
                  >
                    {data.north_flow.net_flow >= 0 ? '+' : ''}
                    {data.north_flow.net_flow.toFixed(2)} 亿
                  </span>
                </div>
              </div>
              <div className="chart-container">
                {northFlowOption ? (
                  <ReactECharts option={northFlowOption} style={{ height: '240px' }} />
                ) : (
                  <div className="empty-chart">暂无数据</div>
                )}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-title">涨跌停比</div>
              <div className="limit-ratio-content">
                <div className="limit-ratio-value">
                  <span
                    className="ratio-num"
                    style={{ color: getSentimentColor(data.limit_up_down_ratio.score) }}
                  >
                    {data.limit_up_down_ratio.ratio.toFixed(2)}
                  </span>
                  <span className="ratio-unit">: 1</span>
                </div>
                <div className="limit-stats">
                  <div className="limit-stat-item limit-up">
                    <div className="limit-stat-label">涨停</div>
                    <div className="limit-stat-value">{data.limit_up_down_ratio.limit_up}</div>
                  </div>
                  <div className="limit-stat-item limit-down">
                    <div className="limit-stat-label">跌停</div>
                    <div className="limit-stat-value">{data.limit_up_down_ratio.limit_down}</div>
                  </div>
                </div>
                <div className="limit-score-bar">
                  <div className="score-track">
                    <div
                      className="score-fill"
                      style={{
                        width: `${data.limit_up_down_ratio.score}%`,
                        backgroundColor: getSentimentColor(data.limit_up_down_ratio.score),
                      }}
                    />
                  </div>
                  <span className="score-label">
                    情绪分: {data.limit_up_down_ratio.score.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 市场宽度 */}
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">市场宽度（涨跌家数对比）</div>
              <div className="breadth-summary">
                <div className="breadth-stat">
                  <span className="breadth-stat-label" style={{ color: CHART_COLORS.red }}>上涨</span>
                  <span className="breadth-stat-value" style={{ color: CHART_COLORS.red }}>
                    {data.market_breadth.up_count}
                  </span>
                </div>
                <div className="breadth-stat">
                  <span className="breadth-stat-label" style={{ color: CHART_COLORS.green }}>下跌</span>
                  <span className="breadth-stat-value" style={{ color: CHART_COLORS.green }}>
                    {data.market_breadth.down_count}
                  </span>
                </div>
                <div className="breadth-stat">
                  <span className="breadth-stat-label" style={{ color: CHART_COLORS.gray }}>平盘</span>
                  <span className="breadth-stat-value" style={{ color: CHART_COLORS.gray }}>
                    {data.market_breadth.flat_count}
                  </span>
                </div>
                <div className="breadth-stat">
                  <span className="breadth-stat-label" style={{ color: CHART_COLORS.red }}>涨停</span>
                  <span className="breadth-stat-value" style={{ color: CHART_COLORS.red }}>
                    {data.market_breadth.limit_up}
                  </span>
                </div>
                <div className="breadth-stat">
                  <span className="breadth-stat-label" style={{ color: CHART_COLORS.green }}>跌停</span>
                  <span className="breadth-stat-value" style={{ color: CHART_COLORS.green }}>
                    {data.market_breadth.limit_down}
                  </span>
                </div>
              </div>
              <div className="chart-container">
                {breadthOption ? (
                  <ReactECharts option={breadthOption} style={{ height: '240px' }} />
                ) : (
                  <div className="empty-chart">暂无数据</div>
                )}
              </div>
            </div>

            {/* 成交量趋势 */}
            <div className="chart-card">
              <div className="chart-title">成交量趋势（近5日，亿元）</div>
              <div className="volume-summary">
                <div className="volume-stat">
                  <span className="volume-label">今日成交额</span>
                  <span className="volume-value">
                    {formatLargeNumber(data.volume_trend.today)} 亿
                  </span>
                </div>
                <div className="volume-stat">
                  <span className="volume-label">5日均值</span>
                  <span className="volume-value" style={{ color: CHART_COLORS.orange }}>
                    {formatLargeNumber(data.volume_trend.avg_5d)} 亿
                  </span>
                </div>
                <div className="volume-stat">
                  <span className="volume-label">相对均量</span>
                  <span
                    className="volume-value"
                    style={{
                      color:
                        data.volume_trend.avg_5d > 0
                          ? getProfitColor(data.volume_trend.today - data.volume_trend.avg_5d)
                          : '#666',
                    }}
                  >
                    {data.volume_trend.avg_5d > 0
                      ? `${(
                          ((data.volume_trend.today - data.volume_trend.avg_5d) /
                            data.volume_trend.avg_5d) *
                          100
                        ).toFixed(2)}%`
                      : '--'}
                  </span>
                </div>
              </div>
              <div className="chart-container">
                {volumeTrendOption ? (
                  <ReactECharts option={volumeTrendOption} style={{ height: '240px' }} />
                ) : (
                  <div className="empty-chart">暂无数据</div>
                )}
              </div>
            </div>
          </div>

          {/* 恐惧贪婪因子分解 */}
          <div className="chart-card factors-card">
            <div className="chart-title">恐惧贪婪指数因子分解</div>
            <div className="factors-grid">
              {(
                [
                  { key: 'breadth', name: '市场宽度', weight: '25%' },
                  { key: 'volatility', name: '波动率', weight: '20%' },
                  { key: 'volume', name: '成交量', weight: '15%' },
                  { key: 'north_flow', name: '北向资金', weight: '25%' },
                  { key: 'limit_ratio', name: '涨跌停比', weight: '15%' },
                ] as const
              ).map((f) => {
                const v = data.fear_greed.factors[f.key as keyof typeof data.fear_greed.factors]
                return (
                  <div className="factor-item" key={f.key}>
                    <div className="factor-header">
                      <span className="factor-name">{f.name}</span>
                      <span className="factor-weight">权重 {f.weight}</span>
                    </div>
                    <div className="factor-bar-track">
                      <div
                        className="factor-bar-fill"
                        style={{
                          width: `${v}%`,
                          backgroundColor: getSentimentColor(v),
                        }}
                      />
                    </div>
                    <div className="factor-value" style={{ color: getSentimentColor(v) }}>
                      {v.toFixed(2)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default MarketSentiment
