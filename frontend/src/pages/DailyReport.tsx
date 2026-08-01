import { useEffect, useState } from 'react'
import { getDailyReport, type DailyReport } from '../api/dailyReport'
import '../styles/DailyReport.css'

const DailyReport = () => {
  const [report, setReport] = useState<DailyReport | null>(null)
  const [error, setError] = useState('')
  const load = async () => { try { setReport(await getDailyReport()); setError('') } catch (err: unknown) { setError(err instanceof Error ? err.message : '报告加载失败') } }
  useEffect(() => { load() }, [])
  return <div className="page-container"><h1 className="page-title">每日投资报告</h1><p className="page-description">本地生成的组合摘要和风险提醒，数据不会自动发送到外部服务。</p><button className="btn btn-secondary" onClick={load}>刷新报告</button>{error && <p className="form-error">{error}</p>}{report && <><p className="report-date">报告日期：{report.report_date} · 流水：{report.transaction_count} 笔</p><section className="report-card"><h2>需要关注</h2>{report.attention.length ? <ul>{report.attention.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="success">当前没有触发已配置的风险提醒。</p>}</section><section className="report-card"><h2>当前持仓</h2><div className="report-list">{report.positions.length ? report.positions.map((position) => <div key={`${position.currency}-${position.code}`}><span>{position.name} ({position.code})</span><strong>{position.market_value.toFixed(2)} {position.currency}</strong></div>) : <p>暂无交易流水。</p>}</div></section><p className="text-muted">{report.disclaimer}</p></>}</div>
}

export default DailyReport
