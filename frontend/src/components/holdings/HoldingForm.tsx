import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Holding, HoldingCreate, HoldingUpdate } from "@/types/holding";
import { PLATFORM_NAMES, ASSET_TYPE_NAMES } from "@/utils/color";

interface HoldingFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: HoldingCreate) => void;
  editingHolding?: Holding | null;
}

export function HoldingForm({ open, onClose, onSubmit, editingHolding }: HoldingFormProps) {
  const [formData, setFormData] = useState({
    platform: "alipay",
    platform_name: "支付宝",
    asset_type: "fund",
    code: "",
    name: "",
    quantity: 0,
    cost_price: 0,
    buy_date: "",
    notes: "",
  });

  useEffect(() => {
    if (editingHolding) {
      setFormData({
        platform: editingHolding.platform,
        platform_name: editingHolding.platform_name || "",
        asset_type: editingHolding.asset_type,
        code: editingHolding.code,
        name: editingHolding.name,
        quantity: editingHolding.quantity,
        cost_price: editingHolding.cost_price,
        buy_date: editingHolding.buy_date || "",
        notes: editingHolding.notes || "",
      });
    } else {
      setFormData({
        platform: "alipay",
        platform_name: "支付宝",
        asset_type: "fund",
        code: "",
        name: "",
        quantity: 0,
        cost_price: 0,
        buy_date: "",
        notes: "",
      });
    }
  }, [editingHolding, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      quantity: Number(formData.quantity),
      cost_price: Number(formData.cost_price),
      buy_date: formData.buy_date || null,
      notes: formData.notes || null,
    };
    onSubmit(submitData);
    onClose();
  };

  const handlePlatformChange = (platform: string) => {
    setFormData({
      ...formData,
      platform,
      platform_name: PLATFORM_NAMES[platform] || platform,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-slate-800">
            {editingHolding ? "编辑持仓" : "新增持仓"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                平台
              </label>
              <select
                value={formData.platform}
                onChange={(e) => handlePlatformChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {Object.entries(PLATFORM_NAMES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                资产类型
              </label>
              <select
                value={formData.asset_type}
                onChange={(e) =>
                  setFormData({ ...formData, asset_type: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {Object.entries(ASSET_TYPE_NAMES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                代码
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="如：000001"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                名称
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：平安银行"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                持仓数量
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                成本价
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.cost_price}
                onChange={(e) =>
                  setFormData({ ...formData, cost_price: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              买入日期
            </label>
            <input
              type="date"
              value={formData.buy_date}
              onChange={(e) => setFormData({ ...formData, buy_date: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              备注
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {editingHolding ? "保存" : "添加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
