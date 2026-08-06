/**
 * 路由 wrapper — 保持 App.tsx 的 import 路径不变
 *
 * 实际渲染委托给 features/risk/RiskAnalysisPage。
 * 这是 frontend architecture migration 的过渡层：未来若清理完成可删除此文件，
 * App.tsx 直接 import from features/risk/。
 */
import RiskAnalysisPage from '../features/risk/RiskAnalysisPage'

export default RiskAnalysisPage