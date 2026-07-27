import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { PlatformCompareItem } from "@/types/dashboard";
import { getChangeColor } from "@/utils/color";

interface PlatformCompareChartProps {
  data: PlatformCompareItem[];
}

export function PlatformCompareChart({ data }: PlatformCompareChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params: any) => {
          const item = params[0];
          const dataItem = data[item.dataIndex];
          return `
            <div style="font-weight:600;margin-bottom:4px">${dataItem.platform_name}</div>
            <div>总资产: ${dataItem.total_asset.toLocaleString()}</div>
            <div>总收益: ${dataItem.total_profit >= 0 ? "+" : ""}${dataItem.total_profit.toLocaleString()}</div>
            <div>收益率: ${dataItem.profit_rate >= 0 ? "+" : ""}${dataItem.profit_rate.toFixed(2)}%</div>
          `;
        },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        top: "10%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: data.map((item) => item.platform_name),
        axisLabel: {
          fontSize: 12,
          color: "#64748b",
        },
        axisLine: {
          lineStyle: {
            color: "#e2e8f0",
          },
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          fontSize: 12,
          color: "#64748b",
        },
        splitLine: {
          lineStyle: {
            color: "#f1f5f9",
          },
        },
      },
      series: [
        {
          type: "bar",
          barWidth: "40%",
          data: data.map((item) => ({
            value: item.total_asset,
            itemStyle: {
              color: item.total_profit >= 0 ? "#3b82f6" : "#94a3b8",
              borderRadius: [4, 4, 0, 0],
            },
          })),
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [data]);

  return (
    <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800 mb-4">平台收益对比</h3>
      <div ref={chartRef} className="w-full h-64" />
    </div>
  );
}
