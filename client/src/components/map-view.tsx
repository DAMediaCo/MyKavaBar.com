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
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> contributors',
    maxZoom: 19
  },
  {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  },
  {
    name: "OSM.de",
    url: "https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
  },
  {
    name: "Stamen Terrain",
    url: "https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg",
    attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>',
    maxZoom: 18
  },
  {
    name: "CyclOSM",
    url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 20
  }
];

// Embedded marker data as base64 to avoid external dependencies
const markerIconBase64 = "data:image/png;base64,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";
const markerShadowBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAApCAYAAACoYAD2AAAC5ElEQVRYw+2YW4/TMBCF45S0S1luXZCABy5CgLQgwf//S4BYBLTdJLax0fFqmB07nnQfEGqkIydpVH85M+NLjPe++dcPc4Q8Qh4hj5D/AaQJx6H/4TMwB0PeBNwU7EGQAmAtsNfAzoZkgIa0ZgLMa4Aj6CxIAsjhjOCoL5PP4nwLGXFGdHqw5+FjDHxGtK42TFaQQjyEcwDnowXXGr6wDM3oCko96GdRNoCzEM+j6MA4cfMpGO4UCEXni4gc+VlMZhrQdRt8COLL/Su79VeEo3Ky5dRJvvla5uaeFCL1aTQkI6OeoG+xs6WVRFIkEQS0XsU2RyrhIM+QFzogLJhk3QJR6kl/7KSIxMGO6Jm8yuT5FfQWXFGDF3KpW4hDkIY66We+oE5cqthK6gXrh9Po80mk7ZKLAzfc3T1jcbvfA2PW68FeebZBPdHaU0V+gFrbc3epYar5Z5B0XICvIVZsW2tLqzgw7QIWM/0Sptev9mC3lrNQqW3ZPQCxJ6Pl1qo2T2mZ4a5szJfQYzXnGx9QLiIyVh+VpO2RJzNdQtNXlxB+8zcbg7GZNfK3AMfgqZXJle1XnSdAJ7tqleoP1a4TfORycc+XQ1ZnpAHKxpuyOZPQCeJ8FFiaQ95PXzQtC0YnrTnnGNmFsBtjgPwGm1Xu5D0A/ycUxo2YhgAAAABJRU5ErkJggg==";
const markerIconRetinaBase64 = "data:image/png;base64,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";

// Fix Leaflet icon issues - using embedded data instead of external URLs
// This prevents potential network failures and cross-origin issues
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconBase64,
  shadowUrl: markerShadowBase64,
  iconRetinaUrl: markerIconRetinaBase64
});

// Create simple dot icons instead of SVG for better browser compatibility
const userIcon = L.divIcon({
  className: "user-location-marker",
  html: '<div style="background-color:#0066FF; width:14px; height:14px; border-radius:50%; border:2px solid white;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -9],
});

const barIcon = L.divIcon({
  className: "kava-bar-marker",
  html: '<div style="background-color:#FF0000; width:14px; height:14px; border-radius:50%; border:2px solid white;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -9],
});

interface MapViewProps {
  bars: KavaBar[];
  center?: { lat: number; lng: number };
  zoom?: number;
  userLocation?: { lat: number; lng: number };
}

