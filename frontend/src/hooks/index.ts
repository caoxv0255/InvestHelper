/**
 * Hooks barrel — 统一对外导出
 *
 * 通用原语：useLocalStorage / useDebounce（工具类）
 *            useAsyncResource / useModal / useForm（状态类）
 *
 * 后续按业务域抽的 hook（如 useHoldings / useNewsFeed）也从此处 re-export。
 */
export { useLocalStorage, useDebounce } from './legacy'
export { useAsyncResource } from './useAsyncResource'
export type { AsyncResource, UseAsyncResourceOptions } from './useAsyncResource'
export { useModal } from './useModal'
export type { ModalState } from './useModal'
export { useForm } from './useForm'
export type { FormState, FormErrors } from './useForm'
export { focusFirstError } from './useFormErrorFocus'
export { useAutoFocus } from './useAutoFocus'
export { useIntersectionObserver } from './useIntersectionObserver'