/**
 * useModal — 通用弹窗状态 hook
 *
 * 替换页面里反复出现的 `{ visible, data, open, close }` 三元组模式。
 * open() 可选传入关联数据（如编辑的对象），close() 自动清空 data。
 *
 * 示例：
 *   const editModal = useModal<Holding>()
 *   editModal.open(holdingToEdit)  // 打开并带入数据
 *   editModal.close()              // 关闭并清空
 *   <Modal visible={editModal.visible} data={editModal.data} />
 */
import { useCallback, useState } from 'react'

export interface ModalState<T> {
  visible: boolean
  /** open() 传入的关联数据；close() 后回到 null */
  data: T | null
  /** 打开弹窗，可选传入关联数据（不传时为 null） */
  open: (data?: T | null) => void
  /** 关闭弹窗并清空 data */
  close: () => void
  /** 切换可见性，不动 data（少见用法） */
  toggle: () => void
}

export function useModal<T = undefined>(): ModalState<T> {
  const [visible, setVisible] = useState(false)
  const [data, setData] = useState<T | null>(null)

  const open = useCallback((d?: T | null) => {
    setData(d ?? null)
    setVisible(true)
  }, [])

  const close = useCallback(() => {
    setVisible(false)
    setData(null)
  }, [])

  const toggle = useCallback(() => setVisible((v) => !v), [])

  return { visible, data, open, close, toggle }
}