import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  ZoomControl
} from "react-leaflet";
import { Icon } from "leaflet";
import { Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import MarkerClusterGroup from "react-leaflet-markercluster";
import { KavaBar } from "@/hooks/use-kava-bars";
import { useLocationContext } from "@/contexts/location-context";

// Import default marker icons since Leaflet's default markers are broken in production builds
import userIcon from "../assets/user-location.svg";
import barIcon from "../assets/bar-pin.svg";
import sponsoredBarIcon from "../assets/sponsored-pin.svg";

// Define custom icons
const createIcon = (url: string, size: number = 32) => 
  new Icon({
    iconUrl: url,
    iconSize: [size, size],
    iconAnchor: [size/2, size],
    popupAnchor: [0, -size],
  });

const UserLocationIcon = createIcon(userIcon);
const BarMarkerIcon = createIcon(barIcon);
const SponsoredBarIcon = createIcon(sponsoredBarIcon, 40);

// Helper component to update map view when props change
function MapUpdater({ center, zoom }: { center?: { lat: number; lng: number }; zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], zoom || map.getZoom());
    }
  }, [center, zoom, map]);

  return null;
}

// Helper function to parse location data, ensuring we always get a valid format or null
function parseLocation(location: any): { lat: number; lng: number } | null {
  if (!location) return null;

  // If location is a string, try to parse it
  if (typeof location === 'string') {
    try {
      const parsed = JSON.parse(location);
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        return { lat: parsed.lat, lng: parsed.lng };
      }
    } catch (e) {
      console.error('Failed to parse location string:', location, e);
      return null;
    }
  }
  
  // If location is an object, check if it has valid lat/lng properties
  if (
    typeof location === 'object' && 
    location !== null &&
    typeof location.lat === 'number' && 
    typeof location.lng === 'number'
  ) {
    return { lat: location.lat, lng: location.lng };
  }
  
  console.warn('Invalid location format:', location);
  return null;
}

