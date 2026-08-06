/**
 * Toast — 通用 toast 通知系统
 *
 * 用法：
 *   1. App.tsx 顶层挂载 <ToastProvider>...</ToastProvider>
 *   2. 任意组件 useToast().show('保存成功', 'success')
 *
 * 支持 4 种 variant: 'success' | 'error' | 'info' | 'warning'
 * 默认 3 秒自动关闭；可传 duration 覆盖。
 */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
  duration: number
}

export interface ToastContextValue {
  show: (message: string, variant?: ToastVariant, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}

let nextId = 1

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<ToastItem[]>([])

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 3000) => {
      const id = nextId++
      setItems((prev) => [...prev, { id, message, variant, duration }])
      if (duration > 0) {
        setTimeout(() => {
          setItems((prev) => prev.filter((item) => item.id !== id))
        }, duration)
      }
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast-item toast-${item.variant}`}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
