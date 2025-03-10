import React, { useEffect, useRef, useState } from 'react';
import './map-styles.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon paths
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix the icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: icon,
  iconRetinaUrl: icon,
  shadowUrl: iconShadow,
});

interface Bar {
  id: number;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  rating?: number;
  photos?: string[];
}

interface MapViewProps {
  bars: Bar[];
  center: { lat: number; lng: number };
  zoom: number;
  userLocation?: { lat: number; lng: number };
}

const MapView: React.FC<MapViewProps> = ({ bars, center, zoom, userLocation }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    try {
      console.log('Initializing map...');

      // Only initialize once
      if (!leafletMap.current) {
        // Create map
        leafletMap.current = L.map(mapRef.current, {
          center: [center.lat, center.lng],
          zoom: zoom,
          zoomControl: true,
          attributionControl: true
        });

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(leafletMap.current);

        console.log('Map initialized successfully');
        setMapLoaded(true);
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    // Cleanup function
    return () => {
      if (leafletMap.current) {
        console.log('Cleaning up map...');
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [center, zoom]);

  // Add markers when map is loaded and when bars change
  useEffect(() => {
    if (!leafletMap.current || !mapLoaded) return;

    try {
      console.log('Adding markers to map...');

      // Clear existing markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      // Add bar markers
      bars.forEach((bar) => {
        if (bar.lat && bar.lng) {
          const marker = L.marker([bar.lat, bar.lng])
            .addTo(leafletMap.current!)
            .bindPopup(`
              <b>${bar.name}</b><br/>
              ${bar.address}<br/>
              ${bar.rating ? `Rating: ${bar.rating}` : ''}
            `);

          markersRef.current.push(marker);
        }
      });

      // Add user location marker if provided
      if (userLocation) {
        const userMarker = L.marker(
          [userLocation.lat, userLocation.lng],
          {
            icon: new L.Icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
              shadowUrl: iconShadow,
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            })
          }
        )
          .addTo(leafletMap.current)
          .bindPopup('Your location');

        markersRef.current.push(userMarker);
      }

      console.log(`Added ${markersRef.current.length} markers to map`);
    } catch (error) {
      console.error('Error adding markers to map:', error);
    }
  }, [bars, userLocation, mapLoaded]);

  // Update map center when it changes
  useEffect(() => {
    if (leafletMap.current && mapLoaded) {
      leafletMap.current.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom, mapLoaded]);

  return (
    <div className="map-container">
      <div 
        ref={mapRef} 
        className="leaflet-container" 
        data-testid="map-container"
      />
    </div>
  );
};

export default MapView;