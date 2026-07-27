export interface Holding {
  id: number;
  platform: string;
  platform_name: string;
  asset_type: string;
  code: string;
  name: string;
  quantity: number;
  cost_price: number;
  current_price: number;
  current_price_updated: string | null;
  buy_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface HoldingListResponse {
  total: number;
  items: Holding[];
}

export interface HoldingCreate {
  platform: string;
  platform_name?: string;
  asset_type: string;
  code: string;
  name: string;
  quantity: number;
  cost_price: number;
  buy_date?: string | null;
  notes?: string | null;
}

export interface HoldingUpdate {
  platform?: string;
  platform_name?: string;
  asset_type?: string;
  code?: string;
  name?: string;
  quantity?: number;
  cost_price?: number;
  current_price?: number;
  buy_date?: string | null;
  notes?: string | null;
}

export interface FixedDeposit {
  id: number;
  bank: string;
  product_name: string;
  principal: number;
  annual_rate: number;
  start_date: string;
  end_date: string;
  interest_method: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
