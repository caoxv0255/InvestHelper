import { Link, useLocation } from "react-router-dom";
import { PieChart, Wallet, LineChart, TrendingUp } from "lucide-react";

const navItems = [
  { key: "dashboard", label: "仪表盘", icon: PieChart, path: "/" },
  { key: "holdings", label: "持仓管理", icon: Wallet, path: "/holdings" },
  { key: "kline", label: "K线图表", icon: LineChart, path: "/kline" },
  { key: "market", label: "市场概览", icon: TrendingUp, path: "/market" },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="bg-white border-b border-border shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <LineChart className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-800">投资助手</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path !== "/" && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-primary"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">投资有风险，决策需谨慎</span>
        </div>
      </div>
    </header>
  );
}
