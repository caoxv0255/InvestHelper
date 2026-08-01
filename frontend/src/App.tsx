import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import KLineChart from './pages/KLineChart'
import RiskAnalysis from './pages/RiskAnalysis'
import News from './pages/News'
import Opportunities from './pages/Opportunities'
import StrategyLab from './pages/StrategyLab'
import Transactions from './pages/Transactions'
import PortfolioSnapshot from './pages/PortfolioSnapshot'
import DailyReport from './pages/DailyReport'
import MarketSentiment from './pages/MarketSentiment'
import SectorRotation from './pages/SectorRotation'
import './styles/App.css'

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">InvestHelper</div>
        <div className="nav-links">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
            仪表盘
          </NavLink>
          <NavLink to="/portfolio" className={({ isActive }) => (isActive ? 'active' : '')}>
            持仓管理
          </NavLink>
          <NavLink to="/kline" className={({ isActive }) => (isActive ? 'active' : '')}>
            K线图表
          </NavLink>
          <NavLink to="/risk" className={({ isActive }) => (isActive ? 'active' : '')}>
            风险分析
          </NavLink>
          <NavLink to="/market-sentiment" className={({ isActive }) => (isActive ? 'active' : '')}>
            市场情绪
          </NavLink>
          <NavLink to="/sector-rotation" className={({ isActive }) => (isActive ? 'active' : '')}>
            板块轮动
          </NavLink>
          <NavLink to="/news" className={({ isActive }) => (isActive ? 'active' : '')}>
            快讯
          </NavLink>
          <NavLink to="/opportunities" className={({ isActive }) => (isActive ? 'active' : '')}>
            机会
          </NavLink>
          <NavLink to="/strategy-lab" className={({ isActive }) => (isActive ? 'active' : '')}>
            策略实验室
          </NavLink>
          <NavLink to="/transactions" className={({ isActive }) => (isActive ? 'active' : '')}>
            交易流水
          </NavLink>
          <NavLink to="/portfolio-snapshot" className={({ isActive }) => (isActive ? 'active' : '')}>
            组合快照
          </NavLink>
          <NavLink to="/daily-report" className={({ isActive }) => (isActive ? 'active' : '')}>
            每日报告
          </NavLink>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/kline" element={<KLineChart />} />
          <Route path="/risk" element={<RiskAnalysis />} />
          <Route path="/market-sentiment" element={<MarketSentiment />} />
          <Route path="/sector-rotation" element={<SectorRotation />} />
          <Route path="/news" element={<News />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/strategy-lab" element={<StrategyLab />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/portfolio-snapshot" element={<PortfolioSnapshot />} />
          <Route path="/daily-report" element={<DailyReport />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
