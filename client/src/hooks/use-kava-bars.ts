import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { fetchApi } from '@/lib/api';

// Define the type for the hours object based on the API response
interface Hours {
  weekday_text: string[];
  open_now?: boolean;
  periods?: Array<{
    close: { day: number; time: string };
    open: { day: number; time: string };
  }>;
  hours_available: boolean;
}

// Define the type for the location object
interface Location {
  lat: number;
  lng: number;
}

// Define the base public KavaBar interface that's always available
interface PublicKavaBar {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  businessStatus: string;
  rating: number | string; // Accept both number and string to handle type discrepancies
  isSponsored: boolean;
  verificationStatus: string;
  placeId: string | null;
  website?: string | null;
  location: Location | null;
}

// Define the full KavaBar interface with authenticated fields
export interface KavaBar extends PublicKavaBar {
  ownerId?: number | null;
  hours?: Hours | null;
  createdAt?: string;
  updatedAt?: string;
  lastVerified?: string | null;
  dataCompletenessScore?: number;
  googlePlaceId?: string | null;
  isVerifiedKavaBar?: boolean;
  verificationNotes?: string | null;
  virtualTourUrl?: string | null;
  googlePhotos?: Array<{
    photoReference: string;
    width: number;
    height: number;
  }> | null;
}

// Helper function to parse hours data
function parseHours(hours: any): Hours | null {
  if (!hours) {
    return null;
  }

  try {
    // If hours is already an array, convert to Hours format
    if (Array.isArray(hours)) {
      return {
        weekday_text: hours,
        open_now: false,
        periods: [],
        hours_available: true
      };
    }

    // If hours is a string, try to parse it
    if (typeof hours === 'string') {
      const parsed = JSON.parse(hours);
      if (Array.isArray(parsed)) {
        return {
          weekday_text: parsed,
          open_now: false,
          periods: [],
          hours_available: true
        };
      }
      // If it's the older format with weekday_text
      if (parsed.weekday_text && Array.isArray(parsed.weekday_text)) {
        return {
          ...parsed,
          hours_available: true
        };
      }
    }

    // If hours is already in the correct format
    if (hours.weekday_text && Array.isArray(hours.weekday_text)) {
      return {
        ...hours,
        hours_available: true
      };
    }

    return {
      weekday_text: [],
      open_now: false,
      periods: [],
      hours_available: false
    };
  } catch (e) {
    console.error('Error parsing hours:', e);
    return {
      weekday_text: [],
      open_now: false,
      periods: [],
      hours_available: false
    };
  }
}

// Fallback data for client-side resilience
const clientFallbackBars: KavaBar[] = [
  {
    id: 1,
    name: "Island Rootz Kava Bar",
    address: "123 Beach Drive, Miami, FL 33139",
    phone: "555-123-4567",
    businessStatus: "OPERATIONAL",
    rating: 4.7,
    isSponsored: true,
    verificationStatus: "verified",
    placeId: null,
    location: { lat: 25.7617, lng: -80.1918 },
    hours: {
      weekday_text: [
        "Monday: 11:00 AM – 10:00 PM",
        "Tuesday: 11:00 AM – 10:00 PM",
        "Wednesday: 11:00 AM – 10:00 PM",
        "Thursday: 11:00 AM – 10:00 PM",
        "Friday: 11:00 AM – 12:00 AM",
        "Saturday: 11:00 AM – 12:00 AM",
        "Sunday: 12:00 PM – 8:00 PM"
      ],
      hours_available: true
    }
  },
  {
    id: 2,
    name: "Chill Kava Lounge",
    address: "456 Relaxation Ave, Orlando, FL 32801",
    phone: "555-789-0123",
    businessStatus: "OPERATIONAL",
    rating: 4.5,
    isSponsored: false,
    verificationStatus: "verified",
    placeId: null,
    location: { lat: 28.5384, lng: -81.3789 },
    hours: {
      weekday_text: [
        "Monday: 12:00 PM – 11:00 PM",
        "Tuesday: 12:00 PM – 11:00 PM",
        "Wednesday: 12:00 PM – 11:00 PM",
        "Thursday: 12:00 PM – 11:00 PM",
        "Friday: 12:00 PM – 1:00 AM",
        "Saturday: 12:00 PM – 1:00 AM",
        "Sunday: 12:00 PM – 9:00 PM"
      ],
      hours_available: true
    }
  }
];

