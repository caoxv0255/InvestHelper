/**
 * TableSkeleton — 通用 table 加载占位
 *
 * 用 N 行 × M 列的灰色块模拟真实表格的形状，
 * 让用户在数据到达前感知"列表即将出现"。
 *
 * 适用：
 *   - HoldingTable / DepositTable / HistorySection / OpportunitiesTable 等
 *   - 任何 `loading=true && data.length===0` 的场景
 *
 * 不适用：
 *   - 已有数据 + 仅增量加载（用局部 skeleton 或 keep-existing 模式）
 */
export interface TableSkeletonProps {
  rows?: number
  columns?: number
}

export const TableSkeleton = ({
  rows = 5,
  columns = 10,
}: TableSkeletonProps) => {
  // 用稳定的 column widths（不每次 render 抖），避免 shimmer 看起来"在跳"
  const widths = Array.from(
    { length: columns },
    (_, i) => `${60 + ((i * 13) % 35)}%`,
  )

  return (
    <div className="table-skeleton" role="status" aria-label="加载中">
      {Array.from({ length: rows }, (_, rowIdx) => (
        <div key={rowIdx} className="skeleton-row">
          {widths.map((w, colIdx) => (
            <div
              key={colIdx}
              className="skeleton-cell"
              style={{ width: w }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
