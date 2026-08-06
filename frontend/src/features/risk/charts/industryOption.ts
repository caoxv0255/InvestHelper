/**
 * buildIndustryOption — 行业集中度横向条形图 echarts option builder
 *
 * 纯函数：输入 data，输出 echarts option（或 null 表示无数据）。
 * RiskAnalysisPage 用 useMemo(data) 包一层调用。
 */
import type { RiskAnalysisResult } from '../../../types'

export function buildIndustryOption(data: RiskAnalysisResult | null) {
  if (!data || data.industry_concentration.length === 0) {
    return null
  }
  const sorted = [...data.industry_concentration].sort((a, b) => a.weight - b.weight)
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const item = params[0]
        return `${item.name}<br/>权重: ${(item.value * 100).toFixed(2)}%`
      },
    },
    grid: {
      left: '3%',
      right: '8%',
      bottom: '3%',
      top: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      max: 1,
      axisLabel: {
        formatter: (value: number) => `${(value * 100).toFixed(0)}%`,
        color: '#999',
      },
      splitLine: {
        lineStyle: { color: '#f0f0f0' },
      },
    },
    yAxis: {
      type: 'category',
      data: sorted.map((item) => item.industry),
      axisLabel: {
        color: '#666',
        fontSize: 12,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: '权重',
        type: 'bar',
        data: sorted.map((item) => ({
          value: item.weight,
          itemStyle: {
            color:
              item.weight > 0.5
                ? '#ef4444'
                : item.weight > 0.3
                  ? '#f97316'
                  : '#667eea',
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: 20,
        label: {
          show: true,
          position: 'right',
          formatter: (p: any) => `${(p.value * 100).toFixed(1)}%`,
          color: '#666',
          fontSize: 11,
        },
      },
    ],
  }
}