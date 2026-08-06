/**
 * 市场快讯页面
 *
 * 重构后：useNewsFeed 封装分页+auto-refresh；KeywordConfigModal 封装弹窗状态；
 * useAsyncResource 封装 sources/keywords 加载；useModal 替换 modal open 状态。
 *
 * 仍留在本页的：filter 输入（source/keywordInput/activeKeyword/onlyImportant）、
 * 展开的卡片 id 集合、IntersectionObserver 哨兵。
 */
import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getNewsSources, getNewsKeywords } from '../api/news'
import type { NewsSource } from '../types'
import { useAsyncResource, useModal } from '../hooks'
import { useIntersectionObserver } from '../hooks'
import { useNewsFeed } from '../features/news/hooks/useNewsFeed'
import { KeywordConfigModal } from '../features/news/components/KeywordConfigModal'
import { TableSkeleton } from '../components/TableSkeleton'
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
  // ===== 筛选条件（页面 UI 输入） =====
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [keywordInput, setKeywordInput] = useState('')
  // 实际生效的搜索关键词（点击搜索或回车后写入）
  const [activeKeyword, setActiveKeyword] = useState('')
  const [onlyImportant, setOnlyImportant] = useState(false)

  // ===== 展开的快讯 id 集合 =====
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  // ===== Sources & Configured Keywords =====
  // sources：API 返回非空才覆盖默认值
  const sources = useAsyncResource<NewsSource[]>(
    async () => {
      try {
        const res = await getNewsSources()
        if (Array.isArray(res) && res.length > 0) return res
      } catch {
        /* 静默失败，沿用默认 */
      }
      return DEFAULT_SOURCE_OPTIONS
    },
    [],
    { initialData: DEFAULT_SOURCE_OPTIONS },
  )

  const configuredKeywords = useAsyncResource<string[]>(
    async () => {
      try {
        const res = await getNewsKeywords()
        if (res?.keywords) return res.keywords
      } catch {
        /* 静默失败 */
      }
      return []
    },
    [],
    { initialData: [] as string[] },
  )

  // ===== 快讯列表（封装分页 + 自动刷新 + 手动刷新） =====
  const feed = useNewsFeed(
    { source: sourceFilter, keyword: activeKeyword },
    { pageSize: 30, autoRefreshMs: 60_000 },
  )

  // ===== 关键词配置 modal =====
  const keywordModal = useModal<void>()

  // 触底加载的哨兵 ref
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // 触底加载：用通用 IntersectionObserver hook
  useIntersectionObserver(
    sentinelRef,
    () => void feed.loadMore(),
    { rootMargin: '200px' },
  )

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

  // 用于高亮的关键词集合：配置关键词 + 搜索关键词
  const highlightKeywords = useMemo(() => {
    const set = new Set<string>(configuredKeywords.data ?? [])
    if (activeKeyword) set.add(activeKeyword)
    return Array.from(set)
  }, [configuredKeywords.data, activeKeyword])

  // 经过"仅看重磅"过滤后的列表（前端再过滤一层以保证视觉效果）
  const displayedItems = useMemo(() => {
    // 后端返回已按时间倒序，这里仅做重磅过滤
    if (!onlyImportant) return feed.items
    return feed.items.filter((n) => n.is_important)
  }, [feed.items, onlyImportant])

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
            {(sources.data ?? DEFAULT_SOURCE_OPTIONS).map((s) => (
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
          onClick={() => void feed.refresh()}
          disabled={feed.refreshing}
        >
          {feed.refreshing ? '抓取中...' : '刷新'}
        </button>
        <button className="btn btn-primary" onClick={() => keywordModal.open()}>
          关键词设置
        </button>
      </div>

      {/* 状态展示区 */}
      {feed.error && (
        <div className="error-message">
          <span>{feed.error}</span>
          <button className="btn-link" onClick={() => void feed.refresh()}>
            重试
          </button>
        </div>
      )}

      {feed.loading ? (
        // 卡片骨架：模拟真实 card 形状（header + title + content + meta）
        <div className="news-list">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="news-card news-card-skeleton">
              <div className="news-card-header">
                <TableSkeleton rows={1} columns={3} />
              </div>
              <div className="news-card-title">
                <TableSkeleton rows={1} columns={1} />
              </div>
              <div className="news-card-content">
                <TableSkeleton rows={2} columns={1} />
              </div>
            </div>
          ))}
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
            共 {feed.total} 条{activeKeyword ? ` · 关键词：${activeKeyword}` : ''}
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
            {feed.loadingMore && <div className="news-loading-more">加载更多中...</div>}
            {!feed.hasMore && displayedItems.length > 0 && (
              <div className="news-no-more">— 已加载全部 —</div>
            )}
          </div>
        </>
      )}

      {/* 关键词设置弹窗（自管状态） */}
      <KeywordConfigModal
        visible={keywordModal.visible}
        initialKeywords={configuredKeywords.data ?? []}
        onClose={keywordModal.close}
        onSaved={(next) => configuredKeywords.setData(next)}
      />
    </div>
  )
}

export default News