import { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import type { KavaBar } from "@/hooks/use-kava-bars";
import { Loader2, AlertTriangle } from "lucide-react";
import "./google-map-styles.css";

// Define container style
const containerStyle = {
  width: '100%',
  height: '100%'
};

interface MapViewProps {
  bars: KavaBar[];
  center?: { lat: number; lng: number };
  zoom?: number;
  userLocation?: { lat: number; lng: number };
}

function parseLocation(location: any): { lat: number; lng: number } | null {
  if (!location) return null;

  try {
    if (typeof location === "string") {
      location = JSON.parse(location);
    }

    const lat = Number(location.lat);
    const lng = Number(location.lng);

    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90) return null;
    if (lng < -180 || lng > 180) return null;

    return { lat, lng };
  } catch (e) {
    console.error("Failed to parse location:", e);
    return null;
  }
}

export default function GoogleMapView({
  bars,
  center,
  zoom = 4,
  userLocation,
}: MapViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedBar, setSelectedBar] = useState<KavaBar | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  
  const defaultCenter = center || { lat: 39.8283, lng: -98.5795 }; // Default to center of US

  // Load the Google Maps JS API with error handling for API key
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  console.log('Google Maps API key available:', !!apiKey);
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
  });

  // Handle map load
  const onLoad = useCallback((map: google.maps.Map) => {
    console.log("Map loaded successfully");
    mapRef.current = map;
    setIsLoading(false);
  }, []);

  // Handle map unmount
  const onUnmount = useCallback(() => {
    console.log("Map unmounted");
    mapRef.current = null;
  }, []);

  // Update map center when center prop changes
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.panTo(center);
    }
  }, [center]);

  // Handle load errors
  useEffect(() => {
    if (loadError) {
      console.error("Error loading Google Maps:", loadError);
      setMapError("Failed to load Google Maps. Please try again later.");
      setIsLoading(false);
    }
  }, [loadError]);

  // Set timeout for loading screen
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log("Map still loading after timeout, forcing ready state");
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Debugging information
  useEffect(() => {
    console.log("Google Map component rendering with:", {
      barsCount: bars.length,
      center: defaultCenter,
      userLocation,
      isLoaded,
    });
  }, [bars, defaultCenter, userLocation, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="map-outer-container">
        <div className="map-loading">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground mt-2">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-outer-container">
      {isLoading && (
        <div className="map-loading">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground mt-2">Loading map...</p>
        </div>
      )}

      {mapError && (
        <div className="map-error">
          <p className="text-destructive">{mapError}</p>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        }}
      >
        {/* User location marker */}
        {userLocation && (
          <Marker
            position={userLocation}
            icon={{
              path: 0, // Circle
              fillColor: '#0066FF',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
              scale: 7,
            }}
            title="Your Location"
          />
        )}

        {/* Kava bar markers */}
        {bars.map((bar) => {
          const location = parseLocation(bar.location);
          if (!location) return null;

          return (
            <Marker
              key={bar.id}
              position={location}
              icon={{
                path: 0, // Circle
                fillColor: '#FF0000',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2,
                scale: 7,
              }}
              title={bar.name}
              onClick={() => setSelectedBar(bar)}
            />
          );
        })}

        {/* Info window for selected bar */}
        {selectedBar && (
          <InfoWindow
            position={parseLocation(selectedBar.location) || defaultCenter}
            onCloseClick={() => setSelectedBar(null)}
          >
            <div className="p-2">
              <h3 className="font-medium">{selectedBar.name}</h3>
              <p className="text-sm mt-1">{selectedBar.address}</p>
              {selectedBar.phone && <p className="text-sm mt-1">{selectedBar.phone}</p>}
              {userLocation && selectedBar.location && (
                <p className="text-sm mt-1 text-muted-foreground">
                  {calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    parseLocation(selectedBar.location)?.lat || 0,
                    parseLocation(selectedBar.location)?.lng || 0,
                  ).toFixed(1)}{" "}
                  miles away
                </p>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}