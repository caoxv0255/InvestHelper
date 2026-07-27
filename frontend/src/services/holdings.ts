import api from "./api";
import type {
  Holding,
  HoldingListResponse,
  HoldingCreate,
  HoldingUpdate,
  FixedDeposit,
} from "@/types/holding";

export const holdingsAPI = {
  getList: (params?: { platform?: string; asset_type?: string }) =>
    api.get<unknown, HoldingListResponse>("/holdings", { params }),

  get: (id: number) => api.get<unknown, Holding>(`/holdings/${id}`),

  create: (data: HoldingCreate) => api.post<unknown, Holding>("/holdings", data),

  update: (id: number, data: HoldingUpdate) =>
    api.put<unknown, Holding>(`/holdings/${id}`, data),

  delete: (id: number) => api.delete<unknown, void>(`/holdings/${id}`),

  getFixedDeposits: () =>
    api.get<unknown, { total: number; items: FixedDeposit[] }>("/fixed-deposits"),
};
