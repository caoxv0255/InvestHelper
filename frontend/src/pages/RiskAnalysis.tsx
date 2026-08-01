import { useState, useEffect, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { getRiskAnalysis } from '../api/risk'
import type { RiskAnalysisResult, RiskLevel } from '../types'
import { formatCurrency, formatPercent, formatLargeCurrency } from '../utils/format'
import '../styles/RiskAnalysis.css'

// 风险等级对应的中文描述
const RISK_LEVEL_DESC: Record<RiskLevel, string> = {
  low: '您的投资组合分散度较好，单一行业或标的风险可控。',
  medium: '组合整体风险适中，建议关注集中度较高的行业和标的。',
  high: '组合风险较高，存在行业集中或标的相关性过大的问题。',
  very_high: '组合风险极高，请尽快调整仓位，降低单一行业和标的敞口。',
}

// 因子英文标识映射为中文名称，便于前端展示
const FACTOR_NAME_MAP: Record<string, string> = {
  market: '市场因子',
  size: '规模因子',
  value: '价值因子',
  momentum: '动量因子',
  industry: '行业因子',
}

const RiskAnalysis = () => {
  const [data, setData] = useState<RiskAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getRiskAnalysis()
      setData(result)
    } catch (err: any) {
      setError(err.message || '加载风险分析数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // 行业集中度横向条形图配置
  const industryOption = useMemo(() => {
    if (!data || data.industry_concentration.length === 0) {
      return null
    }
    const sorted = [...data.industry_concentration].sort((a, b) => a.weight - b.weight)
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = params[0]
          return `${item.name}<br/>权重: ${(item.value * 100).toFixed(2)}%`
        },
      },
      grid: {
        left: '3%',
        right: '8%',
        bottom: '3%',
        top: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        max: 1,
        axisLabel: {
          formatter: (value: number) => `${(value * 100).toFixed(0)}%`,
          color: '#999',
        },
        splitLine: {
          lineStyle: { color: '#f0f0f0' },
        },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((item) => item.industry),
        axisLabel: {
          color: '#666',
          fontSize: 12,
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: '权重',
          type: 'bar',
          data: sorted.map((item) => ({
            value: item.weight,
            itemStyle: {
              color:
                item.weight > 0.5
                  ? '#ef4444'
                  : item.weight > 0.3
                    ? '#f97316'
                    : '#667eea',
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: 20,
          label: {
            show: true,
            position: 'right',
            formatter: (p: any) => `${(p.value * 100).toFixed(1)}%`,
            color: '#666',
            fontSize: 11,
          },
        },
      ],
    }
  }, [data])

  // 相关性矩阵热力图配置
  const correlationOption = useMemo(() => {
    if (!data || data.correlation_matrix.codes.length < 2) {
      return null
    }
    const { codes, correlations } = data.correlation_matrix
    const heatmapData: [number, number, number][] = []
    for (let i = 0; i < codes.length; i++) {
      for (let j = 0; j < codes.length; j++) {
        heatmapData.push([j, i, correlations[i][j]])
      }
    }

    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const x = codes[params.value[0]]
          const y = codes[params.value[1]]
          const v = params.value[2]
          return `${x} / ${y}<br/>相关系数: ${v.toFixed(3)}`
        },
      },
      grid: {
        left: '12%',
        right: '8%',
        bottom: '12%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: codes,
        splitArea: { show: true },
        axisLabel: {
          color: '#666',
          fontSize: 11,
          rotate: 45,
        },
      },
      yAxis: {
        type: 'category',
        data: codes,
        splitArea: { show: true },
        axisLabel: {
          color: '#666',
          fontSize: 11,
        },
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: {
          color: ['#22c55e', '#ffffff', '#ef4444'],
        },
        text: ['高相关', '低相关'],
        textStyle: { color: '#666' },
      },
      series: [
        {
          name: '相关系数',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            formatter: (p: any) => p.value[2].toFixed(2),
            fontSize: 10,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    }
  }, [data])

  // 因子暴露雷达图配置
  const factorRadarOption = useMemo(() => {
    if (!data || data.factor_radar.length === 0) {
      return null
    }
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const rows = data.factor_radar.map(
            (item, index) => `${item.indicator}: ${(params.value[index] * 100).toFixed(0)}%`
          )
          return `${params.name}<br/>${rows.join('<br/>')}`
        },
      },
      radar: {
        indicator: data.factor_radar.map((item) => ({ name: item.indicator, max: 1 })),
        radius: '65%',
        splitNumber: 4,
        axisName: {
          color: '#666',
          fontSize: 12,
        },
        splitLine: {
          lineStyle: { color: '#e5e7eb' },
        },
        splitArea: {
          areaStyle: { color: ['#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db'] },
        },
      },
      series: [
        {
          name: '因子暴露',
          type: 'radar',
          data: [
            {
              value: data.factor_radar.map((item) => item.value),
              name: '组合风险暴露',
              areaStyle: {
                color: 'rgba(102, 126, 234, 0.25)',
              },
              lineStyle: {
                color: '#667eea',
                width: 2,
              },
              itemStyle: {
                color: '#667eea',
              },
            },
          ],
        },
      ],
    }
  }, [data])

  // 最大单一持仓是否触发警告（权重超过 30%）
  const showLargestWarning = data && data.largest_position.weight > 0.3

  return (
    <div className="risk-analysis-page">
      <h1 className="page-title">风险分析</h1>

      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>正在计算风险指标...</span>
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

      {!loading && !error && data && (
        <>
          {/* 顶部风险等级大卡片 */}
          <div className={`risk-level-card ${data.risk_score.level}`}>
            <div className="risk-level-label">当前风险等级</div>
            <div className="risk-level-value">{data.risk_score.label}</div>
            <div className="risk-level-desc">
              {RISK_LEVEL_DESC[data.risk_score.level]}
            </div>

            {/* 风险因子明细 */}
            <div className="risk-factors">
              <div className="risk-factor">
                <span className="risk-factor-name">综合得分</span>
                <span className="risk-factor-value">
                  {data.risk_score.factors.total_score}
                </span>
              </div>
              <div className="risk-factor">
                <span className="risk-factor-name">集中度得分</span>
                <span className="risk-factor-value">
                  {data.risk_score.factors.concentration_score}
                </span>
              </div>
              <div className="risk-factor">
                <span className="risk-factor-name">相关性得分</span>
                <span className="risk-factor-value">
                  {data.risk_score.factors.correlation_score}
                </span>
              </div>
              <div className="risk-factor">
                <span className="risk-factor-name">VaR 得分</span>
                <span className="risk-factor-value">
                  {data.risk_score.factors.var_score}
                </span>
              </div>
            </div>
          </div>

          {/* 关键指标卡片 */}
          <div className="metric-cards">
            <div className="metric-card">
              <div className="metric-label">单日最大可能损失 (VaR)</div>
              <div className={`metric-value ${data.var.percentage > 0.03 ? 'warning' : ''}`}>
                {formatCurrency(data.var.amount)}
              </div>
              <div className="metric-sub">
                在 {(data.var.confidence * 100).toFixed(0)}% 置信水平下，单日损失不超过{' '}
                {formatPercent(data.var.percentage * 100)}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">组合总市值</div>
              <div className="metric-value">
                {formatLargeCurrency(data.summary.total_value)}
              </div>
              <div className="metric-sub">共 {data.summary.position_count} 只持仓</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">行业集中度 (HHI)</div>
              <div className="metric-value">
                {data.risk_score.factors.hhi.toFixed(4)}
              </div>
              <div className="metric-sub">
                最大行业权重: {formatPercent(data.risk_score.factors.max_industry_weight * 100)}
              </div>
            </div>
          </div>

          {/* 最大单一持仓警告 */}
          {showLargestWarning && (
            <div className="warning-card">
              <div className="warning-icon">⚠️</div>
              <div className="warning-content">
                <div className="warning-title">最大单一持仓占比过高</div>
                <div className="warning-desc">
                  {data.largest_position.code} 占比达到{' '}
                  {formatPercent(data.largest_position.weight * 100)}，
                  建议适当分散以降低单一标的风险。
                </div>
              </div>
            </div>
          )}

          {/* 图表区域 */}
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">行业集中度分布</div>
              <div className="chart-container">
                {industryOption ? (
                  <ReactECharts option={industryOption} style={{ height: '320px' }} />
                ) : (
                  <div className="empty-chart">
                    <span>暂无行业分布数据</span>
                    <span style={{ fontSize: '0.8rem' }}>请为持仓补充行业信息</span>
                  </div>
                )}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-title">标的收益相关性矩阵</div>
              <div className="chart-container">
                {correlationOption ? (
                  <ReactECharts option={correlationOption} style={{ height: '360px' }} />
                ) : (
                  <div className="empty-chart">
                    <span>相关性数据不足</span>
                    <span style={{ fontSize: '0.8rem' }}>至少需要 2 只有价格数据的标的</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 多因子分析区域 */}
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">因子暴露雷达图</div>
              <div className="chart-container">
                {factorRadarOption ? (
                  <ReactECharts option={factorRadarOption} style={{ height: '360px' }} />
                ) : (
                  <div className="empty-chart">
                    <span>暂无因子暴露数据</span>
                  </div>
                )}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-title">因子贡献归因</div>
              <div className="chart-container">
                {data.factor_attribution.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>因子</th>
                        <th>年化贡献</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.factor_attribution.map((item) => (
                        <tr key={item.factor}>
                          <td>{FACTOR_NAME_MAP[item.factor] ?? item.factor}</td>
                          <td
                            className={
                              item.contribution >= 0 ? 'positive-value' : 'negative-value'
                            }
                          >
                            {formatPercent(item.contribution * 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-chart">
                    <span>暂无归因数据</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 因子暴露明细 */}
          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-title">组合因子暴露</div>
              <div className="chart-container">
                {data.factor_exposures.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>因子</th>
                        <th>暴露值</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.factor_exposures.map((item) => (
                        <tr key={item.factor}>
                          <td>{FACTOR_NAME_MAP[item.factor] ?? item.factor}</td>
                          <td>{item.value.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-chart">
                    <span>暂无因子暴露数据</span>
                  </div>
                )}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-title">个股 Beta 列表</div>
              <div className="chart-container">
                {data.stock_betas.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>代码</th>
                        <th>行业</th>
                        <th>权重</th>
                        <th>Beta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.stock_betas]
                        .sort((a, b) => b.weight - a.weight)
                        .map((item) => (
                          <tr key={item.code}>
                            <td>{item.code}</td>
                            <td>{item.industry ?? '-'}</td>
                            <td>{formatPercent(item.weight * 100)}</td>
                            <td className={item.beta >= 1 ? 'warning-value' : ''}>
                              {item.beta.toFixed(3)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-chart">
                    <span>暂无个股 Beta 数据</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 计算警告 */}
          {data.warnings.length > 0 && (
            <div className="warning-card">
              <div className="warning-icon">⚠️</div>
              <div className="warning-content">
                <div className="warning-title">计算提示</div>
                <div className="warning-desc">
                  <ul className="warning-list">
                    {data.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default RiskAnalysis
