import { useState } from "react";
import { SearchBar } from "@/components/kline/SearchBar";
import { KlineChart } from "@/components/kline/KlineChart";
import { useQuery } from "@tanstack/react-query";
import { marketAPI } from "@/services/market";
import type { SearchItem } from "@/types/kline";

const PERIODS = [
  { key: "daily", label: "日K" },
  { key: "weekly", label: "周K" },
];

const HOT_STOCKS = [
  { code: "000001", name: "平安银行", type: "stock" },
  { code: "600519", name: "贵州茅台", type: "stock" },
  { code: "000858", name: "五粮液", type: "stock" },
  { code: "601318", name: "中国平安", type: "stock" },
];

export function KlinePage() {
  const [selectedCode, setSelectedCode] = useState<string>("000001");
  const [selectedName, setSelectedName] = useState<string>("平安银行");
  const [period, setPeriod] = useState<string>("daily");
  const [showMA, setShowMA] = useState(true);
  const [showMACD, setShowMACD] = useState(true);
  const [showKDJ, setShowKDJ] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ["kline", selectedCode, period],
    queryFn: () => marketAPI.getKline(selectedCode, period),
    staleTime: 60000,
  });

  const handleSelect = (item: SearchItem) => {
    setSelectedCode(item.code);
    setSelectedName(item.name);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">K线图表</h1>
          <p className="text-sm text-slate-500 mt-1">
            {selectedName} ({selectedCode})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-72">
            <SearchBar onSelect={handleSelect} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p.key
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMA}
              onChange={(e) => setShowMA(e.target.checked)}
              className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
            />
            <span className="text-slate-600">均线</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMACD}
              onChange={(e) => setShowMACD(e.target.checked)}
              className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
            />
            <span className="text-slate-600">MACD</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showKDJ}
              onChange={(e) => setShowKDJ(e.target.checked)}
              className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
            />
            <span className="text-slate-600">KDJ</span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <span className="text-xs text-slate-400">热门：</span>
        {HOT_STOCKS.map((stock) => (
          <button
            key={stock.code}
            onClick={() => {
              setSelectedCode(stock.code);
              setSelectedName(stock.name);
            }}
            className={`text-xs px-2 py-1 rounded ${
              selectedCode === stock.code
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            } transition-colors`}
          >
            {stock.name}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
        {isLoading ? (
          <div className="h-96 flex items-center justify-center text-slate-400">
            加载中...
          </div>
        ) : error ? (
          <div className="h-96 flex items-center justify-center text-slate-400">
            加载失败，请稍后重试
          </div>
        ) : data && data.data.length > 0 ? (
          <KlineChart data={data.data} showMA={showMA} showMACD={showMACD} showKDJ={showKDJ} />
        ) : (
          <div className="h-96 flex items-center justify-center text-slate-400">
            暂无数据
          </div>
        )}
      </div>
    </div>
  );
}
