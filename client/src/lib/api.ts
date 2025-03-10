// API utility functions
import { toast } from "@/hooks/use-toast";

/**
 * Get the proper API URL based on environment
 */
export const getApiUrl = (path: string): string => {
  // If path is already a full URL, use it
  if (path.startsWith('http')) {
    return path;
  }

  // Make sure path starts with /
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  
  // In Replit environment, use the same origin to avoid CORS issues
  const baseUrl = window.location.origin;
  return `${baseUrl}${formattedPath}`;
};

/**
 * Fetch data from API with proper error handling
 */
export async function fetchApi<T>(
  path: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = getApiUrl(path);
  
  // Set default options
  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      ...options.headers,
    },
    // Add a timeout to the fetch request
    signal: options.signal || (typeof AbortSignal !== 'undefined' ? 
      AbortSignal.timeout(15000) : undefined) // 15 second timeout
  };
  
  // Merge options
  const fetchOptions = { ...defaultOptions, ...options };
  
  try {
    console.log(`API Request to: ${url}`);
    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      let errorData: any;
      
      try {
        // First try to parse as JSON in case the server sent a JSON error response
        errorData = await response.json();
        console.error(`API Error (${response.status}):`, errorData);
      } catch (e) {
        // If not JSON, get as text
        errorData = await response.text();
        console.error(`API Error (${response.status}):`, errorData);
      }
      
      // Handle specific error cases
      if (response.status === 401) {
        // Handle unauthorized access
        console.warn('Authentication required');
        // Don't show toast for auth errors, they're handled by the auth system
        throw new Error(`Unauthorized: ${typeof errorData === 'object' ? errorData?.error || 'Authentication required' : errorData}`);
      } else if (response.status === 429) {
        // Rate limiting
        toast({
          title: "Rate Limited",
          description: "Too many requests. Please try again later.",
          variant: "destructive"
        });
        throw new Error("Rate limited. Please try again later.");
      } else if (response.status >= 500) {
        // For server errors, show a toast but don't throw - let the caller handle with fallbacks
        toast({
          title: "Using Offline Mode",
          description: "Some data may not be up to date",
          variant: "default"
        });
        
        // For kava bars endpoints, return an empty array instead of throwing
        if (path.includes('/api/kava-bars')) {
          console.warn(`Returning empty array for ${path} due to server error`);
          return ([] as unknown) as T;
        }
        
        // For other endpoints, throw as normal
        throw new Error(`Server error: ${typeof errorData === 'object' ? errorData?.error || response.statusText : errorData}`);
      } else {
        // Show toast for other errors
        toast({
          title: `Error ${response.status}`,
          description: typeof errorData === 'object' ? errorData?.error || response.statusText : errorData,
          variant: "destructive"
        });
        throw new Error(typeof errorData === 'object' ? errorData?.error || response.statusText : errorData);
      }
    }
    
    // For empty responses
    if (response.status === 204) {
      return {} as T;
    }
    
    const data = await response.json();
    
    // Log only the size of large responses to avoid console flooding
    if (typeof data === 'object' && Array.isArray(data) && data.length > 10) {
      console.log(`API Response: (Array with ${data.length} items)`);
    } else {
      console.log('API Response:', data);
    }
    
    return data as T;
  } catch (error: any) {
    console.error('API Request Failed:', error);
    
    // Handle abort errors (timeouts) specially
    if (error.name === 'AbortError') {
      console.warn('Request timed out, returning fallback data');
      toast({
        title: "Using Offline Mode",
        description: "Connection is slow, using cached data",
        variant: "default"
      });
      
      // For kava bars endpoints, return an empty array instead of throwing
      if (path.includes('/api/kava-bars')) {
        return ([] as unknown) as T;
      }
    }
    
    // Only show toast for non-auth errors and only if it wasn't already handled above
    if (!error.message.includes('Unauthorized') && 
        !error.message.includes('Rate limited') && 
        !error.message.includes('Server error') &&
        error.name !== 'AbortError') {
      toast({
        title: "Request Failed",
        description: error.message || "Failed to communicate with server",
        variant: "destructive"
      });
    }
    
    throw error;
  }
}

/**
 * Post data to API with proper error handling
 */
export async function postApi<T>(
  path: string,
  data: any,
  options: RequestInit = {}
): Promise<T> {
  return fetchApi<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
    ...options,
  });
}

/**
 * Put data to API with proper error handling
 */
export async function putApi<T>(
  path: string,
  data: any,
  options: RequestInit = {}
): Promise<T> {
  return fetchApi<T>(path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
    ...options,
  });
}

/**
 * Delete data from API with proper error handling
 */
export async function deleteApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  return fetchApi<T>(path, {
    method: 'DELETE',
    ...options,
  });
}