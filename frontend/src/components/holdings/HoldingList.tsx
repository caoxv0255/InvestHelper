import { Pencil, Trash2 } from "lucide-react";
import type { Holding } from "@/types/holding";
import { formatMoney, formatPercent } from "@/utils/format";
import { getChangeColor, PLATFORM_NAMES, ASSET_TYPE_NAMES } from "@/utils/color";

interface HoldingListProps {
  holdings: Holding[];
  onEdit: (holding: Holding) => void;
  onDelete: (id: number) => void;
}

export function HoldingList({ holdings, onEdit, onDelete }: HoldingListProps) {
  if (!holdings.length) {
    return (
      <div className="bg-white rounded-xl border border-border p-12 text-center">
        <p className="text-slate-400">暂无持仓数据，请添加您的持仓</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-border">
          <tr>
            <th className="text-left text-xs font-medium text-slate-500 uppercase px-4 py-3">
              标的
            </th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase px-4 py-3">
              平台
            </th>
            <th className="text-right text-xs font-medium text-slate-500 uppercase px-4 py-3">
              持仓数量
            </th>
            <th className="text-right text-xs font-medium text-slate-500 uppercase px-4 py-3">
              成本价
            </th>
            <th className="text-right text-xs font-medium text-slate-500 uppercase px-4 py-3">
              市值
            </th>
            <th className="text-right text-xs font-medium text-slate-500 uppercase px-4 py-3">
              收益
            </th>
            <th className="text-center text-xs font-medium text-slate-500 uppercase px-4 py-3">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {holdings.map((holding) => {
            const marketValue = holding.quantity * (holding.current_price || holding.cost_price);
            const costValue = holding.quantity * holding.cost_price;
            const profit = marketValue - costValue;
            const profitRate = costValue > 0 ? (profit / costValue) * 100 : 0;
            return (
              <tr key={holding.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium text-slate-800">{holding.name}</div>
                    <div className="text-xs text-slate-400">
                      {holding.code} · {ASSET_TYPE_NAMES[holding.asset_type] || holding.asset_type}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                    {PLATFORM_NAMES[holding.platform] || holding.platform}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {formatMoney(holding.quantity, 2)}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {formatMoney(holding.cost_price, 4)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">
                  {formatMoney(marketValue, 2)}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${getChangeColor(profit)}`}>
                  <div>{profit >= 0 ? "+" : ""}{formatMoney(profit, 2)}</div>
                  <div className="text-xs">{formatPercent(profitRate)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onEdit(holding)}
                      className="p-1.5 text-slate-400 hover:text-primary hover:bg-blue-50 rounded transition-colors"
                      title="编辑"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(holding.id)}
                      className="p-1.5 text-slate-400 hover:text-rise hover:bg-red-50 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
