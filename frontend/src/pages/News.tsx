import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  getNews,
  refreshNews,
  getNewsSources,
  getNewsKeywords,
  updateNewsKeywords,
} from '../api/news'
import type { NewsItem, NewsSource } from '../types'
import '../styles/News.css'

// 来源字段值 -> 中文展示名
const SOURCE_NAME_MAP: Record<string, string> = {
  eastmoney: '东方财富',
  ths: '同花顺',
  sina: '新浪财经',
}

// 来源下拉选项（固定 + 接口动态补充）
const DEFAULT_SOURCE_OPTIONS: { id: string; name: string }[] = [
  { id: 'eastmoney', name: '东方财富' },
  { id: 'ths', name: '同花顺' },
  { id: 'sina', name: '新浪财经' },
]

// 自动刷新间隔（毫秒）
const AUTO_REFRESH_INTERVAL = 60 * 1000
// 单页加载条数
const PAGE_SIZE = 30

/**
 * 将文本按关键词高亮渲染（大小写不敏感）
 * 返回 React 节点数组，匹配的关键词用 <mark> 包裹
 */
const renderHighlighted = (
  text: string,
  keywords: string[],
): ReactNode[] => {
  if (!text) return []
  // 过滤掉空字符串
  const kws = keywords.filter((k) => k && k.trim().length > 0)
  if (kws.length === 0) return [text]

  // 转义正则特殊字符
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = kws.map(escapeRegExp).join('|')
  const regex = new RegExp(`(${pattern})`, 'gi')

  const result: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    // 前置普通文本
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index))
    }
    // 命中关键词
    result.push(
      <mark className="news-keyword-mark" key={`kw-${key++}`}>
        {match[0]}
      </mark>,
    )
    lastIndex = match.index + match[0].length
    // 防止零宽匹配死循环
    if (match[0].length === 0) regex.lastIndex++
  }
  // 尾部普通文本
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex))
  }
  return result
}

