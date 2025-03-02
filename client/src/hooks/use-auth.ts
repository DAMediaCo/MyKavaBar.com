import { create } from "zustand";
import { useQuery } from "@tanstack/react-query";

interface User {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  points: number;
}

interface AuthStore {
  user: User | null;
  setUser: (user: User | null) => void;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

export function useAuth() {
  const { user, setUser } = useAuthStore();

  // Fetch user data on mount
  useQuery({
    queryKey: ["/api/auth/me"],
    onSuccess: (data) => setUser(data),
    onError: () => setUser(null),
  });

  return { user };
}
