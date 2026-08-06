/**
 * buildFactorRadarOption — 因子暴露雷达图 echarts option builder
 *
 * 纯函数：输入 data，输出 echarts option（或 null 表示无数据）。
 */
import type { RiskAnalysisResult } from '../../../types'

export function buildFactorRadarOption(data: RiskAnalysisResult | null) {
  if (!data || data.factor_radar.length === 0) {
    return null
  }
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const rows = data.factor_radar.map(
          (item, index) => `${item.indicator}: ${(params.value[index] * 100).toFixed(0)}%`,
        )
        return `${params.name}<br/>${rows.join('<br/>')}`
      },
    },
    radar: {
      indicator: data.factor_radar.map((item) => ({ name: item.indicator, max: 1 })),
      radius: '65%',
      splitNumber: 4,
      axisName: {
        color: '#666',
        fontSize: 12,
      },
      splitLine: {
        lineStyle: { color: '#e5e7eb' },
      },
      splitArea: {
        areaStyle: { color: ['#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db'] },
      },
    },
    series: [
      {
        name: '因子暴露',
        type: 'radar',
        data: [
          {
            value: data.factor_radar.map((item) => item.value),
            name: '组合风险暴露',
            areaStyle: {
              color: 'rgba(102, 126, 234, 0.25)',
            },
            lineStyle: {
              color: '#667eea',
              width: 2,
            },
            itemStyle: {
              color: '#667eea',
            },
          },
        ],
      },
    ],
  }
}