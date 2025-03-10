import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './map-styles.css';
import type { KavaBar } from '@/hooks/use-kava-bars';

// Fix Leaflet icon path issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix the icon paths issues
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom rating component for the popup
const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center">
      {[...Array(fullStars)].map((_, i) => (
        <span key={`full-${i}`} className="text-yellow-500">★</span>
      ))}
      {hasHalfStar && <span className="text-yellow-500">⯨</span>}
      {[...Array(emptyStars)].map((_, i) => (
        <span key={`empty-${i}`} className="text-gray-300">★</span>
      ))}
      <span className="ml-1 text-xs font-medium">{rating.toFixed(1)}</span>
    </div>
  );
};

// Component to recenter the map when props change
function SetViewOnChange({ center, zoom }: { center?: [number, number], zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);

  return null;
}

interface MapViewProps {
  bars: KavaBar[];
  center?: { lat: number; lng: number };
  zoom?: number;
  userLocation?: { lat: number; lng: number } | null;
  onMarkerClick?: (bar: KavaBar) => void;
}

const MapView: React.FC<MapViewProps> = ({ 
  bars, 
  center, 
  zoom = 10, 
  userLocation,
  onMarkerClick
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([28.5383, -81.3792]); // Orlando as default
  const [mapZoom, setMapZoom] = useState(zoom);
  const mapRef = useRef<L.Map | null>(null);

  // Update map center when props change
  useEffect(() => {
    if (center) {
      setMapCenter([center.lat, center.lng]);
    } else if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
    } else if (bars.length > 0 && bars[0].latitude && bars[0].longitude) {
      setMapCenter([bars[0].latitude, bars[0].longitude]);
    }
  }, [center, userLocation, bars]);

  // Adjust zoom based on props
  useEffect(() => {
    setMapZoom(zoom);
  }, [zoom]);

  // Handle map errors
  const handleMapError = (error: any) => {
    console.error("Map loading error:", error);
  };

  return (
    <div className="map-container">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        whenCreated={(map) => {
          mapRef.current = map;
          console.log("Map created successfully");
        }}
        whenReady={() => console.log("Map is ready")}
        className="z-0" // Lower z-index to prevent map from overlapping UI elements
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            loading: () => console.log("Tiles are loading"),
            load: () => console.log("Tiles loaded successfully"),
            error: handleMapError
          }}
        />

        <SetViewOnChange center={mapCenter} zoom={mapZoom} />

        {/* User location marker */}
        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={new L.Icon({
              iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
              shadowUrl: iconShadow,
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
            })}
          >
            <Popup>
              <div className="font-medium text-blue-600">Your Location</div>
            </Popup>
          </Marker>
        )}

        {/* Kava bar markers */}
        {bars.map((bar) => {
          if (!bar.latitude || !bar.longitude) return null;
          console.log(`Rendering bar ${bar.name}:`, { rating: bar.rating, ratingType: typeof bar.rating, address: bar.address });

          return (
            <Marker 
              key={bar.id} 
              position={[bar.latitude, bar.longitude]}
              eventHandlers={{
                click: () => {
                  if (onMarkerClick) {
                    onMarkerClick(bar);
                  }
                }
              }}
            >
              <Popup>
                <div className="popup-content">
                  <h3 className="font-bold text-md">{bar.name}</h3>
                  <p className="text-sm text-gray-600">{bar.address}</p>
                  {bar.rating > 0 && <StarRating rating={bar.rating} />}
                  {bar.phone && (
                    <p className="text-sm mt-1">
                      <a href={`tel:${bar.phone}`} className="text-blue-500 hover:underline">
                        {bar.phone}
                      </a>
                    </p>
                  )}
                  {bar.website && (
                    <p className="text-sm mt-1">
                      <a 
                        href={bar.website.startsWith('http') ? bar.website : `https://${bar.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        Visit Website
                      </a>
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
};

export default MapView;