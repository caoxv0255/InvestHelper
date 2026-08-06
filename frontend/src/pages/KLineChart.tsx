import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { getKline, searchStocks } from '../api/market'
import KLineChartView from '../components/KLineChartView'
import { calculateMA, calculateMACD, calculateKDJ, calculateVolume } from '../utils/indicators'
import { useDebounce } from '../hooks'
import { formatCurrency, formatNumber } from '../utils/format'
import type { KLineData, IndicatorData, Period, StockSearchResult } from '../types'
import '../styles/KLineChart.css'

/** 周期选项 */
const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: '日K', value: 'daily' },
  { label: '周K', value: 'weekly' },
  { label: '60分', value: '60min' },
  { label: '30分', value: '30min' },
  { label: '15分', value: '15min' },
  { label: '5分', value: '5min' },
]

/**
 * K线图表页面
 * 支持股票搜索、多周期切换、技术指标开关
 */
const KLineChart = () => {
  // 当前标的
  const [keyword, setKeyword] = useState('')
  const [currentCode, setCurrentCode] = useState<string>('000001')
  const [currentName, setCurrentName] = useState<string>('平安银行')
  const [assetType, setAssetType] = useState<'stock' | 'fund' | 'index'>('stock')

  // 周期与数据
  const [period, setPeriod] = useState<Period>('daily')
  const [klineData, setKlineData] = useState<KLineData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 搜索结果
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 指标可见性
  const [visible, setVisible] = useState({
    ma: true,
    macd: true,
    kdj: false,
    volume: true,
  })

  // 计算指标
  const indicators: IndicatorData = useMemo(() => {
    return {
      ma5: calculateMA(klineData, 5),
      ma10: calculateMA(klineData, 10),
      ma20: calculateMA(klineData, 20),
      macd: calculateMACD(klineData),
      kdj: calculateKDJ(klineData),
      volume: calculateVolume(klineData),
    }
  }, [klineData])

  // 最新价格
  const latestPrice = useMemo(() => {
    if (klineData.length === 0) return null
    return klineData[klineData.length - 1]
  }, [klineData])

  /**
   * 加载 K 线数据
   */
  const loadKline = useCallback(async () => {
    if (!currentCode) return
    setLoading(true)
    setError(null)
    try {
      const res = await getKline(currentCode, period, assetType)
      // 后端返回 { code, name, klines } 直接使用
      if (!res || !Array.isArray(res.klines)) {
        throw new Error('返回数据格式异常')
      }
      setKlineData(res.klines)
      if (res.name) {
        setCurrentName(res.name)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载K线数据失败，请稍后重试')
      setKlineData([])
    } finally {
      setLoading(false)
    }
  }, [currentCode, period, assetType])

  // 周期或标的变化时重新加载
  useEffect(() => {
    loadKline()
  }, [loadKline])

  // 搜索 input：useDebounce 把快速输入稳定为 300ms 间隔
  const debouncedKeyword = useDebounce(keyword, 300)

  useEffect(() => {
    if (!debouncedKeyword.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await searchStocks(debouncedKeyword.trim())
        if (cancelled) return
        const list = res?.list ?? []
        setSearchResults(Array.isArray(list) ? list : [])
        setShowResults(true)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '搜索失败，请稍后重试')
        setSearchResults([])
        setShowResults(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debouncedKeyword])

  /**
   * 选中搜索结果
   */
  const handleSelectStock = (item: StockSearchResult) => {
    setCurrentCode(item.code)
    setCurrentName(item.name)
    setAssetType(item.type)
    setKeyword(`${item.name} (${item.code})`)
    setShowResults(false)
    setSearchResults([])
  }

  /**
   * 监听点击外部关闭搜索下拉
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /**
   * 切换指标显示
   */
  const toggleIndicator = (key: keyof typeof visible) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="kline-page">
      {/* 顶部工具栏 */}
      <div className="kline-toolbar">
        <div className="kline-search" ref={searchInputRef}>
          <input
            type="text"
            className="kline-search-input"
            placeholder="输入股票/基金代码或名称"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onFocus={() => keyword.trim() && searchResults.length > 0 && setShowResults(true)}
          />
          {showResults && searchResults.length > 0 && (
            <ul className="kline-search-results">
              {searchResults.map((item) => (
                <li
                  key={`${item.type}-${item.code}`}
                  className="kline-search-item"
                  onClick={() => handleSelectStock(item)}
                >
                  <span className="kline-search-name">{item.name}</span>
                  <span className="kline-search-code">{item.code}</span>
                  <span className="kline-search-type">{item.type === 'stock' ? '股票' : item.type === 'fund' ? '基金' : '指数'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="kline-info">
          <span className="kline-info-name">{currentName}</span>
          <span className="kline-info-code">{currentCode}</span>
          {latestPrice && (
            <span className="kline-info-price">
              最新: {formatCurrency(latestPrice.close)} / 涨跌: {formatNumber(latestPrice.close - latestPrice.open)}
            </span>
          )}
        </div>
      </div>

      {/* 周期切换 */}
      <div className="kline-period-bar">
        {PERIOD_OPTIONS.map((item) => (
          <button
            key={item.value}
            className={`kline-period-btn ${period === item.value ? 'active' : ''}`}
            onClick={() => setPeriod(item.value)}
            disabled={loading}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 指标开关 */}
      <div className="kline-indicator-bar">
        {[
          { key: 'ma', label: 'MA' },
          { key: 'macd', label: 'MACD' },
          { key: 'kdj', label: 'KDJ' },
          { key: 'volume', label: '成交量' },
        ].map((item) => (
          <button
            key={item.key}
            className={`kline-indicator-btn ${visible[item.key as keyof typeof visible] ? 'active' : ''}`}
            onClick={() => toggleIndicator(item.key as keyof typeof visible)}
            disabled={loading}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 状态提示 */}
      {loading && <div className="kline-status kline-loading">正在加载 K 线数据...</div>}
      {error && (
        <div className="kline-status kline-error">
          <span>{error}</span>
          <button className="kline-retry-btn" onClick={loadKline} disabled={loading}>
            {loading ? '加载中...' : '重试'}
          </button>
        </div>
      )}

      {/* 图表区域 */}
      <div className="kline-chart-wrapper">
        {klineData.length > 0 ? (
          <KLineChartView data={klineData} indicators={indicators} visible={visible} />
        ) : (
          !loading && <div className="kline-empty">暂无数据，请搜索股票或切换周期后重试</div>
        )}
      </div>
    </div>
  )
}

export default KLineChart
