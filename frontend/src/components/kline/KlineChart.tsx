import { useState, useRef, useEffect, useMemo } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  HistogramData,
  Time,
} from "lightweight-charts";
import type { KlineDataItem } from "@/types/kline";
import { formatMoney, formatNumber } from "@/utils/format";

interface KlineChartProps {
  data: KlineDataItem[];
  showMA?: boolean;
  showMACD?: boolean;
  showKDJ?: boolean;
}

export function KlineChart({
  data,
  showMA = true,
  showMACD = true,
  showKDJ = true,
}: KlineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [crosshairData, setCrosshairData] = useState<KlineDataItem | null>(null);

  const candleData = useMemo<CandlestickData<Time>[]>(() => {
    return data.map((item) => ({
      time: item.time as Time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }));
  }, [data]);

  const volumeData = useMemo<HistogramData<Time>[]>(() => {
    return data.map((item) => ({
      time: item.time as Time,
      value: item.volume,
      color:
        item.close >= item.open
          ? "rgba(239, 68, 68, 0.5)"
          : "rgba(34, 197, 94, 0.5)",
    }));
  }, [data]);

  const ma5Data = useMemo<LineData<Time>[]>(() => {
    return data
      .filter((d) => d.ma5 !== null && d.ma5 !== undefined)
      .map((item) => ({
        time: item.time as Time,
        value: item.ma5 as number,
      }));
  }, [data]);

  const ma10Data = useMemo<LineData<Time>[]>(() => {
    return data
      .filter((d) => d.ma10 !== null && d.ma10 !== undefined)
      .map((item) => ({
        time: item.time as Time,
        value: item.ma10 as number,
      }));
  }, [data]);

  const ma20Data = useMemo<LineData<Time>[]>(() => {
    return data
      .filter((d) => d.ma20 !== null && d.ma20 !== undefined)
      .map((item) => ({
        time: item.time as Time,
        value: item.ma20 as number,
      }));
  }, [data]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#ffffff" },
        textColor: "#64748b",
      },
      grid: {
        vertLines: { color: "#f1f5f9" },
        horzLines: { color: "#f1f5f9" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#94a3b8",
          width: 1,
          style: 2,
        },
        horzLine: {
          color: "#94a3b8",
          width: 1,
          style: 2,
        },
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
      },
      timeScale: {
        borderColor: "#e2e8f0",
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#ef4444",
      downColor: "#22c55e",
      borderUpColor: "#ef4444",
      borderDownColor: "#22c55e",
      wickUpColor: "#ef4444",
      wickDownColor: "#22c55e",
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#94a3b8",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "volume",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);

    if (showMA) {
      const ma5Series = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ma5Series.setData(ma5Data);

      const ma10Series = chart.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ma10Series.setData(ma10Data);

      const ma20Series = chart.addSeries(LineSeries, {
        color: "#a855f7",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ma20Series.setData(ma20Data);
    }

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setCrosshairData(null);
        return;
      }
      const index = data.findIndex((d) => d.time === param.time);
      if (index >= 0) {
        setCrosshairData(data[index]);
      }
    });

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    candleSeriesRef.current.setData(candleData);
    chartRef.current.timeScale().fitContent();
  }, [candleData]);

  const latestData =
    crosshairData || (data.length > 0 ? data[data.length - 1] : null);

  return (
    <div className="space-y-4">
      {latestData && (
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-slate-400">开盘：</span>
            <span className="font-medium text-slate-700">
              {formatNumber(latestData.open, 2)}
            </span>
          </div>
          <div>
            <span className="text-slate-400">最高：</span>
            <span className="font-medium text-rise">
              {formatNumber(latestData.high, 2)}
            </span>
          </div>
          <div>
            <span className="text-slate-400">最低：</span>
            <span className="font-medium text-fall">
              {formatNumber(latestData.low, 2)}
            </span>
          </div>
          <div>
            <span className="text-slate-400">收盘：</span>
            <span
              className={`font-medium ${
                latestData.close >= latestData.open ? "text-rise" : "text-fall"
              }`}
            >
              {formatNumber(latestData.close, 2)}
            </span>
          </div>
          <div>
            <span className="text-slate-400">成交量：</span>
            <span className="font-medium text-slate-700">
              {formatMoney(latestData.volume, 0)}
            </span>
          </div>
          {latestData.ma5 !== null && latestData.ma5 !== undefined && (
            <div>
              <span className="text-amber-500">MA5：</span>
              <span className="font-medium text-slate-700">
                {formatNumber(latestData.ma5, 2)}
              </span>
            </div>
          )}
          {latestData.ma10 !== null && latestData.ma10 !== undefined && (
            <div>
              <span className="text-blue-500">MA10：</span>
              <span className="font-medium text-slate-700">
                {formatNumber(latestData.ma10, 2)}
              </span>
            </div>
          )}
          {latestData.ma20 !== null && latestData.ma20 !== undefined && (
            <div>
              <span className="text-purple-500">MA20：</span>
              <span className="font-medium text-slate-700">
                {formatNumber(latestData.ma20, 2)}
              </span>
            </div>
          )}
        </div>
      )}
      <div
        ref={chartContainerRef}
        className="w-full h-96 rounded-lg border border-border overflow-hidden"
      />
    </div>
  );
}
