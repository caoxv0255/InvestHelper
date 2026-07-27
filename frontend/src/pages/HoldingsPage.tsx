import { useState } from "react";
import { Plus } from "lucide-react";
import { HoldingForm } from "@/components/holdings/HoldingForm";
import { HoldingList } from "@/components/holdings/HoldingList";
import {
  useHoldings,
  useCreateHolding,
  useUpdateHolding,
  useDeleteHolding,
} from "@/hooks/useHoldings";
import type { Holding, HoldingCreate } from "@/types/holding";
import { PLATFORM_NAMES } from "@/utils/color";

const tabs = [
  { key: "all", label: "全部" },
  { key: "alipay", label: "支付宝" },
  { key: "merchants_bank", label: "招商银行" },
  { key: "ths", label: "同花顺" },
];

export function HoldingsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);

  const { data, isLoading } = useHoldings(
    activeTab !== "all" ? { platform: activeTab } : undefined
  );
  const createMutation = useCreateHolding();
  const updateMutation = useUpdateHolding();
  const deleteMutation = useDeleteHolding();

  const handleAdd = () => {
    setEditingHolding(null);
    setFormOpen(true);
  };

  const handleEdit = (holding: Holding) => {
    setEditingHolding(holding);
    setFormOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("确定要删除这条持仓记录吗？")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (data: HoldingCreate) => {
    if (editingHolding) {
      updateMutation.mutate({ id: editingHolding.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const holdings = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">持仓管理</h1>
          <p className="text-sm text-slate-500 mt-1">管理您的各平台持仓数据</p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增持仓
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border p-1 inline-flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <p className="text-slate-400">加载中...</p>
        </div>
      ) : (
        <HoldingList
          holdings={holdings}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <HoldingForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        editingHolding={editingHolding}
      />
    </div>
  );
}
