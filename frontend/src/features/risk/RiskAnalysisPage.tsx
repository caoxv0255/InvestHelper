/**
 * RiskAnalysisPage — 风险分析页面（thin 路由组件）
 *
 * 组合：
 *   useRiskAnalysis()        → L2 数据加载 (data/loading/error/refresh)
 *   build*Option(data) × 3   → echarts option builders (charts/)
 *   <RiskLevelCard />        → 顶部大卡片
 *   <MetricCards />          → 关键指标三卡
 *   <LargestWarning />       → 最大单一持仓警告
 *   <WarningsCard />         → 计算提示警告
 *   3 个 <table> inline      → 因子暴露/归因/Beta 列表
 *   ReactECharts × 3 inline  → 3 个 echarts 图表
 *
 * 不抽 3 个 table：每个 < 30 行，且与 data 紧耦合。
 */
import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useRiskAnalysis } from './hooks/useRiskAnalysis'
import { buildIndustryOption } from './charts/industryOption'
import { buildCorrelationOption } from './charts/correlationOption'
import { buildFactorRadarOption } from './charts/factorRadarOption'
import { RiskLevelCard } from './components/RiskLevelCard'
import { MetricCards } from './components/MetricCards'
import { LargestWarning } from './components/LargestWarning'
import { WarningsCard } from './components/WarningsCard'
import { formatPercent } from '../../utils/format'

// 因子名中文映射（原 OpportunitiesPage 同样的 fallback 模式）
const FACTOR_NAME_MAP: Record<string, string> = {
  // 这里可以放实际因子名映射;fallback 到原 key
}

export const RiskAnalysisPage = () => {
  const { data, loading, error, refresh } = useRiskAnalysis()

  // 3 个 chart option useMemo 包装（保持原渲染时机）
  const industryOption = useMemo(() => buildIndustryOption(data), [data])
  const correlationOption = useMemo(() => buildCorrelationOption(data), [data])
  const factorRadarOption = useMemo(() => buildFactorRadarOption(data), [data])

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
          <button className="btn-link" onClick={refresh}>
            重试
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* 顶部风险等级大卡片 */}
          <RiskLevelCard riskScore={data.risk_score} />

          {/* 关键指标三卡 */}
          <MetricCards
            varResult={data.var}
            summary={data.summary}
            hhi={data.risk_score.factors.hhi}
            maxIndustryWeight={data.risk_score.factors.max_industry_weight}
          />

          {/* 最大单一持仓警告 */}
          {showLargestWarning && (
            <LargestWarning
              code={data.largest_position.code}
              weight={data.largest_position.weight}
            />
          )}

          {/* 图表 row 1: 行业 + 相关性 */}
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

          {/* 图表 row 2: 因子雷达 + 归因表 */}
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

          {/* 图表 row 3: 因子暴露表 + Beta 表 */}
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

          {/* 计算提示警告 */}
          <WarningsCard warnings={data.warnings} />
        </>
      )}
    </div>
  )
}

export default RiskAnalysisPage