// 格式化时间为 yyyy-MM-dd HH:mm
const formatTime = (iso: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const News = () => {
  // ===== 列表数据 =====
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ===== 筛选条件 =====
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [keywordInput, setKeywordInput] = useState('')
  // 实际生效的搜索关键词（点击搜索或回车后写入）
  const [activeKeyword, setActiveKeyword] = useState('')
  const [onlyImportant, setOnlyImportant] = useState(false)

  // ===== 分页 =====
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // ===== 来源列表 =====
  const [sources, setSources] = useState<NewsSource[]>(DEFAULT_SOURCE_OPTIONS)

  // ===== 关键词配置 =====
  const [configuredKeywords, setConfiguredKeywords] = useState<string[]>([])
  const [keywordModalOpen, setKeywordModalOpen] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [modalKeywords, setModalKeywords] = useState<string[]>([])
  const [savingKeywords, setSavingKeywords] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // ===== 展开的快讯 id 集合 =====
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  // 触底加载的哨兵 ref
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // 合并来源（接口返回优先，兜底默认）
  useEffect(() => {
    let mounted = true
    getNewsSources()
      .then((res) => {
        if (!mounted) return
        if (Array.isArray(res) && res.length > 0) setSources(res)
      })
      .catch(() => {
        // 静默失败，沿用默认来源
      })
    return () => {
      mounted = false
    }
  }, [])

  // 拉取关键词配置
  useEffect(() => {
    let mounted = true
    getNewsKeywords()
      .then((res) => {
        if (!mounted) return
        if (res?.keywords) setConfiguredKeywords(res.keywords)
      })
      .catch(() => {
        // 静默失败
      })
    return () => {
      mounted = false
    }
  }, [])

  // 首次拉取快讯列表
  const fetchFirstPage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getNews(PAGE_SIZE, sourceFilter || undefined, activeKeyword || undefined)
      const items = res?.items ?? []
      setNewsItems(items)
      setTotal(res?.total ?? items.length)
      setPage(1)
      setHasMore(items.length < (res?.total ?? items.length))
    } catch (err: any) {
      setError(err?.message || '加载快讯失败')
      setNewsItems([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [sourceFilter, activeKeyword])

  // 加载更多
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const limit = PAGE_SIZE * nextPage
      const res = await getNews(limit, sourceFilter || undefined, activeKeyword || undefined)
      const items = res?.items ?? []
      setNewsItems(items)
      setTotal(res?.total ?? items.length)
      setPage(nextPage)
      setHasMore(items.length < (res?.total ?? items.length))
    } catch (err: any) {
      setError(err?.message || '加载更多失败')
    } finally {
      setLoadingMore(false)
    }
  }, [page, hasMore, loadingMore, sourceFilter, activeKeyword])

  // 初始 + 筛选条件变化时拉取
  useEffect(() => {
    fetchFirstPage()
  }, [fetchFirstPage])

  // 自动刷新：每 60s 静默拉取首页（不触发 loading 闪屏）
  useEffect(() => {
    const timer = setInterval(() => {
      getNews(PAGE_SIZE, sourceFilter || undefined, activeKeyword || undefined)
        .then((res) => {
          const items = res?.items ?? []
          setNewsItems(items)
          setTotal(res?.total ?? items.length)
          setHasMore(items.length < (res?.total ?? items.length))
        })
        .catch(() => {
          // 静默失败，不打扰用户
        })
    }, AUTO_REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [sourceFilter, activeKeyword])

  // 触底加载：IntersectionObserver
  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [loadMore])

  // 手动刷新（触发后端抓取 + 重新拉取首页）
  const handleManualRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      await refreshNews()
      await fetchFirstPage()
    } catch (err: any) {
      setError(err?.message || '触发抓取失败')
    } finally {
      setRefreshing(false)
    }
  }

  // 关键词搜索：回车触发
  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setActiveKeyword(keywordInput.trim())
    }
  }

  // 切换展开/收起
  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 打开关键词设置弹窗
  const openKeywordModal = () => {
    setModalKeywords([...configuredKeywords])
    setNewKeyword('')
    setModalError(null)
    setKeywordModalOpen(true)
  }

  // 弹窗中回车添加关键词
  const handleModalKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addModalKeyword()
    }
  }

  // 添加关键词
  const addModalKeyword = () => {
    const kw = newKeyword.trim()
    if (!kw) return
    if (modalKeywords.includes(kw)) {
      setNewKeyword('')
      return
    }
    setModalKeywords([...modalKeywords, kw])
    setNewKeyword('')
  }

  // 删除关键词
  const removeModalKeyword = (kw: string) => {
    setModalKeywords(modalKeywords.filter((k) => k !== kw))
  }

  // 保存关键词配置
  const handleSaveKeywords = async () => {
    setSavingKeywords(true)
    setModalError(null)
    try {
      const res = await updateNewsKeywords(modalKeywords)
      setConfiguredKeywords(res?.keywords ?? modalKeywords)
      setKeywordModalOpen(false)
    } catch (err: any) {
      setModalError(err?.message || '保存关键词失败')
    } finally {
      setSavingKeywords(false)
    }
  }

  // 用于高亮的关键词集合：配置关键词 + 搜索关键词
  const highlightKeywords = useMemo(() => {
    const set = new Set<string>(configuredKeywords)
    if (activeKeyword) set.add(activeKeyword)
    return Array.from(set)
  }, [configuredKeywords, activeKeyword])

  // 经过"仅看重磅"过滤后的列表（前端再过滤一层以保证视觉效果）
  const displayedItems = useMemo(() => {
    // 后端返回已按时间倒序，这里仅做重磅过滤
    if (!onlyImportant) return newsItems
    return newsItems.filter((n) => n.is_important)
  }, [newsItems, onlyImportant])

  return (
    <div className="page-container news-page">
      <h1 className="page-title">市场快讯</h1>

      {/* 顶部工具栏 */}
      <div className="news-toolbar">
        <div className="filter-group">
          <label className="filter-label">来源</label>
          <select
            className="filter-select"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">全部</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group news-search-group">
          <input
            type="text"
            className="form-input news-search-input"
            placeholder="搜索关键词..."
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={handleKeywordKeyDown}
          />
          <button
            className="btn btn-primary"
            onClick={() => setActiveKeyword(keywordInput.trim())}
          >
            搜索
          </button>
        </div>

        <div className="filter-group">
          <label className="news-switch-label">
            <input
              type="checkbox"
              checked={onlyImportant}
              onChange={(e) => setOnlyImportant(e.target.checked)}
            />
            <span>仅看重磅</span>
          </label>
        </div>

        <div className="filter-spacer" />

        <button
          className="btn btn-secondary"
          onClick={handleManualRefresh}
          disabled={refreshing}
        >
          {refreshing ? '抓取中...' : '刷新'}
        </button>
        <button className="btn btn-primary" onClick={openKeywordModal}>
          关键词设置
        </button>
      </div>

      {/* 状态展示区 */}
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button className="btn-link" onClick={fetchFirstPage}>
            重试
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
          <div>加载快讯中...</div>
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="news-empty">
          <div className="news-empty-icon">📭</div>
          <div className="news-empty-text">暂无快讯数据</div>
          <div className="text-muted">可尝试点击"刷新"触发抓取，或调整筛选条件</div>
        </div>
      ) : (
        <>
          <div className="news-meta">
            共 {total} 条{activeKeyword ? ` · 关键词：${activeKeyword}` : ''}
            {sourceFilter ? ` · 来源：${SOURCE_NAME_MAP[sourceFilter] || sourceFilter}` : ''}
          </div>

          <div className="news-list">
            {displayedItems.map((item) => {
              const expanded = expandedIds.has(item.id)
              const content = item.content || ''
              // 折叠时仅展示前 120 字
              const displayContent = expanded ? content : content.slice(0, 120) + (content.length > 120 ? '...' : '')
              return (
                <div
                  key={item.id}
                  className={`news-card${item.is_important ? ' news-card-important' : ''}`}
                >
                  <div className="news-card-header">
                    <span className={`news-source-tag news-source-${item.source}`}>
                      {SOURCE_NAME_MAP[item.source] || item.source}
                    </span>
                    {item.is_important && (
                      <span className="news-important-badge">重磅</span>
                    )}
                    <span className="news-time">{formatTime(item.publish_time)}</span>
                  </div>

                  <div className="news-card-title">
                    {renderHighlighted(item.title || '', highlightKeywords)}
                  </div>

                  <div
                    className={`news-card-content${expanded ? ' expanded' : ''}`}
                    onClick={() => content.length > 120 && toggleExpand(item.id)}
                    role={content.length > 120 ? 'button' : undefined}
                  >
                    {renderHighlighted(displayContent, highlightKeywords)}
                  </div>

                  {content.length > 120 && (
                    <div
                      className="news-expand-toggle"
                      onClick={() => toggleExpand(item.id)}
                    >
                      {expanded ? '收起 ▲' : '展开全文 ▼'}
                    </div>
                  )}

                  {/* 命中的关键词标签 */}
                  {item.keywords && item.keywords.length > 0 && (
                    <div className="news-keyword-tags">
                      {item.keywords.map((k, idx) => (
                        <span key={`${item.id}-kw-${idx}`} className="news-keyword-tag">
                          {k}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.url && (
                    <a
                      className="news-original-link"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      查看原文 ↗
                    </a>
                  )}
                </div>
              )
            })}
          </div>

          {/* 触底加载哨兵 */}
          <div ref={sentinelRef} className="news-sentinel">
            {loadingMore && <div className="news-loading-more">加载更多中...</div>}
            {!hasMore && displayedItems.length > 0 && (
              <div className="news-no-more">— 已加载全部 —</div>
            )}
          </div>
        </>
      )}

      {/* 关键词设置弹窗 */}
      {keywordModalOpen && (
        <div className="modal-overlay" onClick={() => setKeywordModalOpen(false)}>
          <div
            className="modal-content modal-small"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>关键词设置</h3>
              <button
                className="modal-close"
                onClick={() => setKeywordModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {modalError && (
                <div className="error-message" style={{ marginBottom: '1rem' }}>
                  {modalError}
                </div>
              )}
              <div className="form-group-full">
                <label className="form-label">添加关键词</label>
                <div className="news-keyword-input-row">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="输入关键词后回车添加"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={handleModalKeywordKeyDown}
                  />
                  <button className="btn btn-primary" onClick={addModalKeyword}>
                    添加
                  </button>
                </div>
              </div>

              <div className="form-group-full" style={{ marginTop: '1rem' }}>
                <label className="form-label">
                  已配置关键词（{modalKeywords.length}）
                </label>
                {modalKeywords.length === 0 ? (
                  <div className="text-muted">暂未配置任何关键词</div>
                ) : (
                  <div className="news-keyword-tag-list">
                    {modalKeywords.map((kw) => (
                      <span key={kw} className="news-keyword-tag removable">
                        {kw}
                        <button
                          className="news-keyword-remove"
                          onClick={() => removeModalKeyword(kw)}
                          title="删除"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-muted" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
                配置的关键词将用于快讯内容高亮展示，不影响后端抓取逻辑。
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setKeywordModalOpen(false)}
                disabled={savingKeywords}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveKeywords}
                disabled={savingKeywords}
              >
                {savingKeywords ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default News
