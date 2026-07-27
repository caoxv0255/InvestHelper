import { useQuery } from "@tanstack/react-query";
import { marketAPI } from "@/services/market";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatMoney, formatPercent } from "@/utils/format";
import { getChangeColor } from "@/utils/color";

export function MarketPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["indices"],
    queryFn: () => marketAPI.getIndices(),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">市场概览</h1>
        <p className="text-sm text-slate-500 mt-1">主要指数实时行情</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-border p-5 shadow-sm h-32 animate-pulse"
            >
              <div className="h-5 bg-slate-100 rounded w-24 mb-3" />
              <div className="h-8 bg-slate-100 rounded w-32 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-20" />
            </div>
          ))}
        </div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.items.map((item) => {
            const isUp = item.change_percent > 0;
            const isDown = item.change_percent < 0;
            return (
              <div
                key={item.code}
                className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-slate-700">{item.name}</span>
                  {isUp ? (
                    <TrendingUp className="w-5 h-5 text-rise" />
                  ) : isDown ? (
                    <TrendingDown className="w-5 h-5 text-fall" />
                  ) : (
                    <Minus className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div
                  className={`text-3xl font-bold mb-2 ${getChangeColor(
                    item.change_percent
                  )}`}
                >
                  {formatMoney(item.price, 2)}
                </div>
                <div className={`flex items-center gap-3 text-sm ${getChangeColor(item.change_percent)}`}>
                  <span>
                    {item.change >= 0 ? "+" : ""}
                    {formatMoney(item.change, 2)}
                  </span>
                  <span className="font-medium">
                    {formatPercent(item.change_percent)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <p className="text-slate-400">暂无指数数据</p>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-700">
          <strong>温馨提示：</strong>
          数据仅供参考，不构成投资建议。投资有风险，入市需谨慎。
        </p>
      </div>
    </div>
  );
}
