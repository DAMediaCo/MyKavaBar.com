import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map-styles.css';

// Fix Leaflet icon path issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Custom marker icon setup
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Bar {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  rating?: number;
}

interface MapViewProps {
  bars: Bar[];
  center: { lat: number; lng: number };
  zoom: number;
  userLocation?: { lat: number; lng: number };
}

const MapView: React.FC<MapViewProps> = ({ bars, center, zoom, userLocation }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [mapError, setMapError] = React.useState(false);


  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Clean up any existing map
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
    }

    // Create new map
    const map = L.map(mapRef.current).setView([center.lat, center.lng], zoom);

    // Add tile layer with error handling
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    tileLayer.on('error', () => {
        setMapError(true);
    });

    // Add user location marker if available
    if (userLocation) {
      const userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: 'user-location-marker',
          html: '<div class="pulse"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(map);

      userMarker.bindPopup('Your Location').openPopup();
    }

    // Save map reference
    leafletMapRef.current = map;

    // Clean up function
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      markersRef.current = [];
    };
  }, [center, zoom]); // Only re-create map when center or zoom changes

  // Handle bars update
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    bars.forEach(bar => {
      if (bar.latitude && bar.longitude) {
        const marker = L.marker([bar.latitude, bar.longitude])
          .addTo(map)
          .bindPopup(`
            <strong>${bar.name}</strong><br>
            ${bar.address}<br>
            ${bar.rating ? `Rating: ${bar.rating}/5` : ''}
          `);

        markersRef.current.push(marker);
      }
    });
  }, [bars]); // Update markers when bars change

  if (mapError) {
    return <div>Error loading map</div>;
  }

  return <div ref={mapRef} className="leaflet-container" />;
};

export default MapView;