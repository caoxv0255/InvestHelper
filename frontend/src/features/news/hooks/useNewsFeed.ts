/**
 * useNewsFeed — 快讯列表领域 hook
 *
 * 封装分页 + 自动刷新 + 手动刷新 + 触底加载的复杂状态机。
 * 使用方只需传 source/keyword 过滤器，得到 { items, total, loading, loadingMore,
 * refreshing, error, hasMore, loadMore, refresh }。
 *
 * IntersectionObserver 仍由使用方管理（需要 DOM ref 触发 loadMore）。
 */
import { useCallback, useEffect, useState } from 'react'
import { getNews, refreshNews } from '../../../api/news'
import type { NewsItem } from '../../../types'

export interface NewsFeedFilters {
  source: string
  keyword: string
}

export interface NewsFeedOptions {
  /** 单页条数，默认 30 */
  pageSize?: number
  /** 自动刷新间隔（毫秒），0 表示禁用，默认 60s */
  autoRefreshMs?: number
}

export interface NewsFeedState {
  items: NewsItem[]
  total: number
  /** 首页加载中（loading 闪屏） */
  loading: boolean
  /** 加载更多中 */
  loadingMore: boolean
  /** 手动刷新抓取中（不触发 loading 闪屏） */
  refreshing: boolean
  error: string | null
  hasMore: boolean
  /** 触底加载：调用一次拉取下一页 */
  loadMore: () => Promise<void>
  /** 手动刷新：触发后端抓取 + 重新拉首页 */
  refresh: () => Promise<void>
}

export function useNewsFeed(
  filters: NewsFeedFilters,
  options: NewsFeedOptions = {},
): NewsFeedState {
  const { pageSize = 30, autoRefreshMs = 60_000 } = options
  const { source, keyword } = filters

  const [items, setItems] = useState<NewsItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  // page 暂存以便 loadMore 知道下一页位置；外部不直接读
  const [page, setPage] = useState(1)

  const fetchFirstPage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getNews(pageSize, source || undefined, keyword || undefined)
      const newItems = res?.items ?? []
      const newTotal = res?.total ?? newItems.length
      setItems(newItems)
      setTotal(newTotal)
      setPage(1)
      setHasMore(newItems.length < newTotal)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载快讯失败'
      setError(message)
      setItems([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [pageSize, source, keyword])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      // 当前 API 没有分页参数，惯例是拉 limit 条然后取前 nextPage*pageSize
      const limit = pageSize * nextPage
      const res = await getNews(limit, source || undefined, keyword || undefined)
      const newItems = res?.items ?? []
      const newTotal = res?.total ?? newItems.length
      setItems(newItems)
      setTotal(newTotal)
      setPage(nextPage)
      setHasMore(newItems.length < newTotal)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载更多失败'
      setError(message)
    } finally {
      setLoadingMore(false)
    }
  }, [page, hasMore, loadingMore, pageSize, source, keyword])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      await refreshNews()
      await fetchFirstPage()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '触发抓取失败'
      setError(message)
    } finally {
      setRefreshing(false)
    }
  }, [fetchFirstPage])

  // 初始 + 筛选条件变化时拉首页
  useEffect(() => {
    void fetchFirstPage()
  }, [fetchFirstPage])

  // 自动静默刷新：仅更新 items/total/hasMore，不动 loading / page
  useEffect(() => {
    if (!autoRefreshMs) return
    const timer = setInterval(() => {
      void getNews(pageSize, source || undefined, keyword || undefined)
        .then((res) => {
          const newItems = res?.items ?? []
          const newTotal = res?.total ?? newItems.length
          setItems(newItems)
          setTotal(newTotal)
          setHasMore(newItems.length < newTotal)
        })
        .catch(() => {
          /* 静默失败 */
        })
    }, autoRefreshMs)
    return () => clearInterval(timer)
  }, [autoRefreshMs, pageSize, source, keyword])

  return { items, total, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh }
}