function MapUpdater({
  center,
  zoom,
}: {
  center?: { lat: number; lng: number };
  zoom?: number;
}) {
  const map = useMap();
  const initialSetupRef = useRef(true);
  const prevCenter = useRef(center);

  useEffect(() => {
    // Only set view on initial setup or when center actually changes
    if (initialSetupRef.current && center) {
      map.setView([center.lat, center.lng], zoom || map.getZoom());
      initialSetupRef.current = false;
      prevCenter.current = center;
    } else if (
      center &&
      (!prevCenter.current ||
        center.lat !== prevCenter.current.lat ||
        center.lng !== prevCenter.current.lng)
    ) {
      map.setView([center.lat, center.lng], map.getZoom());
      prevCenter.current = center;
    }
  }, [center, zoom, map]);

  return null;
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

export default function MapView({
  bars,
  center,
  zoom = 4,
  userLocation,
}: MapViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [activeTileProvider, setActiveTileProvider] = useState(0);
  const [tileLoadError, setTileLoadError] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const defaultCenter = center || { lat: 39.8283, lng: -98.5795 }; // Default to center of US

  // Force map resize when window changes size
  useEffect(() => {
    const handleResize = () => {
      console.log("Window resize detected, refreshing map");
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    window.addEventListener("resize", handleResize);
    
    // Force the map to refresh after it loads
    const forceRefresh = setTimeout(() => {
      handleResize();
    }, 1000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(forceRefresh);
    };
  }, []);

  // Debug information
  useEffect(() => {
    console.log("Map component rendering with:", {
      barsCount: bars.length,
      center: defaultCenter,
      userLocation,
    });
  }, [bars, defaultCenter, userLocation]);

  // Safety timeout to prevent indefinite loading state
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log("Map still loading after timeout, forcing ready state");
        setIsLoading(false);
      }
    }, 5000); // Faster 5 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Reset tile load error when active provider changes
  useEffect(() => {
    setTileLoadError(false);
    console.log(`Using tile provider: ${tileProviders[activeTileProvider].name}`);
  }, [activeTileProvider]);

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
      
      {/* Map provider information with fallback status */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-black/30 text-white text-xs px-2 py-1 rounded shadow">
        Map: {tileProviders[activeTileProvider].name}
        {tileLoadError && (
          <span className="text-amber-500 ml-1">(fallback active)</span>
        )}
      </div>

      <MapContainer
        center={[defaultCenter.lat, defaultCenter.lng]}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="h-full w-full"
        whenReady={() => {
          console.log("Map is ready");
          setIsLoading(false);
        }}
        ref={mapRef}
      >
        <MapUpdater center={center} zoom={zoom} />

        {/* Implement a fallback system with multiple tile providers */}
        <TileLayer
          key={`tile-layer-${activeTileProvider}`}
          url={tileProviders[activeTileProvider].url}
          attribution={tileProviders[activeTileProvider].attribution}
          maxZoom={tileProviders[activeTileProvider].maxZoom}
          errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAAD2e2DtAAAAh0lEQVR42u3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPwZcwAAAQ+QoLUAAAAASUVORK5CYII="
          eventHandlers={{
            tileerror: () => {
              console.log(`Tile provider ${activeTileProvider} (${tileProviders[activeTileProvider].name}) failed, trying next provider`);
              setTileLoadError(true);
              // Try the next provider
              const nextProvider = (activeTileProvider + 1) % tileProviders.length;
              if (nextProvider !== activeTileProvider) {
                setActiveTileProvider(nextProvider);
              }
            },
          }}
        />
        
        {/* Provider indicator - shows which map provider is currently active */}
        <div className="map-provider-indicator">
          <div className="absolute bottom-2 right-2 bg-white/80 text-xs rounded px-2 py-1 shadow z-[1000] backdrop-blur-sm">
            Map: <strong>{tileProviders[activeTileProvider].name}</strong>
            {tileLoadError && (
              <span className="ml-1 text-amber-600 animate-pulse"> (Switching providers...)</span>
            )}
          </div>
        </div>
        
        {/* Location indicator/control */}
        {!userLocation && (
          <div className="absolute top-2 right-2 bg-white/90 rounded px-3 py-2 shadow z-[1000] backdrop-blur-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
            <span className="text-xs text-gray-700">Location not enabled</span>
          </div>
        )}

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userIcon}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-medium">Your Location</h3>
              </div>
            </Popup>
          </Marker>
        )}

        {bars.map((bar) => {
          const location = parseLocation(bar.location);
          if (!location) {
            return null;
          }

          return (
            <Marker
              key={bar.id}
              position={[location.lat, location.lng]}
              icon={barIcon}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-medium">{bar.name}</h3>
                  <p className="text-sm mt-1">{bar.address}</p>
                  {bar.phone && <p className="text-sm mt-1">{bar.phone}</p>}
                  {userLocation && (
                    <p className="text-sm mt-1 text-muted-foreground">
                      {calculateDistance(
                        userLocation.lat,
                        userLocation.lng,
                        location.lat,
                        location.lng,
                      ).toFixed(1)}{" "}
                      miles away
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
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
