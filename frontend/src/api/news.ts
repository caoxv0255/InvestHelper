import api from './request'
import type {
  NewsListResponse,
  NewsSource,
  NewsKeywordsResponse,
} from '../types'

/**
 * 获取快讯列表
 * @param limit 返回条数上限，默认 50
 * @param source 来源筛选（eastmoney / ths / sina），可选
 * @param keyword 关键词筛选，可选
 */
export const getNews = (
  limit = 50,
  source?: string,
  keyword?: string,
) => {
  const params: Record<string, unknown> = { limit }
  if (source) params.source = source
  if (keyword) params.keyword = keyword
  return api.get<NewsListResponse>('/news', { params })
}

/**
 * 手动触发抓取快讯（后端异步抓取，立即返回抓取结果摘要）
 */
export const refreshNews = () => api.post<{ message: string }>('/news/refresh')

/**
 * 获取已配置的快讯来源列表
 */
export const getNewsSources = () => api.get<NewsSource[]>('/news/sources')

/**
 * 获取关键词配置
 */
export const getNewsKeywords = () =>
  api.get<NewsKeywordsResponse>('/news/keywords')

/**
 * 更新关键词配置
 * @param keywords 关键词数组
 */
export const updateNewsKeywords = (keywords: string[]) =>
  api.put<NewsKeywordsResponse>('/news/keywords', { keywords })
