import { useQuery } from "@tanstack/react-query";
import { dashboardAPI } from "@/services/dashboard";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => dashboardAPI.getSummary(),
  });
}

export function useDashboardDistribution() {
  return useQuery({
    queryKey: ["dashboard", "distribution"],
    queryFn: () => dashboardAPI.getDistribution(),
  });
}

export function usePlatformCompare() {
  return useQuery({
    queryKey: ["dashboard", "platform-compare"],
    queryFn: () => dashboardAPI.getPlatformCompare(),
  });
}
