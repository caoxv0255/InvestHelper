import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
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
    <AppShell>
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
    </AppShell>
  )
}

export default App
