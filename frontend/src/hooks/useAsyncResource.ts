/**
 * useAsyncResource — 通用异步数据 hook
 *
 * 替换页面里反复出现的 { data, loading, error, refetch } 四元组模式。
 * fetcher 依赖外部参数时，把这些参数放入 deps 数组（与 useEffect 用法一致）。
 *
 * 示例：
 *   const { data: holdings, loading, error, refetch } = useAsyncResource(
 *     () => getHoldings(filter),
 *     [filter],
 *     { initialData: [] as Holding[] },
 *   )
 */
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

export interface AsyncResource<T> {
  /** 已加载的数据；未传 initialData 时为 undefined */
  data: T | undefined
  loading: boolean
  /** 字符串化的错误信息；null 表示无错 */
  error: string | null
  refetch: () => Promise<void>
  /** 手动覆盖 data（用于乐观更新等场景） */
  setData: (value: T | ((prev: T | undefined) => T)) => void
}

export interface UseAsyncResourceOptions<T> {
  initialData?: T
  /** true 时不触发请求也不写 error；用于 tab 切换时仅激活对应资源 */
  skip?: boolean
  /** 错误回调（fetch 异常时调用一次，error 字段已自动写入） */
  onError?: (error: Error) => void
}

// 重载：传 initialData 时 data 类型为 T（不需要判空）
export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options: { initialData: T; skip?: boolean; onError?: (error: Error) => void },
): AsyncResource<T>
export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options?: { initialData?: undefined; skip?: boolean; onError?: (error: Error) => void },
): AsyncResource<T | undefined>
export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options: UseAsyncResourceOptions<T> = {},
): AsyncResource<T | undefined> {
  const { initialData, skip = false, onError } = options
  const [data, setData] = useState<T | undefined>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 用 ref 保存最新 fetcher 与 onError，避免它们变化时触发 refetch
  const fetcherRef = useRef(fetcher)
  const onErrorRef = useRef(onError)
  fetcherRef.current = fetcher
  onErrorRef.current = onError

  const fetchOnce = useCallback(async () => {
    if (skip) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetcherRef.current()
      setData(result)
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      setError(err.message || '加载失败')
      onErrorRef.current?.(err)
    } finally {
      setLoading(false)
    }
  }, [skip])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchOnce()
  }, deps)

  return { data, loading, error, refetch: fetchOnce, setData }
}