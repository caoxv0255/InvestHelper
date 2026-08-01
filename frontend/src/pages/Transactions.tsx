import { useEffect, useState } from 'react'
import { createTransaction, deleteTransaction, getTransactions, type Transaction, type TransactionCreate, type TransactionSide } from '../api/transactions'
import '../styles/Transactions.css'

const today = new Date().toISOString().slice(0, 10)
const emptyForm: TransactionCreate = {
  account: 'ths', asset_type: 'stock', code: '', name: '', side: 'buy', trade_date: today,
  quantity: 0, price: 0, fee: 0, currency: 'CNY', notes: null,
}

const sideLabel: Record<TransactionSide, string> = { buy: '买入', sell: '卖出', dividend: '分红' }

const Transactions = () => {
  const [items, setItems] = useState<Transaction[]>([])
  const [form, setForm] = useState<TransactionCreate>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try { setItems(await getTransactions()) } catch { setMessage('交易流水加载失败') } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim() || form.quantity <= 0 || form.price < 0) {
      setMessage('请填写代码、名称、数量和价格')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      await createTransaction(form)
      setForm({ ...emptyForm, account: form.account, asset_type: form.asset_type, currency: form.currency })
      await load()
      setMessage('已保存交易流水')
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : '保存失败')
    } finally { setLoading(false) }
  }

  const remove = async (item: Transaction) => {
    if (!window.confirm(`确定删除 ${item.trade_date} ${item.name} 的流水吗？`)) return
    await deleteTransaction(item.id)
    await load()
  }

  return <div className="page-container">
    <h1 className="page-title">交易流水</h1>
    <p className="page-description">记录真实交易，后续用于重建持仓、计算收益和验证策略。当前仅本地保存。</p>
    <section className="transaction-card">
      <h2>新增流水</h2>
      <div className="transaction-form">
        <label>账户<select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}><option value="alipay">支付宝</option><option value="ths">同花顺</option><option value="hk_broker">香港券商</option><option value="other">其他</option></select></label>
        <label>资产类型<select value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })}><option value="fund">公募基金</option><option value="stock">股票</option><option value="gold_etf">黄金 ETF</option><option value="etf">ETF</option></select></label>
        <label>交易类型<select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value as TransactionSide })}><option value="buy">买入</option><option value="sell">卖出</option><option value="dividend">分红</option></select></label>
        <label>交易日期<input type="date" value={form.trade_date} onChange={(e) => setForm({ ...form, trade_date: e.target.value })} /></label>
        <label>代码<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="如 510300" /></label>
        <label>名称<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 沪深300ETF" /></label>
        <label>数量<input type="number" min="0" step="0.000001" value={form.quantity || ''} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></label>
        <label>成交价/分红金额<input type="number" min="0" step="0.000001" value={form.price || ''} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></label>
        <label>手续费<input type="number" min="0" step="0.01" value={form.fee || ''} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })} /></label>
        <label>币种<select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="CNY">人民币</option><option value="HKD">港币</option><option value="USD">美元</option></select></label>
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={loading}>保存流水</button>
      {message && <span className="transaction-message">{message}</span>}
    </section>
    <section className="transaction-card">
      <h2>历史流水</h2>
      <div className="table-container"><table className="data-table"><thead><tr><th>日期</th><th>账户</th><th>标的</th><th>类型</th><th>数量</th><th>价格</th><th>金额</th><th>操作</th></tr></thead><tbody>
        {items.length === 0 ? <tr><td colSpan={8} className="empty-cell">暂无交易流水</td></tr> : items.map((item) => <tr key={item.id}><td>{item.trade_date}</td><td>{item.account}</td><td>{item.name} ({item.code})</td><td>{sideLabel[item.side]}</td><td>{item.quantity}</td><td>{item.price} {item.currency}</td><td>{(item.quantity * item.price).toFixed(2)}</td><td><button className="btn-link btn-delete" onClick={() => remove(item)}>删除</button></td></tr>)}
      </tbody></table></div>
    </section>
  </div>
}

export default Transactions
