import { ReactNode, useState, useEffect, useRef } from "react";
import { useLocation } from "@/hooks/use-location";
import { useKavaBars } from "@/hooks/use-kava-bars";
import GoogleMapView from "./google-map-view";
import "./google-map-styles.css";
import type { KavaBar } from "@/hooks/use-kava-bars";
import { AlertTriangle } from "lucide-react";

interface MapProviderProps {
  children?: ReactNode;
  barId?: number;
  showAllBars?: boolean;
  zoom?: number;
  height?: string;
}

export default function MapProvider({ 
  children, 
  barId, 
  showAllBars = false,
  zoom = 13,
  height = "400px"
}: MapProviderProps) {
  const { data: kavaBars = [] } = useKavaBars();
  const { coordinates } = useLocation();
  const [visibleBars, setVisibleBars] = useState<KavaBar[]>([]);
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const attemptsRef = useRef(0);
  
  // Helper function to safely parse location data
  const parseLocation = (location: any): {lat: number, lng: number} | null => {
    if (!location) return null;
    
    try {
      let locationObj = location;
      if (typeof location === 'string') {
        try {
          locationObj = JSON.parse(location);
        } catch (parseError) {
          console.error("Failed to parse location string:", parseError);
          return null;
        }
      }
      
      // Handle various location formats
      let lat: number, lng: number;
      
      if (typeof locationObj === 'object') {
        if ('lat' in locationObj && 'lng' in locationObj) {
          lat = Number(locationObj.lat);
          lng = Number(locationObj.lng);
        } else if ('latitude' in locationObj && 'longitude' in locationObj) {
          lat = Number(locationObj.latitude);
          lng = Number(locationObj.longitude);
        } else {
          console.error("Unknown location object format:", locationObj);
          return null;
        }
      } else {
        console.error("Location is not an object:", locationObj);
        return null;
      }
      
      if (isNaN(lat) || isNaN(lng)) {
        console.error("Invalid coordinates (NaN):", { lat, lng });
        return null;
      }
      if (lat < -90 || lat > 90) {
        console.error("Invalid latitude (out of range):", lat);
        return null;
      }
      if (lng < -180 || lng > 180) {
        console.error("Invalid longitude (out of range):", lng);
        return null;
      }
      
      return { lat, lng };
    } catch (e) {
      console.error("Failed to parse location:", e, "Original location:", location);
      return null;
    }
  };
  
  // Set up user location and relevant bars
  useEffect(() => {
    attemptsRef.current += 1;
    
    try {
      // If specific bar ID provided, find and center on that bar
      if (barId && kavaBars.length > 0) {
        const targetBar = kavaBars.find((bar: KavaBar) => bar.id === Number(barId));
        if (targetBar && targetBar.location) {
          const location = parseLocation(targetBar.location);
          
          if (location) {
            setMapCenter(location);
            setVisibleBars([targetBar]);
            setError(null);
          } else {
            setError("Could not load map: invalid location data");
          }
        } else {
          setError("Bar location information not available");
        }
      } 
      // If showing all bars, use them all
      else if (showAllBars) {
        const barsWithValidLocations = kavaBars.filter((bar: KavaBar) => {
          return parseLocation(bar.location) !== null;
        });
        
        setVisibleBars(barsWithValidLocations);
        
        // Center on user if available, otherwise use first bar with location
        if (coordinates) {
          setMapCenter({ lat: coordinates.latitude, lng: coordinates.longitude });
          setError(null);
        } else if (barsWithValidLocations.length > 0) {
          const firstBarWithLocation = barsWithValidLocations[0];
          const location = parseLocation(firstBarWithLocation.location);
          
          if (location) {
            setMapCenter(location);
            setError(null);
          } else {
            setError("Could not determine map center");
          }
        } else {
          setError("No valid locations found");
        }
      }
    } catch (err) {
      console.error("Error in map setup:", err);
      setError("Failed to initialize map");
    }
  }, [barId, showAllBars, kavaBars, coordinates]);

  // Only show map when we have centers and bars to display and no errors
  const shouldShowMap = !error && (mapCenter || coordinates) && visibleBars.length > 0;

  return (
    <div style={{ height: height, width: "100%", position: "relative" }}>
      {shouldShowMap ? (
        <GoogleMapView
          bars={visibleBars}
          center={mapCenter}
          zoom={zoom}
          userLocation={coordinates ? { lat: coordinates.latitude, lng: coordinates.longitude } : undefined}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full bg-gray-100 rounded-md">
          {error ? (
            <>
              <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
              <p className="text-muted-foreground text-center px-4">{error}</p>
            </>
          ) : (
            <p className="text-muted-foreground">Loading map...</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}