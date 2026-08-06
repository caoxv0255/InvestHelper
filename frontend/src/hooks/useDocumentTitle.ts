/**
 * useDocumentTitle — 同步 React 组件的浏览器 tab title
 *
 * 用法：useDocumentTitle('持仓管理')
 * 卸载时自动恢复原 title。
 */
import { useEffect } from 'react'

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title
    return () => {
      document.title = prev
    }
  }, [title])
}
