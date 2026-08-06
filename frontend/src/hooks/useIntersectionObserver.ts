/**
 * useIntersectionObserver — IntersectionObserver 通用 hook
 *
 * 触发回调当 ref 元素进入视口。
 * 典型用途：触底加载更多、滚动 reveal 动画。
 *
 * 用法：
 *   const sentinelRef = useRef<HTMLDivElement>(null)
 *   useIntersectionObserver(sentinelRef, () => void loadMore())
 *   return <div ref={sentinelRef} />
 */
import { useEffect, type RefObject } from 'react'

export function useIntersectionObserver<T extends Element>(
  ref: RefObject<T | null>,
  onIntersect: () => void,
  options?: IntersectionObserverInit,
) {
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        onIntersect()
      }
    }, options)
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, onIntersect, options])
}