// Main MapView component props
interface MapViewProps {
  bars: KavaBar[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

export default function MapView({
  bars,
  center,
  zoom = 10,
  className,
}: MapViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [validBars, setValidBars] = useState<KavaBar[]>([]);
  const location = useLocationContext();
  
  // Use the provided center, user coordinates, or default Google Maps format location
  const mapCenter = center || location.googleMapsLocation;
  
  // Process bars to ensure all have valid locations
  useEffect(() => {
    if (!bars || bars.length === 0) {
      console.log("No bars provided to map view");
      setValidBars([]);
      return;
    }
    
    console.log(`Processing ${bars.length} bars for map display`);
    
    // Filter bars to only those with valid locations
    const barsWithValidLocations = bars.filter(bar => {
      const location = parseLocation(bar.location);
      return location !== null;
    });
    
    console.log(`Found ${barsWithValidLocations.length} bars with valid locations out of ${bars.length}`);
    setValidBars(barsWithValidLocations);
    
    // If we have valid bars but fewer than the total, log the problematic ones
    if (barsWithValidLocations.length < bars.length && barsWithValidLocations.length > 0) {
      const problemBars = bars.filter(bar => {
        const location = parseLocation(bar.location);
        return location === null;
      });
      
      console.log("Sample of bars with invalid locations:", 
        problemBars.slice(0, 3).map(b => ({
          id: b.id,
          name: b.name,
          location: b.location,
          type: b.location ? typeof b.location : 'null'
        }))
      );
    }
  }, [bars]);

  // Force reload the map tiles to ensure proper rendering
  useEffect(() => {
    // Set up a resize event listener to fix map rendering issues
    const handleResize = () => {
      console.log("Window resize detected, refreshing map");
      window.dispatchEvent(new Event("resize"));
    };

    window.addEventListener("resize", handleResize);

    // Force reload the map tiles after a short delay
    const reloadTimer = setTimeout(() => {
      if (document.querySelector(".leaflet-container")) {
        console.log("Map container found, forcing tile reload");
        window.dispatchEvent(new Event("resize"));
      }
    }, 1000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(reloadTimer);
    };
  }, []);

  // Safety timeout to prevent infinite loading state
  useEffect(() => {
    // Set a timeout to ensure loading screen doesn't stay indefinitely
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log("Map still loading after timeout, forcing ready state");
        setIsLoading(false);
      }
    }, 8000); // 8 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Debugging information
  useEffect(() => {
    console.log("Map component rendering with:", {
      originalBarsCount: bars.length,
      validBarsCount: validBars.length,
      mapCenter,
      userCoordinates: location.coordinates
    });
    
    // Log first few valid bars for debugging
    if (validBars.length > 0) {
      console.log("First 3 valid bars:", validBars.slice(0, 3).map(bar => ({
        id: bar.id,
        name: bar.name,
        location: parseLocation(bar.location),
        address: bar.address
      })));
    }
  }, [bars, validBars, mapCenter, location.coordinates]);

  // If we don't have valid bars, show an appropriate message
  if (validBars.length === 0 && !isLoading) {
    return (
      <div className="map-outer-container">
        <div className="h-full w-full flex items-center justify-center bg-muted/10">
          <div className="text-center p-6">
            <h3 className="text-lg font-medium">No Bar Locations Available</h3>
            <p className="text-muted-foreground mt-2">
              No bars with valid location data could be found in this area.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-outer-container relative h-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading map...</p>
        </div>
      )}

      {mapError && (
        <div className="absolute top-2 left-2 right-2 z-10 bg-destructive/90 text-destructive-foreground p-2 rounded">
          <p>{mapError}</p>
        </div>
      )}

      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={zoom}
        scrollWheelZoom={true}
        dragging={true}
        className={`h-full w-full ${className || ''}`}
        whenReady={() => {
          console.log("Map is ready");
          setIsLoading(false);
        }}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <MapUpdater center={mapCenter} zoom={zoom} />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
          subdomains={["a", "b", "c"]}
          eventHandlers={{
            loading: () => {
              console.log("Tiles loading...");
              setIsLoading(true);
            },
            load: () => {
              console.log("Tiles loaded successfully");
              setIsLoading(false);
              setMapError(null);
            },
            error: (e: any) => {
              console.error("Tile loading error:", e);
              setMapError("Unable to load map tiles. Check your internet connection.");
            },
          }}
        />

        {/* Cluster group for bar markers */}
        <MarkerClusterGroup chunkedLoading>
          {validBars.map((bar) => {
            const location = parseLocation(bar.location);
            if (!location) return null;
            
            return (
              <Marker
                key={bar.id}
                position={[location.lat, location.lng]}
                icon={bar.isSponsored ? SponsoredBarIcon : BarMarkerIcon}
                eventHandlers={{
                  click: () => {
                    console.log("Bar marker clicked:", bar.name);
                  }
                }}
              >
                <Popup>
                  <div className="text-center">
                    <h3 className="font-medium">{bar.name}</h3>
                    <p className="text-xs mt-1">{bar.address}</p>
                    {bar.rating && (
                      <p className="text-sm mt-1">
                        Rating: {bar.rating.toString()}★
                      </p>
                    )}
                    <a
                      href={`/kava-bars/${bar.id}`}
                      className="inline-block mt-2 text-sm bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90 transition-colors"
                    >
                      View Details
                    </a>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {/* User location marker */}
        {location.coordinates && (
          <Marker
            position={[location.coordinates.latitude, location.coordinates.longitude]}
            icon={UserLocationIcon}
            eventHandlers={{
              click: () => {
                console.log("User location marker clicked");
              }
            }}
          >
            <Popup>
              <div className="text-center">
                <h3 className="font-medium">Your Location</h3>
                <p className="text-xs mt-1">
                  {location.coordinates.accuracy ? 
                    `Accuracy: ~${Math.round(location.coordinates.accuracy)} meters` : 
                    'Location accuracy unknown'}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}