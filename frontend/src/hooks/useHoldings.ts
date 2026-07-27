import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { holdingsAPI } from "@/services/holdings";
import type { HoldingCreate, HoldingUpdate } from "@/types/holding";

export function useHoldings(params?: { platform?: string; asset_type?: string }) {
  return useQuery({
    queryKey: ["holdings", params],
    queryFn: () => holdingsAPI.getList(params),
  });
}

export function useCreateHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: HoldingCreate) => holdingsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: HoldingUpdate }) =>
      holdingsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => holdingsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
