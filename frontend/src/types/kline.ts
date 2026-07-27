export interface KlineDataItem {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5?: number | null;
  ma10?: number | null;
  ma20?: number | null;
  ma60?: number | null;
  macd_dif?: number | null;
  macd_dea?: number | null;
  macd_hist?: number | null;
  kdj_k?: number | null;
  kdj_d?: number | null;
  kdj_j?: number | null;
}

export interface KlineResponse {
  code: string;
  name: string;
  period: string;
  data: KlineDataItem[];
}

export interface SearchItem {
  code: string;
  name: string;
  type: string;
}

export interface SearchResponse {
  keyword: string;
  items: SearchItem[];
}

export interface QuoteResponse {
  code: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  amount?: number;
}

export interface IndexQuote {
  code: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  volume?: number;
  amount?: number;
}

export interface IndicesResponse {
  items: IndexQuote[];
}
