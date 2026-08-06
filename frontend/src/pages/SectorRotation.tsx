import { useEffect, useMemo, useState } from 'react'
import { TableSkeleton } from '../components/TableSkeleton'
import ReactECharts from 'echarts-for-react'
import { getSectorRotationOverview } from '../api/sector'
import type { SectorRotationOverview } from '../types'
import { formatPercent, formatLargeNumber } from '../utils/format'
import '../styles/SectorRotation.css'

// A 股配色：红涨绿跌
const COLOR_UP = '#ef4444'
const COLOR_DOWN = '#22c55e'

// 趋势中文标签映射
const TREND_LABEL: Record<string, string> = {
  large_cap: '大盘占优',
  small_cap: '小盘占优',
  balanced: '大小盘均衡',
  growth: '成长占优',
  value: '价值占优',
}

// 债股信号中文映射
const SIGNAL_LABEL: Record<string, string> = {
  stock_strong: '股市走强',
  bond_strong: '债市走强',
  balanced: '债股均衡',
}

const SectorRotation = () => {
  const [data, setData] = useState<SectorRotationOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getSectorRotationOverview()
      setData(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载板块轮动数据失败'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // ============= 板块资金流横向条形图 =============
  const fundFlowOption = useMemo(() => {
    if (!data) return null
    const items = data.fund_flow_daily?.items || []
    if (items.length === 0) return null

    // 取净流入前 10 和后 10 合并展示
    const top = items.slice(0, 10)
    const bottom = items.slice(-10).reverse()
    const display = [...top, ...bottom].filter(
      (item, idx, arr) => arr.findIndex((x) => x.name === item.name) === idx,
    )

    // 升序排列以便横向条形图从上到下展示
    const sorted = [...display].sort((a, b) => a.net_inflow - b.net_inflow)

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = sorted[params[0].dataIndex]
          if (!item) return ''
          return [
            `${item.name}`,
            `净流入: ${item.net_inflow >= 0 ? '+' : ''}${item.net_inflow.toFixed(2)} 亿元`,
            `涨跌幅: ${formatPercent(item.change_pct)}`,
          ].join('<br/>')
        },
      },
      grid: { left: '3%', right: '10%', bottom: '3%', top: '3%', containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => `${val.toFixed(1)}亿`,
          color: '#999',
        },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((item) => item.name),
        axisLabel: { color: '#666', fontSize: 12 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: '主力净流入',
          type: 'bar',
          data: sorted.map((item) => ({
            value: item.net_inflow,
            itemStyle: {
              color: item.net_inflow >= 0 ? COLOR_UP : COLOR_DOWN,
              borderRadius: item.net_inflow >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
            },
          })),
          barWidth: 18,
          label: {
            show: true,
            position: 'right',
            formatter: (p: any) => `${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}`,
            color: '#666',
            fontSize: 11,
          },
        },
      ],
    }
  }, [data])

  // ============= 板块热力图（涨跌幅） =============
  const heatmapOption = useMemo(() => {
    if (!data) return null
    const items = data.heatmap?.items || []
    if (items.length === 0) return null

    // 按涨跌幅排序
    const sorted = [...items].sort((a, b) => b.change_percent - a.change_percent)

    // 计算行列：每行 6 个
    const cols = 6
    const rows = Math.ceil(sorted.length / cols)

    const heatmapData: [number, number, number, string][] = []

    sorted.forEach((item, idx) => {
      const x = idx % cols
      const y = Math.floor(idx / cols)
      heatmapData.push([x, rows - 1 - y, item.change_percent, item.name])
    })

    const maxAbs = Math.max(2, ...sorted.map((item) => Math.abs(item.change_percent)))

    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const idx = params.dataIndex
          const item = sorted[idx]
          if (!item) return ''
          return [
            `<b>${item.name}</b>`,
            `涨跌幅: ${formatPercent(item.change_percent)}`,
            `成交额: ${formatLargeNumber(item.amount)}亿`,
            `主力净流入: ${item.fund_flow >= 0 ? '+' : ''}${item.fund_flow.toFixed(2)}亿`,
          ].join('<br/>')
        },
      },
      grid: { left: '3%', right: '3%', bottom: '8%', top: '5%', containLabel: true },
      xAxis: {
        type: 'category',
        data: Array.from({ length: cols }, (_, i) => i + 1),
        splitArea: { show: true },
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: Array.from({ length: rows }, (_, i) => rows - i),
        splitArea: { show: true },
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      visualMap: {
        min: -maxAbs,
        max: maxAbs,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: { color: [COLOR_DOWN, '#ffffff', COLOR_UP] },
        text: ['涨', '跌'],
        textStyle: { color: '#666' },
      },
      series: [
        {
          name: '板块涨跌幅',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            formatter: (p: any) => {
              const item = sorted[p.dataIndex]
              if (!item) return ''
              return `{name|${item.name}}\n{pct|${formatPercent(item.change_percent)}}`
            },
            rich: {
              name: { color: '#1a1a2e', fontSize: 11, fontWeight: 'bold', lineHeight: 16 },
              pct: { color: '#333', fontSize: 10, lineHeight: 14 },
            },
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 1,
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' },
          },
        },
      ],
    }
  }, [data])

  // ============= 风格轮动对比图 =============
  const styleRotationOption = useMemo(() => {
    if (!data) return null
    const ls = data.style_rotation?.large_vs_small
    const gv = data.style_rotation?.growth_vs_value
    if (!ls || !gv) return null

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          return params
            .map((p: any) => `${p.name}<br/>${p.seriesName}: ${formatPercent(p.value)}`)
            .join('<br/>')
        },
      },
      legend: {
        data: ['大盘(沪深300)', '小盘(中证500)', '成长(创业板)', '价值(沪深300)'],
        top: 0,
        textStyle: { color: '#666', fontSize: 11 },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['大盘 vs 小盘', '成长 vs 价值'],
        axisLabel: { color: '#666' },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => `${val.toFixed(1)}%`,
          color: '#999',
        },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      series: [
        {
          name: '大盘(沪深300)',
          type: 'bar',
          data: [ls.large_return ?? 0, gv.value_return ?? 0],
          itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
          barGap: '10%',
        },
        {
          name: '小盘(中证500)',
          type: 'bar',
          data: [ls.small_return ?? 0, null],
          itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '成长(创业板)',
          type: 'bar',
          data: [null, gv.growth_return ?? 0],
          itemStyle: { color: COLOR_UP, borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '价值(沪深300)',
          type: 'bar',
          data: [null, gv.value_return ?? 0],
          itemStyle: { color: COLOR_DOWN, borderRadius: [4, 4, 0, 0] },
        },
      ],
    }
  }, [data])

  // ============= 债股跷跷板双轴折线图 =============
  const bondStockOption = useMemo(() => {
    if (!data) return null
    const bs = data.bond_stock
    if (!bs) return null

    // 简化：仅展示当前数据，没有时序数据时使用单点柱图
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: () => {
          return [
            `沪深300 收益: ${formatPercent(bs.stock_return)}`,
            `国债指数 收益: ${formatPercent(bs.bond_return)}`,
            `信号: ${SIGNAL_LABEL[bs.signal] || bs.signal}`,
            `相关性: ${bs.correlation.toFixed(2)}`,
          ].join('<br/>')
        },
      },
      legend: {
        data: ['股市(沪深300)', '债市(国债指数)'],
        top: 0,
        textStyle: { color: '#666', fontSize: 11 },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['近20日累计收益'],
        axisLabel: { color: '#666' },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => `${val.toFixed(1)}%`,
          color: '#999',
        },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      series: [
        {
          name: '股市(沪深300)',
          type: 'bar',
          data: [bs.stock_return],
          itemStyle: {
            color: bs.stock_return >= 0 ? COLOR_UP : COLOR_DOWN,
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: 40,
          label: {
            show: true,
            position: 'top',
            formatter: () => formatPercent(bs.stock_return),
            color: '#333',
            fontSize: 12,
            fontWeight: 'bold',
          },
        },
        {
          name: '债市(国债指数)',
          type: 'bar',
          data: [bs.bond_return],
          itemStyle: {
            color: bs.bond_return >= 0 ? '#3b82f6' : '#f59e0b',
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: 40,
          label: {
            show: true,
            position: 'top',
            formatter: () => formatPercent(bs.bond_return),
            color: '#333',
            fontSize: 12,
            fontWeight: 'bold',
          },
        },
      ],
    }
  }, [data])

  // 强弱切换数据
  const strengthening = data?.strength_switch?.strengthening || []
  const weakening = data?.strength_switch?.weakening || []
  const warnings = data?.warnings || []

  return (
    <div className="sector-rotation-page">
      <div className="page-header">
        <h1 className="page-title">板块热点轮动监测</h1>
        <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
          {loading ? '加载中...' : '刷新数据'}
        </button>
      </div>
      <p className="page-description">
        监测行业板块资金流、热力图、强弱切换、风格轮动和债股跷跷板效应，辅助判断市场风格切换。
      </p>

      {loading && !data ? (
        <div className="sector-skeleton">
          <section className="transaction-card">
            <TableSkeleton rows={6} columns={4} />
          </section>
        </div>
      ) : loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>正在加载板块轮动数据...</span>
        </div>
      ) : null}

      {error && (
        <div className="error-message">
          {error}
          <button className="btn-link" onClick={fetchData}>
            重试
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {warnings.length > 0 && (
            <div className="warning-banner">
              <span className="warning-icon">⚠️</span>
              <span>部分数据获取失败：{warnings[0]}{warnings.length > 1 ? ` 等 ${warnings.length} 项` : ''}</span>
            </div>
          )}

          {/* 板块资金流排名 */}
          <div className="chart-card full-width">
            <div className="chart-title">
              板块资金流排名（日）
              <span className="chart-subtitle">主力净流入额（亿元）· 红涨绿跌</span>
            </div>
            <div className="chart-container">
              {fundFlowOption ? (
                <ReactECharts option={fundFlowOption} style={{ height: '420px' }} />
              ) : (
                <div className="empty-chart">
                  <span>暂无板块资金流数据</span>
                  <span className="empty-sub">数据源可能未返回数据，请稍后重试</span>
                </div>
              )}
            </div>
          </div>

          {/* 板块热力图 */}
          <div className="chart-card full-width">
            <div className="chart-title">
              板块热力图
              <span className="chart-subtitle">色块表示涨跌幅 · 鼠标悬停查看详情</span>
            </div>
            <div className="chart-container">
              {heatmapOption ? (
                <ReactECharts option={heatmapOption} style={{ height: '500px' }} />
              ) : (
                <div className="empty-chart">
                  <span>暂无板块热力图数据</span>
                </div>
              )}
            </div>
          </div>

          {/* 板块强弱切换信号 */}
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">
                <span className="badge badge-up">▲ 转强</span>
                弱势转强板块
              </div>
              <div className="strength-list-container">
                {strengthening.length > 0 ? (
                  <table className="strength-table">
                    <thead>
                      <tr>
                        <th>板块</th>
                        <th>5日排名</th>
                        <th>20日排名</th>
                        <th>排名变化</th>
                        <th>5日涨幅</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strengthening.map((item) => (
                        <tr key={item.name}>
                          <td className="sector-name">{item.name}</td>
                          <td>#{item.rank_5d}</td>
                          <td className="muted">#{item.rank_20d}</td>
                          <td className="positive-value">+{item.change}</td>
                          <td className="positive-value">{formatPercent(item.pct_5d)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-chart">
                    <span>暂无明显转强板块</span>
                  </div>
                )}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-title">
                <span className="badge badge-down">▼ 转弱</span>
                强势转弱板块
              </div>
              <div className="strength-list-container">
                {weakening.length > 0 ? (
                  <table className="strength-table">
                    <thead>
                      <tr>
                        <th>板块</th>
                        <th>5日排名</th>
                        <th>20日排名</th>
                        <th>排名变化</th>
                        <th>5日涨幅</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weakening.map((item) => (
                        <tr key={item.name}>
                          <td className="sector-name">{item.name}</td>
                          <td>#{item.rank_5d}</td>
                          <td className="muted">#{item.rank_20d}</td>
                          <td className="negative-value">{item.change}</td>
                          <td className="negative-value">{formatPercent(item.pct_5d)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-chart">
                    <span>暂无明显转弱板块</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 风格轮动指标 */}
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">
                风格轮动指标
                <span className="chart-subtitle">近 20 日累计收益对比</span>
              </div>
              <div className="chart-container">
                {styleRotationOption ? (
                  <ReactECharts option={styleRotationOption} style={{ height: '320px' }} />
                ) : (
                  <div className="empty-chart">
                    <span>暂无风格轮动数据</span>
                  </div>
                )}
              </div>
              {data.style_rotation && (
                <div className="style-summary">
                  <div className="style-item">
                    <span className="style-label">大盘 vs 小盘</span>
                    <span className="style-value">
                      {TREND_LABEL[data.style_rotation.large_vs_small.trend] || '-'}
                    </span>
                    <span className="style-detail">
                      收益差 {formatPercent(data.style_rotation.large_vs_small.ratio)}
                    </span>
                  </div>
                  <div className="style-item">
                    <span className="style-label">成长 vs 价值</span>
                    <span className="style-value">
                      {TREND_LABEL[data.style_rotation.growth_vs_value.trend] || '-'}
                    </span>
                    <span className="style-detail">
                      收益差 {formatPercent(data.style_rotation.growth_vs_value.ratio)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 债股跷跷板 */}
            <div className="chart-card">
              <div className="chart-title">
                债股跷跷板效应
                <span className="chart-subtitle">近 20 日累计收益对比</span>
              </div>
              <div className="chart-container">
                {bondStockOption ? (
                  <ReactECharts option={bondStockOption} style={{ height: '320px' }} />
                ) : (
                  <div className="empty-chart">
                    <span>暂无债股跷跷板数据</span>
                  </div>
                )}
              </div>
              {data.bond_stock && (
                <div className="style-summary">
                  <div className="style-item">
                    <span className="style-label">当前信号</span>
                    <span className={`style-value ${data.bond_stock.signal}`}>
                      {SIGNAL_LABEL[data.bond_stock.signal] || data.bond_stock.signal}
                    </span>
                  </div>
                  <div className="style-item">
                    <span className="style-label">相关性</span>
                    <span className="style-value">{data.bond_stock.correlation.toFixed(2)}</span>
                    <span className="style-detail">
                      越接近 -1 表示跷跷板效应越明显
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default SectorRotation
