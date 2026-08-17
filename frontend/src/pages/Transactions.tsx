import { useEffect, useState, useMemo } from 'react'
import { createTransaction, deleteTransaction, getTransactions, type Transaction, type TransactionCreate, type TransactionSide, CASH_FLOW_SIDES, ASSET_SIDES } from '../api/transactions'
import { TableSkeleton } from '../components/TableSkeleton'
import '../styles/Transactions.css'

const today = new Date().toISOString().slice(0, 10)
const emptyForm: TransactionCreate = {
  account: 'alipay', asset_type: 'fund', code: '', name: '', side: 'buy', trade_date: today,
  quantity: 0, price: 0, fee: 0, currency: 'CNY', notes: null,
}

const sideLabel: Record<TransactionSide, string> = {
  buy: '买入', sell: '卖出', dividend: '分红', deposit: '转入', withdraw: '转出',
}
const sideColor: Record<TransactionSide, string> = {
  buy: '#4caf50', sell: '#f44336', dividend: '#ff9800', deposit: '#2196f3', withdraw: '#9c27b0',
}

const isCashFlow = (side: TransactionSide) => CASH_FLOW_SIDES.includes(side)

const Transactions = () => {
  const [items, setItems] = useState<Transaction[]>([])
  const [form, setForm] = useState<TransactionCreate>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [sideTab, setSideTab] = useState<'all' | 'cash' | 'trade'>('all')

  const load = async () => {
    setLoading(true)
    try { setItems(await getTransactions()) } catch { setMessage('交易流水加载失败') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // === 资金汇总（按币种） ===
  const cashSummary = useMemo(() => {
    const byCurrency: Record<string, { deposit: number; withdraw: number }> = {}
    for (const t of items) {
      if (!isCashFlow(t.side)) continue
      const c = t.currency || 'CNY'
      if (!byCurrency[c]) byCurrency[c] = { deposit: 0, withdraw: 0 }
      const amount = t.quantity * t.price
      if (t.side === 'deposit') byCurrency[c].deposit += amount
      else byCurrency[c].withdraw += amount
    }
    return byCurrency
  }, [items])

  const filteredItems = useMemo(() => {
    if (sideTab === 'all') return items
    if (sideTab === 'cash') return items.filter(t => isCashFlow(t.side))
    return items.filter(t => !isCashFlow(t.side))
  }, [items, sideTab])

  // 选中 deposit/withdraw 时，自动填充 code=name=CASH
  const onSideChange = (side: TransactionSide) => {
    if (isCashFlow(side)) {
      setForm({ ...form, side, code: 'CASH', name: '资金', asset_type: 'cash' })
    } else {
      const patch: Partial<TransactionCreate> = { side }
      if (form.code === 'CASH') patch.code = ''
      if (form.name === '资金') patch.name = ''
      if (form.asset_type === 'cash') patch.asset_type = 'fund'
      setForm({ ...form, ...patch })
    }
  }

  const isCashForm = isCashFlow(form.side)

  const submit = async () => {
    if (!isCashForm && (!form.code.trim() || !form.name.trim())) {
      setMessage('请填写代码和名称'); return
    }
    if (form.quantity <= 0) {
      setMessage('金额/数量必须大于 0'); return
    }
    setLoading(true); setMessage('')
    try {
      await createTransaction(form)
      setForm({ ...emptyForm, account: form.account, asset_type: isCashForm ? 'cash' : form.asset_type, currency: form.currency })
      await load(); setMessage(isCashForm ? '资金流水已保存' : '交易流水已保存')
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : '保存失败')
    } finally { setLoading(false) }
  }

  const remove = async (item: Transaction) => {
    const label = isCashFlow(item.side) ? '资金流水' : '交易流水'
    if (!window.confirm(`确定删除 ${item.trade_date} ${item.name} 的${label}吗？`)) return
    setLoading(true)
    try {
      await deleteTransaction(item.id); await load()
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : '删除失败')
    } finally {
      setLoading(false)
    }
  }

  return <div className="page-container">
    <h1 className="page-title">交易流水</h1>
    <p className="page-description">记录真实交易，后续用于重建持仓、计算收益和验证策略。资金转入/转出用于统计本金与真实收益率。</p>

    {/* 资金汇总卡 */}
    {Object.keys(cashSummary).length > 0 && (
      <section className="transaction-card cash-summary-card">
        <h2>资金汇总</h2>
        <div className="cash-summary-grid">
          {Object.entries(cashSummary).map(([currency, s]) => {
            const net = s.deposit - s.withdraw
            const symbol = currency === 'HKD' ? 'HK$' : currency === 'USD' ? '$' : '¥'
            return <div key={currency} className="cash-summary-item">
              <span className="cash-currency">{symbol} {currency}</span>
              <span className="cash-field"><em>累计入金</em><strong>+{s.deposit.toFixed(2)}</strong></span>
              <span className="cash-field"><em>累计出金</em><strong>-{s.withdraw.toFixed(2)}</strong></span>
              <span className="cash-field"><em>净入金</em><strong className={net >= 0 ? 'positive' : 'negative'}>{net >= 0 ? '+' : ''}{net.toFixed(2)}</strong></span>
            </div>
          })}
        </div>
      </section>
    )}

    <section className="transaction-card">
      <h2>新增流水</h2>
      <div className="transaction-form">
        <label>账户<select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}><option value="alipay">支付宝</option><option value="ths">同花顺</option><option value="hk_broker">香港券商</option><option value="other">其他</option></select></label>
        {!isCashForm && (
          <label>资产类型<select value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })}><option value="fund">公募基金</option><option value="stock">股票</option><option value="gold_etf">黄金 ETF</option><option value="etf">ETF</option></select></label>
        )}
        <label>类型<select value={form.side} onChange={(e) => onSideChange(e.target.value as TransactionSide)}>
          <optgroup label="持仓交易">
            {ASSET_SIDES.map(s => <option key={s} value={s}>{sideLabel[s]}</option>)}
          </optgroup>
          <optgroup label="资金流水">
            {CASH_FLOW_SIDES.map(s => <option key={s} value={s}>{sideLabel[s]}</option>)}
          </optgroup>
        </select></label>
        <label>日期<input type="date" value={form.trade_date} onChange={(e) => setForm({ ...form, trade_date: e.target.value })} /></label>
        {!isCashForm && <>
          <label>代码<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="如 510300" /></label>
          <label>名称<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 沪深300ETF" /></label>
        </>}
        <label>{isCashForm ? '金额' : '数量'}<input type="text" inputMode="decimal" value={form.quantity || ''} onChange={(e) => { const v = e.target.value; if (v === '' || v === '.') { setForm({ ...form, quantity: 0 }); } else { const n = Number(v); setForm({ ...form, quantity: Number.isFinite(n) ? n : 0 }); } }} placeholder="0.000000" /></label>
        {isCashForm ? <label>汇率(1=本币)<input type="text" inputMode="decimal" value={form.price || ''} onChange={(e) => { const v = e.target.value; if (v === '' || v === '.') { setForm({ ...form, price: 0 }); } else { const n = Number(v); setForm({ ...form, price: Number.isFinite(n) ? n : 0 }); } }} placeholder="1.00" /></label>
          : <label>成交价/分红金额<input type="text" inputMode="decimal" value={form.price || ''} onChange={(e) => { const v = e.target.value; if (v === '' || v === '.') { setForm({ ...form, price: 0 }); } else { const n = Number(v); setForm({ ...form, price: Number.isFinite(n) ? n : 0 }); } }} placeholder="0.000000" /></label>
        }
        {!isCashForm && <label>手续费<input type="text" inputMode="decimal" value={form.fee || ''} onChange={(e) => { const v = e.target.value; if (v === '' || v === '.') { setForm({ ...form, fee: 0 }); } else { const n = Number(v); setForm({ ...form, fee: Number.isFinite(n) ? n : 0 }); } }} placeholder="0.00" /></label>}
        <label>币种<select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="CNY">人民币</option><option value="HKD">港币</option><option value="USD">美元</option></select></label>
        {isCashForm && <label>备注<input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} placeholder="可选" style={{ gridColumn: 'span 2' }} /></label>}
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={loading}>{isCashForm ? '保存资金流水' : '保存流水'}</button>
      {message && <span className="transaction-message">{message}</span>}
    </section>

    <section className="transaction-card">
      <div className="transaction-list-header">
        <h2>历史流水</h2>
        <div className="transaction-tab-group">
          {([['all', '全部'], ['trade', '持仓交易'], ['cash', '资金流水']] as const).map(([key, label]) =>
            <button key={key} className={`tab-btn${sideTab === key ? ' active' : ''}`} onClick={() => setSideTab(key)}>{label}</button>
          )}
        </div>
      </div>
      <div className="table-container"><table className="data-table"><thead><tr>
        <th>日期</th><th>账户</th><th>标的</th><th>类型</th><th>{sideTab === 'cash' ? '金额' : '数量'}</th><th>价格/汇率</th><th>金额</th><th>操作</th>
      </tr></thead><tbody>
        {loading && filteredItems.length === 0 ? <tr><td colSpan={8}><TableSkeleton rows={5} columns={8} /></td></tr>
        : filteredItems.length === 0 ? <tr><td colSpan={8} className="empty-cell">暂无交易流水</td></tr>
        : filteredItems.map((item) => <tr key={item.id}>
          <td>{item.trade_date}</td>
          <td>{item.account}</td>
          <td>{isCashFlow(item.side) ? <span className="cash-tag">现金</span> : <>{item.name} <span className="code-hint">({item.code})</span></>}</td>
          <td><span className="side-badge" style={{ color: sideColor[item.side], borderColor: sideColor[item.side] }}>{sideLabel[item.side]}</span></td>
          <td>{item.quantity}</td><td>{item.price} {item.currency}</td>
          <td>{isCashFlow(item.side)
            ? <span className={item.side === 'deposit' ? 'positive' : 'negative'}>{item.side === 'deposit' ? '+' : '-'}{(item.quantity * item.price).toFixed(2)}</span>
            : <>{(item.quantity * item.price).toFixed(2)}</>
          }</td>
          <td><button className="btn-link btn-delete" onClick={() => remove(item)}>删除</button></td>
        </tr>)}
      </tbody></table></div>
    </section>
  </div>
}

export default Transactions
