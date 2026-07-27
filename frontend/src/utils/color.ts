export function getChangeColor(value: number): string {
  if (value > 0) return "text-rise";
  if (value < 0) return "text-fall";
  return "text-slate-500";
}

export function getChangeBgColor(value: number): string {
  if (value > 0) return "bg-red-50 text-rise";
  if (value < 0) return "bg-green-50 text-fall";
  return "bg-slate-50 text-slate-500";
}

export const PLATFORM_NAMES: Record<string, string> = {
  alipay: "支付宝",
  merchants_bank: "招商银行",
  ths: "同花顺",
};

export const ASSET_TYPE_NAMES: Record<string, string> = {
  fund: "基金",
  stock: "股票",
  deposit: "定期理财",
};
