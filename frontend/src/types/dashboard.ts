export interface DashboardSummary {
  total_asset: number;
  total_profit: number;
  total_profit_rate: number;
  today_profit: number;
  today_profit_rate: number;
  week_profit: number;
  week_profit_rate: number;
  month_profit: number;
  month_profit_rate: number;
  year_profit: number;
  year_profit_rate: number;
}

export interface DistributionItem {
  name: string;
  value: number;
  percentage: number;
}

export interface AssetDistribution {
  by_platform: DistributionItem[];
  by_type: DistributionItem[];
}

export interface PlatformCompareItem {
  platform: string;
  platform_name: string;
  total_asset: number;
  total_cost: number;
  total_profit: number;
  profit_rate: number;
}

export interface PlatformCompareResponse {
  items: PlatformCompareItem[];
}
