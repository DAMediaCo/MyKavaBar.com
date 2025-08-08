import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InsertUser, User } from "@db/schema";
import { fetchApi, postApi } from "@/lib/api";

// Define response types for API calls
interface UserResponse {
  user: User;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  user?: User;
}

type RequestResult =
  | {
      ok: true;
      user?: User;
    }
  | {
      ok: false;
      message: string;
    };

async function handleRequest(
  url: string,
  method: string,
  body?: InsertUser,
): Promise<RequestResult> {
  try {
    console.log(`Making ${method} request to: ${url}`);

    if (method === "POST") {
      const result = await postApi<ApiResponse>(url, body);
      return {
        ok: true,
        user: result?.user,
      };
    } else {
      const result = await fetchApi<ApiResponse>(url);
      return {
        ok: true,
        user: result?.user,
      };
    }
  } catch (e: any) {
    console.error("Request error:", e);
    return { ok: false, message: e.message || e.toString() };
  }
}

async function fetchUser(): Promise<User | null> {
  try {
    try {
      const response = await fetchApi<UserResponse>("/api/user");
      const user = response?.user;

      if (!user) {
        console.log("No user data in response");
        return null;
      }
      return user;
    } catch (error: any) {
      if (error.message.includes("401")) {
        console.log("User not authenticated");
        return null;
      }
      throw error;
    }
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

export function useUser() {
  const queryClient = useQueryClient();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null>({
    queryKey: ["user"],
    queryFn: fetchUser,
    staleTime: Infinity,
    retry: false,
  });

  const loginMutation = useMutation<RequestResult, Error, InsertUser>({
    mutationFn: (userData) => handleRequest("/api/login", "POST", userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });

  const logoutMutation = useMutation<RequestResult, Error>({
    mutationFn: () => handleRequest("/api/logout", "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.clear();
    },
  });

  const registerMutation = useMutation<RequestResult, Error, InsertUser>({
    mutationFn: (userData) => handleRequest("/api/register", "POST", userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });

  return {
    user,
    isLoading,
    error,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    register: registerMutation.mutateAsync,
  };
}
