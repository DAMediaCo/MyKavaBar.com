
import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./map-styles.css";
import { Bar } from "@/types/bar";
import { Loader2, AlertTriangle } from "lucide-react";

// Fix Leaflet icon issue
// This is important because Leaflet's default icon paths get broken in bundled environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to update map view when center changes
function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && map) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
}

interface MapViewProps {
  bars: Bar[];
  center: [number, number];
  zoom: number;
  userLocation?: { lat: number; lng: number };
}

export default function MapView({ bars, center, zoom, userLocation }: MapViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  useEffect(() => {
    // Set a timeout to detect loading issues
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn("Map still loading after timeout, checking if it's available");
        if (mapRef.current) {
          setIsLoading(false);
        } else {
          setError("Map tiles failed to load within the expected time. Check your network connection.");
        }
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Handle map initialization
  const handleMapReady = (map: L.Map) => {
    console.log("Map initialized successfully");
    mapRef.current = map;
    setIsLoading(false);
  };

  useEffect(() => {
    if (mapRef.current && ref.current) {
      // Add OpenStreetMap tile layer with explicit z-index
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        zIndex: 1
      }).addTo(mapRef.current);
      
      // Force a repaint of the map
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
    }
  }, [mapRef.current]);

// Fallback if map fails to load
  if (error) {
    return (
      <div className="map-container">
        <div className="map-error">
          <div className="flex items-center mb-2">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <h3 className="font-semibold">Map Loading Error</h3>
          </div>
          <p>{error}</p>
          <div className="mt-2 text-sm">
            <p>Troubleshooting tips:</p>
            <ul className="list-disc list-inside">
              <li>Check your internet connection</li>
              <li>Verify that the map services are accessible</li>
              <li>Try refreshing the page</li>
            </ul>
          </div>
        </div>
        <div className="bg-gray-100 h-full rounded-md flex items-center justify-center">
          <p className="text-gray-500">Map visualization unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container">
      {isLoading && (
        <div className="map-loading">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground mt-2">Loading map...</p>
        </div>
      )}
      
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        whenReady={handleMapReady}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        
        <MapUpdater center={center} zoom={zoom} />
        
        {bars.map((bar) => (
          bar.location && bar.location.lat && bar.location.lng ? (
            <Marker 
              key={bar.id} 
              position={[bar.location.lat, bar.location.lng]}
            >
              <Popup>
                <div>
                  <h3 className="font-semibold">{bar.name}</h3>
                  {bar.address && <p className="text-sm">{bar.address}</p>}
                </div>
              </Popup>
            </Marker>
          ) : null
        ))}
        
        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              className: 'user-location-marker',
              html: '<div class="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })}
          >
            <Popup>Your Location</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
