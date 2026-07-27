import { TrendingUp, TrendingDown } from "lucide-react";
import { formatMoney, formatPercent } from "@/utils/format";
import { getChangeColor } from "@/utils/color";

interface StatCardProps {
  title: string;
  value: number;
  change?: number;
  changePercent?: number;
  prefix?: string;
  suffix?: string;
  isMoney?: boolean;
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  change,
  changePercent,
  prefix = "",
  suffix = "",
  isMoney = true,
  isLoading = false,
}: StatCardProps) {
  const displayValue = isMoney ? formatMoney(value) : value.toFixed(2);
  const hasChange = change !== undefined && changePercent !== undefined;
  const isPositive = hasChange && (change as number) >= 0;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
        <p className="text-sm text-slate-500 mb-2">{title}</p>
        <div className="h-8 bg-slate-100 rounded animate-pulse w-3/4" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
      <p className="text-sm text-slate-500 mb-2">{title}</p>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-bold text-slate-800">
          {prefix}
          {displayValue}
          {suffix}
        </div>
        {hasChange && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${getChangeColor(
              change as number
            )}`}
          >
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{formatPercent(changePercent as number)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
