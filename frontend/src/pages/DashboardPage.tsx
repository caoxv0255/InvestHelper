import { useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { AssetPieChart } from "@/components/dashboard/AssetPieChart";
import { PlatformCompareChart } from "@/components/dashboard/PlatformCompareChart";
import {
  useDashboardSummary,
  useDashboardDistribution,
  usePlatformCompare,
} from "@/hooks/useDashboard";
import { formatMoney, formatPercent } from "@/utils/format";
import { getChangeColor, PLATFORM_NAMES, ASSET_TYPE_NAMES } from "@/utils/color";

type DistType = "platform" | "type";

export function DashboardPage() {
  const [distType, setDistType] = useState<DistType>("type");
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: distribution, isLoading: distLoading } = useDashboardDistribution();
  const { data: platformCompare, isLoading: compareLoading } = usePlatformCompare();

  const pieData =
    distType === "platform"
      ? distribution?.by_platform || []
      : distribution?.by_type || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">资产仪表盘</h1>
        <p className="text-sm text-slate-500 mt-1">全面了解您的资产状况</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="总资产"
          value={summary?.total_asset || 0}
          isLoading={summaryLoading}
        />
        <StatCard
          title="总收益"
          value={summary?.total_profit || 0}
          change={summary?.total_profit}
          changePercent={summary?.total_profit_rate}
          isLoading={summaryLoading}
        />
        <StatCard
          title="今日收益"
          value={summary?.today_profit || 0}
          change={summary?.today_profit}
          changePercent={summary?.today_profit_rate}
          isLoading={summaryLoading}
        />
        <StatCard
          title="今年收益"
          value={summary?.year_profit || 0}
          change={summary?.year_profit}
          changePercent={summary?.year_profit_rate}
          isLoading={summaryLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">资产分布</h3>
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setDistType("type")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  distType === "type"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                按类型
              </button>
              <button
                onClick={() => setDistType("platform")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  distType === "platform"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                按平台
              </button>
            </div>
          </div>
          {!distLoading && distribution ? (
            <AssetPieChart data={pieData} title="" />
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400">
              加载中...
            </div>
          )}
        </div>
        {!compareLoading && platformCompare ? (
          <PlatformCompareChart data={platformCompare.items} />
        ) : (
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm h-80 flex items-center justify-center text-slate-400">
            加载中...
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800 mb-4">各平台详情</h3>
        {!compareLoading && platformCompare ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {platformCompare.items.map((item) => (
              <div
                key={item.platform}
                className="p-4 border border-border rounded-xl hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-slate-700">
                    {item.platform_name}
                  </span>
                  <span
                    className={`text-sm font-medium ${getChangeColor(
                      item.total_profit
                    )}`}
                  >
                    {formatPercent(item.profit_rate)}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-800 mb-1">
                  ¥{formatMoney(item.total_asset)}
                </div>
                <div className={`text-sm ${getChangeColor(item.total_profit)}`}>
                  {item.total_profit >= 0 ? "+" : ""}¥{formatMoney(item.total_profit)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-slate-400">
            加载中...
          </div>
        )}
      </div>
    </div>
  );
}
