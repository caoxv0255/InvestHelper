/**
 * buildCorrelationOption — 相关性矩阵热力图 echarts option builder
 *
 * 纯函数：输入 data，输出 echarts option（或 null 表示数据不足）。
 * 至少需要 2 只标的才有意义。
 */
import type { RiskAnalysisResult } from '../../../types'

export function buildCorrelationOption(data: RiskAnalysisResult | null) {
  if (!data || data.correlation_matrix.codes.length < 2) {
    return null
  }
  const { codes, correlations } = data.correlation_matrix
  const heatmapData: [number, number, number][] = []
  for (let i = 0; i < codes.length; i++) {
    for (let j = 0; j < codes.length; j++) {
      heatmapData.push([j, i, correlations[i][j]])
    }
  }

  return {
    tooltip: {
      position: 'top',
      formatter: (params: any) => {
        const x = codes[params.value[0]]
        const y = codes[params.value[1]]
        const v = params.value[2]
        return `${x} / ${y}<br/>相关系数: ${v.toFixed(3)}`
      },
    },
    grid: {
      left: '12%',
      right: '8%',
      bottom: '12%',
      top: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: codes,
      splitArea: { show: true },
      axisLabel: {
        color: '#666',
        fontSize: 11,
        rotate: 45,
      },
    },
    yAxis: {
      type: 'category',
      data: codes,
      splitArea: { show: true },
      axisLabel: {
        color: '#666',
        fontSize: 11,
      },
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      inRange: {
        color: ['#22c55e', '#ffffff', '#ef4444'],
      },
      text: ['高相关', '低相关'],
      textStyle: { color: '#666' },
    },
    series: [
      {
        name: '相关系数',
        type: 'heatmap',
        data: heatmapData,
        label: {
          show: true,
          formatter: (p: any) => p.value[2].toFixed(2),
          fontSize: 10,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  }
}