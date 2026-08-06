import { useState } from 'react'
import { runBacktest, type BacktestRequest, type BacktestResult } from '../api/backtests'
import { TableSkeleton } from '../components/TableSkeleton'
import { getDailyKline } from '../api/market'
import '../styles/StrategyLab.css'

const makeSampleBars = (start: number, drift: number) =>
  Array.from({ length: 180 }, (_, index) => ({
    date: new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10),
    close: Number((start * (1 + drift * index + Math.sin(index / 9) * 0.012)).toFixed(2)),
  }))

const sampleRequest = (): BacktestRequest => ({
  strategy: 'sma_trend',
  initial_capital: 10000,
  fee_rate: 0.001,
  slippage_rate: 0.0005,
  lookback: 20,
  short_window: 20,
  long_window: 60,
  assets: [
    { code: 'SAMPLE-A', name: '示例资产A', target_weight: 0.45, bars: makeSampleBars(100, 0.0012) },
    { code: 'SAMPLE-B', name: '示例资产B', target_weight: 0.35, bars: makeSampleBars(100, 0.0005) },
  ],
  constraints: {
    max_drawdown: 0.2,
    max_single_weight: 0.3,
    max_monthly_trades: 4,
    min_trade_amount: 500,
    min_cash_weight: 0.1,
  },
})

const StrategyLab = () => {
  const [request, setRequest] = useState<BacktestRequest>(sampleRequest)
  const [codeInput, setCodeInput] = useState('000300,510300')
  const [typeInput, setTypeInput] = useState<'stock' | 'fund' | 'index'>('index')
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const updateConstraint = (key: keyof BacktestRequest['constraints'], value: number) => {
    setRequest((current) => ({ ...current, constraints: { ...current.constraints, [key]: value } }))
  }

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      setResult(await runBacktest(request))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '回测失败'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const loadMarketData = async () => {
    setLoading(true)
    setError('')
    try {
      const codes = codeInput.split(',').map((code) => code.trim()).filter(Boolean)
      const responses = await Promise.all(codes.map((code) => getDailyKline(code, typeInput)))
      const assets = responses.map((response, index) => ({
        code: response.code || codes[index],
        name: response.name || codes[index],
        target_weight: Math.min(0.3, 0.8 / responses.length),
        bars: response.klines.filter((bar) => bar.close > 0),
      })).filter((asset) => asset.bars.length >= 2)
      if (assets.length === 0) throw new Error('没有获取到有效历史行情，请检查代码或数据源')
      setRequest((current) => ({ ...current, assets }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '行情加载失败')
    } finally {
      setLoading(false)
    }
  }

  const chartPoints = (key: 'equity' | 'drawdown') => {
    if (!result?.equity_curve.length) return ''
    const values = result.equity_curve.map((point) => key === 'equity' ? point.equity : point.drawdown * 100)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    return values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${92 - ((value - min) / range) * 84}`).join(' ')
  }

  const metrics = result?.metrics
  const isSampleData = request.assets.length > 0 && request.assets[0].code === 'SAMPLE-A'
  const assetSummary = request.assets.map((a) => a.code).join(', ')
  return (
    <div className="page-container">
      <h1 className="page-title">策略实验室</h1>
      <p className="page-description">先用历史价格验证规则，再让 AI 解释结果。示例数据仅用于验证功能，不代表真实行情。</p>
      {isSampleData && (
        <div className="sample-data-banner" role="alert">
          <strong>⚠️ 当前使用示例数据（{assetSummary}）</strong>
          <span>回测结果不代表真实行情。请先在上方输入真实代码并点击「加载 AKShare 行情」。</span>
        </div>
      )}
      <div className="strategy-grid">
        <section className="strategy-card">
          <h2>策略与约束</h2>
          <label>真实行情代码（逗号分隔）<input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="例如 000300,510300" /></label>
          <label>行情类型<select value={typeInput} onChange={(e) => setTypeInput(e.target.value as typeof typeInput)}><option value="index">指数</option><option value="stock">股票</option><option value="fund">基金净值</option></select></label>
          <button className="btn btn-secondary" onClick={loadMarketData} disabled={loading}>加载 AKShare 行情</button>
          <label>策略<select value={request.strategy} onChange={(e) => setRequest({ ...request, strategy: e.target.value as BacktestRequest['strategy'] })}>
            <option value="sma_trend">均线趋势</option><option value="momentum">动量轮动</option><option value="rebalance">固定比例再平衡</option><option value="buy_hold">买入持有</option>
          </select></label>
          <label>初始资金<input type="text" inputMode="decimal" value={request.initial_capital} onChange={(e) => setRequest({ ...request, initial_capital: Number(e.target.value) })} placeholder="100000" /></label>
          <label>最大组合回撤<input type="text" inputMode="decimal" step="0.01" value={request.constraints.max_drawdown} onChange={(e) => updateConstraint('max_drawdown', Number(e.target.value))} placeholder="0.20" /></label>
          <label>单一标的上限<input type="text" inputMode="decimal" step="0.01" value={request.constraints.max_single_weight} onChange={(e) => updateConstraint('max_single_weight', Number(e.target.value))} placeholder="0.30" /></label>
          <label>每月最多交易<input type="text" inputMode="decimal" value={request.constraints.max_monthly_trades} onChange={(e) => updateConstraint('max_monthly_trades', Number(e.target.value))} placeholder="10" /></label>
          <label>最低调仓金额<input type="text" inputMode="decimal" value={request.constraints.min_trade_amount} onChange={(e) => updateConstraint('min_trade_amount', Number(e.target.value))} placeholder="1000" /></label>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? '计算中...' : '运行回测'}</button>
          {error && <p className="form-error">{error}</p>}
        </section>
        <section className="strategy-card">
          <h2>结果</h2>
          {!metrics && !loading && <p className="muted">点击"运行回测"查看指标。</p>}
          {loading && !metrics ? (
            <div className="metric-grid">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i}><TableSkeleton rows={2} columns={1} /></div>
              ))}
            </div>
          ) : metrics && <>
            <div className="metric-grid">
              <div><span>累计收益</span><strong>{(Number(metrics.total_return) * 100).toFixed(2)}%</strong></div>
              <div><span>最大回撤</span><strong>{(Number(metrics.max_drawdown) * 100).toFixed(2)}%</strong></div>
              <div><span>夏普比率</span><strong>{Number(metrics.sharpe).toFixed(2)}</strong></div>
              <div><span>交易次数</span><strong>{metrics.trade_count}</strong></div>
            </div>
            <p className={metrics.constraint_passed ? 'success' : 'form-error'}>{metrics.constraint_passed ? '通过最大回撤约束' : '未通过最大回撤约束'}</p>
            {result?.warnings.map((warning) => <p className="warning" key={warning}>{warning}</p>)}
            <h3>净值曲线</h3>
            <svg className="equity-chart" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={chartPoints('equity')} fill="none" stroke="#2563eb" strokeWidth="1.5" /></svg>
            <h3>回撤曲线</h3>
            <svg className="equity-chart drawdown-chart" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={chartPoints('drawdown')} fill="none" stroke="#dc2626" strokeWidth="1.5" /></svg>
            <h3>交易记录</h3>
            <ul>{result?.trades.slice(0, 8).map((trade) => <li key={trade.date}>{trade.date}：约 ¥{trade.amount.toFixed(0)}</li>)}</ul>
          </>}
        </section>
      </div>
    </div>
  )
}

export default StrategyLab
