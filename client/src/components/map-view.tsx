import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { KavaBar } from '@/hooks/use-kava-bars';
import { Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './map-styles.css';
import L from 'leaflet';

// Fix for Leaflet default icon paths by using static URLs
// This ensures the images are available regardless of build configuration
let DefaultIcon = L.icon({
  iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Set the default icon for all markers
L.Marker.prototype.options.icon = DefaultIcon;

// Create simple dot icons instead of SVG for better browser compatibility
const userIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<div style="background-color:#0066FF; width:14px; height:14px; border-radius:50%; border:2px solid white;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -9]
});

const barIcon = L.divIcon({
  className: 'kava-bar-marker',
  html: '<div style="background-color:#FF0000; width:14px; height:14px; border-radius:50%; border:2px solid white;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -9]
});

interface MapViewProps {
  bars: KavaBar[];
  center?: { lat: number; lng: number };
  zoom?: number;
  userLocation?: { lat: number; lng: number };
}

function MapUpdater({ center, zoom }: { center?: { lat: number; lng: number }, zoom?: number }) {
  const map = useMap();
  const initialSetupRef = useRef(true);
  const prevCenter = useRef(center);

  useEffect(() => {
    // Only set view on initial setup or when center actually changes
    if (initialSetupRef.current && center) {
      map.setView([center.lat, center.lng], zoom || map.getZoom());
      initialSetupRef.current = false;
      prevCenter.current = center;
    } else if (center && (!prevCenter.current || 
      center.lat !== prevCenter.current.lat || 
      center.lng !== prevCenter.current.lng)) {
      map.setView([center.lat, center.lng], map.getZoom());
      prevCenter.current = center;
    }
  }, [center, zoom, map]);

  return null;
}

function parseLocation(location: any): { lat: number, lng: number } | null {
  if (!location) return null;

  try {
    if (typeof location === 'string') {
      location = JSON.parse(location);
    }

    const lat = Number(location.lat);
    const lng = Number(location.lng);

    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90) return null;
    if (lng < -180 || lng > 180) return null;

    return { lat, lng };
  } catch (e) {
    console.error('Failed to parse location:', e);
    return null;
  }
}

export default function MapView({ bars, center, zoom = 4, userLocation }: MapViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLeafletLoaded, setIsLeafletLoaded] = useState<boolean>(true); // Assume Leaflet is loaded
  const defaultCenter = center || { lat: 39.8283, lng: -98.5795 }; // Default to center of US
  
  // Force reload the map tiles to ensure proper rendering
  useEffect(() => {
    // Set up a resize event listener to fix map rendering issues
    const handleResize = () => {
      console.log('Window resize detected, refreshing map');
    };
    
    window.addEventListener('resize', handleResize);
    
    // Force reload the map tiles after a short delay
    const reloadTimer = setTimeout(() => {
      if (document.querySelector('.leaflet-container')) {
        console.log('Map container found, forcing tile reload');
        window.dispatchEvent(new Event('resize'));
      }
    }, 1000);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(reloadTimer);
    };
  }, []);
  
  // Debugging information
  useEffect(() => {
    console.log('Map component rendering with:', {
      barsCount: bars.length,
      center: defaultCenter,
      userLocation,
      leafletLoaded: isLeafletLoaded
    });
  }, [bars, defaultCenter, userLocation, isLeafletLoaded]);

  useEffect(() => {
    // Set a timeout to ensure loading screen doesn't stay indefinitely
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log('Map still loading after timeout, forcing ready state');
        setIsLoading(false);
      }
    }, 5000); // 5 second timeout
    
    return () => clearTimeout(timeout);
  }, [isLoading]);

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

      <MapContainer
        center={[defaultCenter.lat, defaultCenter.lng]}
        zoom={zoom}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
        whenReady={() => {
          console.log('Map is ready');
          setIsLoading(false);
        }}
        className="h-full w-full"
      >
        <MapUpdater center={center} zoom={zoom} />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          subdomains={['a', 'b', 'c']}
          eventHandlers={{
            loading: () => {
              console.log('Tiles loading...');
              setIsLoading(true);
            },
            load: () => {
              console.log('Tiles loaded successfully');
              setIsLoading(false);
              setMapError(null);
              
              // Double-check that the map rendered properly
              setTimeout(() => {
                const mapContainer = document.querySelector('.leaflet-container');
                if (mapContainer) {
                  const tilesLoaded = document.querySelectorAll('.leaflet-tile').length > 0;
                  if (!tilesLoaded) {
                    console.log('Tiles not visible, triggering resize');
                    window.dispatchEvent(new Event('resize'));
                  }
                }
              }, 500);
            },
            error: (e) => {
              console.error('Error loading tiles:', e);
              
              // Try alternative tile source
              console.log('Attempting to use fallback tile source');
              try {
                const tileLayer = e.target;
                // Use fallback tile source
                if (tileLayer && typeof tileLayer.setUrl === 'function') {
                  tileLayer.setUrl("https://tile.openstreetmap.de/{z}/{x}/{y}.png");
                  console.log('Switched to fallback tile source');
                } else {
                  throw new Error('Cannot switch tile source');
                }
              } catch (err) {
                console.error('Failed to use fallback source:', err);
                setMapError('Failed to load map tiles. Please try again later.');
                setIsLoading(false);
              }
            },
          }}
        />

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
                  {bar.phone && (
                    <p className="text-sm mt-1">{bar.phone}</p>
                  )}
                  {userLocation && (
                    <p className="text-sm mt-1 text-muted-foreground">
                      {calculateDistance(
                        userLocation.lat,
                        userLocation.lng,
                        location.lat,
                        location.lng
                      ).toFixed(1)} miles away
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

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}