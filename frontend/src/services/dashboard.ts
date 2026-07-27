import api from "./api";
import type {
  DashboardSummary,
  AssetDistribution,
  PlatformCompareResponse,
} from "@/types/dashboard";

export const dashboardAPI = {
  getSummary: () => api.get<unknown, DashboardSummary>("/dashboard/summary"),

  getDistribution: () =>
    api.get<unknown, AssetDistribution>("/dashboard/distribution"),

  getPlatformCompare: () =>
    api.get<unknown, PlatformCompareResponse>("/dashboard/platform-compare"),
};
