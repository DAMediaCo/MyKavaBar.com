import { useQuery } from "@tanstack/react-query";

export function useKavatenders(barId: number) {
  return useQuery<any[]>({
    queryKey: [`/api/kavatenders/${barId}`],
    retry: 2,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}
