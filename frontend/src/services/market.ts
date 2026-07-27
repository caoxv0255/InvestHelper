import api from "./api";
import type {
  KlineResponse,
  SearchResponse,
  QuoteResponse,
  IndicesResponse,
} from "@/types/kline";

export const marketAPI = {
  search: (keyword: string) =>
    api.get<unknown, SearchResponse>("/market/search", {
      params: { keyword },
    }),

  getQuote: (code: string) => api.get<unknown, QuoteResponse>(`/market/quote/${code}`),

  getKline: (code: string, period: string = "daily") =>
    api.get<unknown, KlineResponse>(`/market/kline/${code}`, {
      params: { period },
    }),

  getIndices: () => api.get<unknown, IndicesResponse>("/market/indices"),
};
