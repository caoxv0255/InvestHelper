/**
 * 路由 wrapper — 保持 App.tsx 的 import 路径不变
 *
 * 实际渲染委托给 features/opportunities/OpportunitiesPage。
 * 这是 frontend architecture migration 的过渡层：未来若清理完成可删除此文件，
 * App.tsx 直接 import from features/opportunities/。
 */
import OpportunitiesPage from '../features/opportunities/OpportunitiesPage'

export default OpportunitiesPage