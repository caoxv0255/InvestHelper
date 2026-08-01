import { useEffect, useRef, memo } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts'
import type { KLineData, IndicatorData } from '../types'

interface KLineChartViewProps {
  /** K线原始数据 */
  data: KLineData[]
  /** 指标数据集 */
  indicators: IndicatorData
  /** 指标可见性 */
  visible: {
    ma: boolean
    macd: boolean
    kdj: boolean
    volume: boolean
  }
  /** 主题色配置 */
  theme?: {
    background: string
    grid: string
    text: string
    upColor: string
    downColor: string
  }
}

/**
 * 专业 K 线图表视图
 * 使用 lightweight-charts 渲染多指标金融图表
 */
const KLineChartView = memo<KLineChartViewProps>(
  ({
    data,
    indicators,
    visible,
    theme = {
      background: '#0f172a',
      grid: '#1e293b',
      text: '#94a3b8',
      upColor: '#ef4444',
      downColor: '#22c55e',
    },
  }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const seriesRef = useRef<{
      candle: ISeriesApi<'Candlestick'> | null
      ma5: ISeriesApi<'Line'> | null
      ma10: ISeriesApi<'Line'> | null
      ma20: ISeriesApi<'Line'> | null
      volume: ISeriesApi<'Histogram'> | null
      macdHistogram: ISeriesApi<'Histogram'> | null
      dif: ISeriesApi<'Line'> | null
      dea: ISeriesApi<'Line'> | null
      k: ISeriesApi<'Line'> | null
      d: ISeriesApi<'Line'> | null
      j: ISeriesApi<'Line'> | null
    }>({
      candle: null,
      ma5: null,
      ma10: null,
      ma20: null,
      volume: null,
      macdHistogram: null,
      dif: null,
      dea: null,
      k: null,
      d: null,
      j: null,
    })

    // 初始化图表
    useEffect(() => {
      if (!containerRef.current) return

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: theme.background },
          textColor: theme.text,
        },
        grid: {
          vertLines: { color: theme.grid },
          horzLines: { color: theme.grid },
        },
        crosshair: {
          mode: CrosshairMode.Magnet,
          vertLine: {
            color: '#475569',
            width: 1,
            style: 2,
            labelBackgroundColor: '#475569',
          },
          horzLine: {
            color: '#475569',
            width: 1,
            style: 2,
            labelBackgroundColor: '#475569',
          },
        },
        rightPriceScale: {
          borderColor: theme.grid,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        timeScale: {
          borderColor: theme.grid,
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: {
          vertTouchDrag: false,
        },
      })

      chartRef.current = chart

      // 主图：K线
      const candle = chart.addSeries(CandlestickSeries, {
        upColor: theme.upColor,
        downColor: theme.downColor,
        borderUpColor: theme.upColor,
        borderDownColor: theme.downColor,
        wickUpColor: theme.upColor,
        wickDownColor: theme.downColor,
        lastValueVisible: false,
      })
      seriesRef.current.candle = candle

      // 主图：MA 均线
      seriesRef.current.ma5 = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1,
        title: 'MA5',
        lastValueVisible: false,
      })
      seriesRef.current.ma10 = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 1,
        title: 'MA10',
        lastValueVisible: false,
      })
      seriesRef.current.ma20 = chart.addSeries(LineSeries, {
        color: '#a855f7',
        lineWidth: 1,
        title: 'MA20',
        lastValueVisible: false,
      })

      // 创建成交量 pane
      chart.addPane()
      const volume = chart.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: 'volume' },
          priceScaleId: 'left',
          lastValueVisible: false,
        },
        1,
      )
      seriesRef.current.volume = volume

      // 创建 MACD pane
      chart.addPane()
      const macdHistogram = chart.addSeries(
        HistogramSeries,
        {
          priceScaleId: 'left',
          lastValueVisible: false,
        },
        2,
      )
      seriesRef.current.macdHistogram = macdHistogram
      const dif = chart.addSeries(
        LineSeries,
        {
          color: '#f59e0b',
          lineWidth: 1,
          title: 'DIF',
          lastValueVisible: false,
        },
        2,
      )
      seriesRef.current.dif = dif
      const dea = chart.addSeries(
        LineSeries,
        {
          color: '#3b82f6',
          lineWidth: 1,
          title: 'DEA',
          lastValueVisible: false,
        },
        2,
      )
      seriesRef.current.dea = dea

      // 创建 KDJ pane
      chart.addPane()
      const k = chart.addSeries(
        LineSeries,
        {
          color: '#f59e0b',
          lineWidth: 1,
          title: 'K',
          lastValueVisible: false,
        },
        3,
      )
      seriesRef.current.k = k
      const d = chart.addSeries(
        LineSeries,
        {
          color: '#3b82f6',
          lineWidth: 1,
          title: 'D',
          lastValueVisible: false,
        },
        3,
      )
      seriesRef.current.d = d
      const j = chart.addSeries(
        LineSeries,
        {
          color: '#ec4899',
          lineWidth: 1,
          title: 'J',
          lastValueVisible: false,
        },
        3,
      )
      seriesRef.current.j = j

      // 自适应容器大小
      const handleResize = () => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          })
        }
      }
      const resizeObserver = new ResizeObserver(handleResize)
      resizeObserver.observe(containerRef.current)
      handleResize()

      return () => {
        resizeObserver.disconnect()
        chart.remove()
        chartRef.current = null
      }
    }, [theme.background, theme.grid, theme.text, theme.upColor, theme.downColor])

    // 更新数据
    useEffect(() => {
      const chart = chartRef.current
      if (!chart) return

      const { candle, ma5, ma10, ma20, volume, macdHistogram, dif, dea, k, d, j } = seriesRef.current
      if (!candle || !ma5 || !ma10 || !ma20 || !volume || !macdHistogram || !dif || !dea || !k || !d || !j) return

      // K线数据
      const candleData = data.map((item) => ({
        time: item.date as Time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }))
      candle.setData(candleData)

      // 均线
      ma5.setData(indicators.ma5.map((item) => ({ time: item.time as Time, value: item.value })))
      ma10.setData(indicators.ma10.map((item) => ({ time: item.time as Time, value: item.value })))
      ma20.setData(indicators.ma20.map((item) => ({ time: item.time as Time, value: item.value })))

      // 成交量
      volume.setData(indicators.volume.map((item) => ({ time: item.time as Time, value: item.value, color: item.color })))

      // MACD
      macdHistogram.setData(
        indicators.macd.map((item) => ({
          time: item.time as Time,
          value: item.histogram,
          color: item.histogram >= 0 ? theme.upColor : theme.downColor,
        })),
      )
      dif.setData(indicators.macd.map((item) => ({ time: item.time as Time, value: item.dif })))
      dea.setData(indicators.macd.map((item) => ({ time: item.time as Time, value: item.dea })))

      // KDJ
      k.setData(indicators.kdj.map((item) => ({ time: item.time as Time, value: item.k })))
      d.setData(indicators.kdj.map((item) => ({ time: item.time as Time, value: item.d })))
      j.setData(indicators.kdj.map((item) => ({ time: item.time as Time, value: item.j })))

      chart.timeScale().fitContent()
    }, [data, indicators, theme.upColor, theme.downColor])

    // 控制指标显示/隐藏
    useEffect(() => {
      const { ma5, ma10, ma20, volume, macdHistogram, dif, dea, k, d, j } = seriesRef.current
      ma5?.applyOptions({ visible: visible.ma })
      ma10?.applyOptions({ visible: visible.ma })
      ma20?.applyOptions({ visible: visible.ma })
      volume?.applyOptions({ visible: visible.volume })
      macdHistogram?.applyOptions({ visible: visible.macd })
      dif?.applyOptions({ visible: visible.macd })
      dea?.applyOptions({ visible: visible.macd })
      k?.applyOptions({ visible: visible.kdj })
      d?.applyOptions({ visible: visible.kdj })
      j?.applyOptions({ visible: visible.kdj })
    }, [visible])

    return <div ref={containerRef} className="kline-chart-view" />
  },
)

KLineChartView.displayName = 'KLineChartView'

export default KLineChartView
