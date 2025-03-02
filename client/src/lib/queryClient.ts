import { QueryClient } from "@tanstack/react-query";
import { fetchApi } from "./api";

// We now use the API utility for all fetch operations
// This function is kept for backward compatibility
export const getApiUrl = (path: string) => {
  // If path is already a full URL, use it
  if (path.startsWith('http')) {
    return path;
  }

  // Make sure path starts with /
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  
  // For development in Replit, use the same host with no port specification
  // This works with Replit's port forwarding
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // If we're running in development and we know the server port
  if (process.env.NODE_ENV === 'development' && process.env.SERVER_PORT) {
    return `${protocol}//${hostname}:${process.env.SERVER_PORT}${formattedPath}`;
  }
  
  // Otherwise default to the same host (in Replit environment this works due to port forwarding)
  return `${protocol}//${hostname}${formattedPath}`;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        // Use our centralized API utility for consistent error handling
        return fetchApi(queryKey[0] as string);
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      retry: 1,
      networkMode: 'always',
    },
    mutations: {
      retry: 1,
      networkMode: 'always',
    }
  },
});