export function useKavaBars() {
  const { toast } = useToast();
  
  return useQuery<KavaBar[]>({
    queryKey: ["/api/kava-bars"],
    queryFn: async () => {
      try {
        console.log("Fetching kava bars from API...");
        const data = await fetchApi<KavaBar[]>("/api/kava-bars");
        console.log(`Received ${data.length} kava bars from API`);

        // If we got an empty array, use client fallback
        if (!data || data.length === 0) {
          console.warn("Received empty data from API, using fallback");
          return clientFallbackBars;
        }

        // Process and validate the bars
        return data.map((bar: any) => {
          try {
            // Ensure rating is properly handled
            let rating = 0;
            if (typeof bar.rating === 'string') {
              rating = parseFloat(bar.rating);
            } else if (typeof bar.rating === 'number') {
              rating = bar.rating;
            }
            
            // Parse location if it's a string
            let location = bar.location;
            if (typeof location === 'string') {
              try {
                location = JSON.parse(location);
              } catch (e) {
                console.warn(`Failed to parse location for bar ${bar.id}:`, e);
                location = null;
              }
            }
            
            // Return normalized bar data
            return {
              ...bar,
              id: bar.id || Math.floor(Math.random() * 10000),
              hours: parseHours(bar.hours),
              rating: rating,
              location: location,
              businessStatus: bar.businessStatus || "OPERATIONAL",
              verificationStatus: bar.verificationStatus || "pending"
            };
          } catch (e) {
            console.error("Error processing bar data:", e, bar);
            // Return a minimal valid bar object to prevent rendering errors
            return {
              id: bar.id || Math.floor(Math.random() * 10000),
              name: bar.name || "Unknown Bar",
              address: bar.address || "Address unavailable",
              phone: bar.phone || null,
              businessStatus: "OPERATIONAL",
              rating: 0,
              isSponsored: false,
              verificationStatus: "pending",
              placeId: null,
              location: null,
              hours: null
            };
          }
        });
      } catch (error) {
        console.error("Error in useKavaBars:", error);
        toast({
          title: "Kava Bars",
          description: "Using offline data while we restore connection",
          variant: "default"
        });
        return clientFallbackBars;
      }
    },
    retry: 2,
    staleTime: 30000,
    // Increase retry interval to handle slow connections
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000)
  });
}

export function useKavaBar(id: string) {
  const { toast } = useToast();
  
  return useQuery<KavaBar>({
    queryKey: [`/api/kava-bars/${id}`],
    queryFn: async () => {
      try {
        console.log(`Fetching bar details for ID: ${id}`);
        const data = await fetchApi<KavaBar>(`/api/kava-bars/${id}`);
        
        // Validate the response data
        if (!data || !data.name || !data.address) {
          console.error('Invalid bar data:', data);
          
          // If the ID matches one of our fallback bars, use that
          const fallbackId = parseInt(id);
          const fallbackBar = clientFallbackBars.find(bar => bar.id === fallbackId);
          
          if (fallbackBar) {
            console.log(`Using client fallback for bar ID ${id}`);
            toast({
              title: "Limited connectivity",
              description: "Using locally stored data",
              variant: "default",
            });
            return fallbackBar;
          }
          
          throw new Error('Invalid bar data received');
        }

        // Ensure rating is properly handled
        let rating = 0;
        if (typeof data.rating === 'string') {
          rating = parseFloat(data.rating);
        } else if (typeof data.rating === 'number') {
          rating = data.rating;
        }
        
        // Parse location if it's a string
        let location = data.location;
        if (typeof location === 'string') {
          try {
            location = JSON.parse(location);
          } catch (e) {
            console.warn(`Failed to parse location for bar ${data.id}:`, e);
            location = null;
          }
        }

        return {
          ...data,
          hours: parseHours(data.hours),
          rating: rating,
          location: location
        };
      } catch (error) {
        console.error("Error in useKavaBar:", error);
        
        // If the ID matches one of our fallback bars, use that
        const fallbackId = parseInt(id);
        const fallbackBar = clientFallbackBars.find(bar => bar.id === fallbackId);
          
        if (fallbackBar) {
          console.log(`Using client fallback for bar ID ${id} after error`);
          toast({
            title: "Offline mode",
            description: "Using locally stored data",
            variant: "default",
          });
          return fallbackBar;
        }
        
        throw error;
      }
    },
    retry: 2,
    enabled: !!id,
    staleTime: 30000,
    // Increase retry interval to handle slow connections
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000)
  });
}