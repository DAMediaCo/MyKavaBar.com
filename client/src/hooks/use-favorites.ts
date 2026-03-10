import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ✅ Fetch favorite status (only when authenticated)
export const useFavoriteStatus = (barId: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["favorite", barId],
    queryFn: async () => {
      const res = await fetch(`/api/favorites/${barId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to check favorite status");
      return res.json(); // { isFavorite: true/false }
    },
    enabled,
    retry: false,
  });
};

// ✅ Add to favorites
export const useAddFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (barId: number) => {
      const res = await fetch(`/api/favorites/${barId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add to favorites");
      return res.json();
    },
    onSuccess: (_, barId) => {
      queryClient.invalidateQueries(["favorite", barId]); // Refresh favorite status
      queryClient.invalidateQueries(["favoriteBars"]);
    },
  });
};

// ✅ Remove from favorites
export const useRemoveFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (barId: number) => {
      const res = await fetch(`/api/favorites/${barId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove from favorites");
      return res.json();
    },
    onSuccess: (_, barId) => {
      queryClient.invalidateQueries(["favorite", barId]);

      // Refresh favorite status
      queryClient.invalidateQueries(["favoriteBars"]);
    },
  });
};
