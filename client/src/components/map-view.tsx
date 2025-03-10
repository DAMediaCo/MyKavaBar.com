import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from "react-leaflet";
import type { KavaBar } from "@/hooks/use-kava-bars";
import { Loader2, AlertTriangle } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./map-styles.css";
import L from "leaflet";

// Define multiple tile providers for fallback capability
const tileProviders = [
  {
    name: "Carto",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  {
    name: "Stadia Maps",
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
];

// Fix for Leaflet default icon issues
const defaultIcon = new L.Icon({
  iconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFgUlEQVR4Aa1XA5BjWRTN2oW17d3YaZtr2962HUzbDNpjszW24mRt28p47v7zq/bXZtrp/lWnXr337j3nPCe/meEEhMkNybdLO6MfF9cLBeaSJ1oHJDunCerCm/B0+zA9gQEEiNZJdBgBGA8MhGZuwvCjQUw487tgFQyjv8SYw8CAVS1Q9WedKBjljJSYAbOGUtgL7bcXn2MR5GlQ5JoM8k/KfvSgW+ZA7n1/O5vR0/pnPxMjVLGcmUDm8z//J0E3ulEaoQQSxSOqR+aWJtXWdlVSJzeZEjUcWaUSiY5i6HmtjXYqXDbkjErGX8PptCIzFMB3jeEqMRbL6JoyYP4mZSd67BcDlGTc9xJhMQB5U14SYCzKWtvHovTtFrwK7YdIHNoIQlJG2UBCPYynMRbLK9FYp2xxMUXQ0dQ9YJe05X/lKCFuA8EwVX8XvgWCuXCsAzwJTRJIceKFk++R65aMBHO5+cJwblyvYhnJoJyHCgOYNmLjPhWXiAkqhJJ/mc0Z5sHpzU9s1QAmNXQKPAYvJYyD8YJO4Na0Eub0iEyQI1OchW50TIrYl4eGcK5+NSxXpY/r8W3KbEGib4j/JkCQcU9OjIIPWttk9BjXfu0mPEFu",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAApCAQAAAACach9AAACMUlEQVR4Ae3ShY7jQBAE0Aoz/f9/HTMzhg1zrdKUrJbdx+Kd2nD8VNudfsL/Th///dyQN2TH6f3y/BGpC379rV+S+qqetBOxImNQXL8JCAr2V4iMQXHGNJxeCfZXhSRBcQMfvkOWUdtfzlLgAENmZDcmo2TVmt8OSM2eXxBp3DjHSMFutqS7SbmemzBiR+xpKCNUIRkdkkYxhAkyGoBvyQFEJEefwSmmvBfJuJ6aKqKWnAkvGZOaZXTUgFqYULWNSHUckZuR1HIIimUExutRxwzOLROIG4vKmCKQt364mIlhSyzAf1m9lHZHJZrlAOMMztRRiKimp/rpdJDc9Awry5xTZCte7FHtuS8wJgeYGrex28xNTd086Dik7vUMscQOa8y4DoGtCCSkAKlNwpgNtphjrC6MIHUkR6YWxxs6Sc5xqn222mmCRFzIt8lEdKx+ikCtg91qS2WpwVfBelJCiQJwvzixfI9cxZQWgiSJelKnwBElKYtDOb2MFbhmUigbReQBV0Cg1Sg8w4SUyYWspo9fF+Lu0J5qkYdMgUctIGPMXgAlyHTRBs4sVn7Bnsc473AqkDZkMgpZNAR5MQszDpqQrZVSg6KRHRtGjrUKGWFpAH4mRLbrZA0LmrindwvLyu+0Hy7Ptn2fTNFu1Kdo1X7Ysx9w/A/SAXhH6QssIAAAAASUVORK5CYII="
});

// Active marker icon for highlighting selected kava bar
const activeIcon = new L.Icon({
  iconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAGmklEQVR4Aa1XA5AjWRTN2oW17d3YaZtr2962HUzbDNpjszW24mRt28p47v7zq/bXZtrp/lWnXr337j3nPCe/meEEhMkNybdLO6MfF9cLBeaSJ1oHJDunCerCm/B0+zA9gQEEiNZJdBgBGA8MhGZuwvCjQUw487tgFQyjv8SYw8CAVS1Q9WedKBjljJSYAbOGUtgL7bcXn2MR5GlQ5JoM8k/KfvSgW+ZA7n1/O5vR0/pnPxMjVLGcmUDm8z//J0E3ulEaoQQSxSOqR+aWJtXWdlVSJzeZEjUcWaUSiY5i6HmtjXYqXDbkjErGX8PptCIzFMB3jeEqMRbL6JoyYP4mZSd67BcDlGTc9xJhMQB5U14SYCzKWtvHovTtFrwK7YdIHNoIQlJG2UBCPYynMRbLK9FYp2xxMUXQ0dQ9YJe05X/lKCFuA8EwVX8XvgWCuXCsAzwJTRJIceKFk++R65aMBHO5+cJwblyvYhnJoJyHCgOYNmLjPhWXiAkqhJJ/mc0Z5sHpzU9s1QAmNXQKPAYvJYyD8YJO4Na0Eub0iEyQI1OchW50TIrYl4eGcK5+NSxXpY/r8W3KbEGib4j/JkCQcU9OjIIPWttk9BjXfu0mPEFu",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAApCAQAAAACach9AAACMUlEQVR4Ae3ShY7jQBAE0Aoz/f9/HTMzhg1zrdKUrJbdx+Kd2nD8VNudfsL/Th///dyQN2TH6f3y/BGpC379rV+S+qqetBOxImNQXL8JCAr2V4iMQXHGNJxeCfZXhSRBcQMfvkOWUdtfzlLgAENmZDcmo2TVmt8OSM2eXxBp3DjHSMFutqS7SbmemzBiR+xpKCNUIRkdkkYxhAkyGoBvyQFEJEefwSmmvBfJuJ6aKqKWnAkvGZOaZXTUgFqYULWNSHUckZuR1HIIimUExutRxwzOLROIG4vKmCKQt364mIlhSyzAf1m9lHZHJZrlAOMMztRRiKimp/rpdJDc9Awry5xTZCte7FHtuS8wJgeYGrex28xNTd086Dik7vUMscQOa8y4DoGtCCSkAKlNwpgNtphjrC6MIHUkR6YWxxs6Sc5xqn222mmCRFzIt8lEdKx+ikCtg91qS2WpwVfBelJCiQJwvzixfI9cxZQWgiSJelKnwBElKYtDOb2MFbhmUigbReQBV0Cg1Sg8w4SUyYWspo9fF+Lu0J5qkYdMgUctIGPMXgAlyHTRBs4sVn7Bnsc473AqkDZkMgpZNAR5MQszDpqQrZVSg6KRHRtGjrUKGWFpAH4mRLbrZA0LmrindwvLyu+0Hy7Ptn2fTNFu1Kdo1X7Ysx9w/A/SAXhH6QssIAAAAASUVORK5CYII="
});

// TileLayer component that handles fallbacks
function TileLayerWithFallback() {
  const [currentProvider, setCurrentProvider] = useState(0);
  const [tileLoadError, setTileLoadError] = useState(false);
  const [tileLoaded, setTileLoaded] = useState(false);
  const map = useMap();

  // Handle tile loading errors
  const handleTileError = () => {
    console.log(`Tile provider ${tileProviders[currentProvider].name} failed to load`);
    setTileLoadError(true);

    if (currentProvider < tileProviders.length - 1) {
      console.log("Switching to next provider");
      setCurrentProvider(prev => prev + 1);
    } else {
      console.error("All tile providers failed");
    }
  };

  // Handle successful tile loading
  const handleTileLoad = () => {
    console.log(`Tile provider ${tileProviders[currentProvider].name} loaded successfully`);
    setTileLoaded(true);
    setTileLoadError(false);
  };

  // Force map to recalculate size on provider change
  useEffect(() => {
    if (map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }

    // Reset error state when changing provider
    setTileLoadError(false);
    setTileLoaded(false);
  }, [currentProvider, map]);

  // Force map refresh on a timer to handle container issues
  useEffect(() => {
    const interval = setInterval(() => {
      if (map) {
        map.invalidateSize();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [map]);

  const provider = tileProviders[currentProvider];

  return (
    <>
      <div className="absolute bottom-1 left-1 z-[999] bg-white/80 px-2 py-1 rounded text-xs backdrop-blur-sm">
        <div className="flex items-center">
          <span className="font-medium">{provider.name}</span>
          {tileLoaded && <span className="ml-1 text-green-600">✓</span>}
          {tileLoadError && (
            <span className="ml-1 text-amber-600 animate-pulse"> (Switching providers...)</span>
          )}
        </div>
      </div>

      <TileLayer
        attribution={provider.attribution}
        url={provider.url}
        eventHandlers={{
          tileerror: handleTileError,
          load: handleTileLoad,
        }}
      />
    </>
  );
}

interface MapViewProps {
  bars: KavaBar[];
  activeBar?: KavaBar | null;
  onSelectBar?: (bar: KavaBar) => void;
  userLocation?: { lat: number; lng: number } | null;
  isLoading?: boolean;
  className?: string;
}

export function MapView({
  bars,
  activeBar,
  onSelectBar,
  userLocation,
  isLoading = false,
  className = "",
}: MapViewProps) {
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Default center (Florida) if no user location
  const defaultCenter = { lat: 27.9944, lng: -81.7603 };
  const center = userLocation || defaultCenter;

  // Handle map creation
  const handleMapCreated = (map: L.Map) => {
    mapRef.current = map;
    setIsMapReady(true);

    // Force initial size calculation after slight delay
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  };

  // Fly to user location when it becomes available
  useEffect(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.flyTo([userLocation.lat, userLocation.lng], 11, {
        animate: true,
        duration: 1
      });
    }
  }, [userLocation]);

  // Fly to active bar when it changes
  useEffect(() => {
    if (mapRef.current && activeBar?.latitude && activeBar?.longitude) {
      mapRef.current.flyTo(
        [activeBar.latitude, activeBar.longitude],
        13,
        { animate: true, duration: 0.8 }
      );
    }
  }, [activeBar]);

  // Check for map loading issues
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isMapReady) {
        console.error("Map failed to initialize in reasonable time");
        setMapError("Map failed to load. Please refresh the page.");
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [isMapReady]);

  // Create market for each kava bar
  const renderMarkers = () => {
    return bars.map((bar) => {
      if (!bar.latitude || !bar.longitude) return null;

      const isActive = activeBar?.id === bar.id;

      return (
        <Marker
          key={bar.id}
          position={[bar.latitude, bar.longitude]}
          icon={isActive ? activeIcon : defaultIcon}
          eventHandlers={{
            click: () => {
              if (onSelectBar) onSelectBar(bar);
            },
          }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{bar.name}</div>
              <div className="text-gray-600">{bar.address}</div>
              {bar.rating && (
                <div className="text-amber-500">
                  {bar.rating} ★ 
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      );
    });
  };

  return (
    <div className={`relative rounded-lg overflow-hidden ${className}`}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-[1000]">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm font-medium">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {mapError && (
        <div className="absolute inset-0 bg-red-50/90 flex items-center justify-center z-[1000]">
          <div className="flex flex-col items-center p-4 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <p className="mt-2 text-sm font-medium text-red-700">{mapError}</p>
            <button 
              className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 rounded text-red-700 text-sm"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
          </div>
        </div>
      )}

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={userLocation ? 11 : 7}
        className="h-full w-full z-0"
        zoomControl={false}
        whenCreated={handleMapCreated}
      >
        <ZoomControl position="bottomright" />
        <TileLayerWithFallback />

        {/* User location marker */}
        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={new L.Icon({
              iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234338ca' width='32' height='32'%3E%3Ccircle cx='12' cy='12' r='10' stroke='white' stroke-width='2'/%3E%3Ccircle cx='12' cy='12' r='4' fill='white'/%3E%3C/svg%3E",
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            })}
          >
            <Popup>
              <div className="text-sm font-medium">Your Location</div>
            </Popup>
          </Marker>
        )}

        {/* Render all kava bar markers */}
        {renderMarkers()}
      </MapContainer>

      {/* Location indicator/control */}
      {!userLocation && (
        <div className="absolute top-2 right-2 bg-white/90 rounded px-3 py-2 shadow z-[1000] backdrop-blur-sm flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
          <span className="text-xs text-gray-700">Location not enabled</span>
        </div>
      )}
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