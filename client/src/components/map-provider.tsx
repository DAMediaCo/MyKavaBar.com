import React, { createContext, useContext, useState, useEffect } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define the libraries we'll need
const libraries = ['places', 'geometry'] as any;

// Define the Map context type
interface MapContextType {
  isLoaded: boolean;
  loadError: Error | undefined;
  apiKey: string | undefined;
  geocodeAddress: (address: string) => Promise<{ lat: number; lng: number } | null>;
  getTimezone: (location: { lat: number; lng: number }, timestamp?: number) => Promise<string | null>;
  formatDateForTimezone: (date: Date, timezone: string) => string;
}

// Create the Map context
const MapContext = createContext<MapContextType | null>(null);

// Custom hook for using the Map context
export function useMap() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMap must be used within a MapProvider");
  }
  return context;
}

interface MapProviderProps {
  children: React.ReactNode;
}

export function MapProvider({ children }: MapProviderProps) {
  // Get the Google Maps API key from environment variables
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  const [keyAvailable, setKeyAvailable] = useState<boolean>(!!apiKey);

  // Load the Google Maps JS API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    libraries,
  });

  // Log API key availability on mount
  useEffect(() => {
    if (!apiKey) {
      console.error('Google Maps API key not found. Map functionality will be limited.');
      setKeyAvailable(false);
    } else {
      console.log('Google Maps API key is available');
      setKeyAvailable(true);
    }
  }, [apiKey]);

  // Geocode an address to coordinates
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    if (!isLoaded || !keyAvailable) {
      console.error("Google Maps API not loaded, cannot geocode address");
      return null;
    }

    try {
      const geocoder = new google.maps.Geocoder();
      const result = await new Promise<google.maps.GeocoderResult[] | null>((resolve, reject) => {
        geocoder.geocode({ address }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
            resolve(results);
          } else {
            reject(new Error(`Geocoding failed with status: ${status}`));
          }
        });
      });

      if (result && result[0] && result[0].geometry && result[0].geometry.location) {
        const location = result[0].geometry.location;
        return {
          lat: location.lat(),
          lng: location.lng()
        };
      }
      return null;
    } catch (error) {
      console.error("Error geocoding address:", error);
      return null;
    }
  };

  // Get timezone from coordinates
  const getTimezone = async (
    location: { lat: number; lng: number },
    timestamp = Math.floor(Date.now() / 1000)
  ): Promise<string | null> => {
    if (!isLoaded || !keyAvailable) {
      console.error("Google Maps API not loaded, cannot get timezone");
      return null;
    }

    try {
      // Use the Google Maps Time Zone API
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/timezone/json?location=${location.lat},${location.lng}&timestamp=${timestamp}&key=${apiKey}`
      );
      
      const data = await response.json();
      
      if (data.status === "OK") {
        return data.timeZoneId;
      } else {
        console.error("Timezone API error:", data.status, data.errorMessage);
        return null;
      }
    } catch (error) {
      console.error("Error getting timezone:", error);
      return null;
    }
  };

  // Format date according to timezone
  const formatDateForTimezone = (date: Date, timezone: string): string => {
    try {
      return new Date(date).toLocaleString('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error("Error formatting date for timezone:", error);
      return date.toLocaleString();
    }
  };

  // Create the context value
  const contextValue: MapContextType = {
    isLoaded,
    loadError,
    apiKey,
    geocodeAddress,
    getTimezone,
    formatDateForTimezone
  };

  // Show a loading spinner while the API is loading
  if (!isLoaded && !loadError) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Loading Google Maps API...</p>
        </div>
      </div>
    );
  }

  // Show an error if the API failed to load
  if (loadError || !keyAvailable) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Google Maps Error</AlertTitle>
          <AlertDescription>
            {loadError ? 
              `Failed to load Google Maps: ${loadError.message}` : 
              'Google Maps API key is missing. Some features may not work correctly.'}
          </AlertDescription>
        </Alert>
        {children} {/* Still render children so the app can function with limited features */}
      </div>
    );
  }

  // Provide the context to the children
  return (
    <MapContext.Provider value={contextValue}>
      {children}
    </MapContext.Provider>
  );
}