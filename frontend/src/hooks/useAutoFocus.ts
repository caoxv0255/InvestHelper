/**
 * useAutoFocus — 弹窗/容器打开时自动 focus 第一个可编辑元素
 *
 * 用于 modal / drawer / popover 等"出现后用户立刻能输入"的场景。
 *
 * 用法：
 *   useAutoFocus(visible)
 *   // 等价于：visible 切换为 true 时，requestAnimationFrame 内
 *   // querySelector('.modal-content input:not([type=button])') 并 focus
 */
import { useEffect } from 'react'

const SELECTOR =
  'input:not([type=button]):not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])'

export function useAutoFocus(
  open: boolean,
  containerSelector = '.modal-content',
) {
  useEffect(() => {
    if (!open) return
    const handle = requestAnimationFrame(() => {
      const container = document.querySelector(containerSelector)
      if (!container) return
      const first = container.querySelector<HTMLElement>(SELECTOR)
      first?.focus()
    })
    return () => cancelAnimationFrame(handle)
  }, [open, containerSelector])
}
