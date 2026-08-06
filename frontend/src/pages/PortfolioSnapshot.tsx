import { useEffect, useState } from 'react'
import { capturePortfolioSnapshot, getPortfolioHistory, getPortfolioSnapshot, type PortfolioHistory, type PortfolioSnapshot } from '../api/portfolio'
import { TableSkeleton } from '../components/TableSkeleton'
import '../styles/PortfolioSnapshot.css'

const PortfolioSnapshot = () => {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<PortfolioHistory | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try { setSnapshot(await getPortfolioSnapshot()); setHistory(await getPortfolioHistory()) } catch (err: unknown) { setError(err instanceof Error ? err.message : '组合快照加载失败') } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const capture = async () => { setLoading(true); try { await capturePortfolioSnapshot(); await load() } catch (err: unknown) { setError(err instanceof Error ? err.message : '快照保存失败') } finally { setLoading(false) } }
  const pointsFor = (points: Array<{ market_value: number; drawdown: number }>, key: 'market_value' | 'drawdown') => {
    if (!points.length) return ''
    const values = points.map((point) => key === 'market_value' ? point.market_value : point.drawdown * 100)
    const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1
    return values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${92 - ((value - min) / range) * 84}`).join(' ')
  }

  return <div className="page-container">
    <h1 className="page-title">组合快照</h1>
    <p className="page-description">根据交易流水重建当前持仓，采用加权平均成本法；人民币、港币和美元分开统计。</p>
    <button className="btn btn-primary" onClick={capture} disabled={loading}>{loading ? '处理中...' : '保存今日快照'}</button>
    <button className="btn btn-secondary" onClick={load} disabled={loading}>刷新数据</button>
    {error && <p className="form-error">{error}</p>}
    {loading && !snapshot ? (
      <div className="snapshot-skeleton">
        <div className="snapshot-summary">
          <div className="snapshot-card">
            <TableSkeleton rows={1} columns={2} />
          </div>
        </div>
        <div className="transaction-card">
          <TableSkeleton rows={6} columns={8} />
        </div>
      </div>
    ) : snapshot && <>
      <div className="snapshot-summary">
        {Object.entries(snapshot.summary_by_currency).map(([currency, values]) => <div className="snapshot-card" key={currency}><span>{currency}市值</span><strong>{values.market_value.toFixed(2)}</strong><small>总收益 {values.total_profit.toFixed(2)}</small></div>)}
        <div className="snapshot-card"><span>流水笔数</span><strong>{snapshot.transaction_count}</strong><small>成本法：加权平均</small></div>
      </div>
      {snapshot.warnings.map((warning) => <p className="warning" key={warning}>{warning}</p>)}
      {history && Object.entries(history.currencies).map(([currency, data]) => <div className="transaction-card history-card" key={currency}><h2>{currency}历史表现</h2><p>快照数：{data.points.length}　累计变化：{(data.return * 100).toFixed(2)}%　最大回撤：{(data.max_drawdown * 100).toFixed(2)}%</p><svg className="history-chart" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={pointsFor(data.points, 'market_value')} fill="none" stroke="#2563eb" strokeWidth="1.5" /></svg><svg className="history-chart drawdown-chart" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={pointsFor(data.points, 'drawdown')} fill="none" stroke="#dc2626" strokeWidth="1.5" /></svg></div>)}
      <div className="transaction-card"><div className="table-container"><table className="data-table"><thead><tr><th>账户</th><th>标的</th><th>数量</th><th>平均成本</th><th>当前价</th><th>市值</th><th>未实现收益</th><th>已实现/分红</th></tr></thead><tbody>
        {snapshot.positions.length === 0 ? <tr><td colSpan={8} className="empty-cell">暂无可重建持仓，请先录入交易流水</td></tr> : snapshot.positions.map((position) => <tr key={`${position.account}-${position.code}-${position.currency}`}><td>{position.account}</td><td>{position.name} ({position.code})</td><td>{position.quantity.toFixed(4)}</td><td>{position.average_cost.toFixed(4)} {position.currency}</td><td>{position.current_price.toFixed(4)}</td><td>{position.market_value.toFixed(2)}</td><td className={position.unrealized_profit >= 0 ? 'profit-positive' : 'profit-negative'}>{position.unrealized_profit.toFixed(2)}</td><td>{(position.realized_profit + position.dividends).toFixed(2)}</td></tr>)}
      </tbody></table></div></div>
    </>}
  </div>
}

export default PortfolioSnapshot
