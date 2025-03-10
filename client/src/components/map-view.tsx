import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EyeIcon } from 'lucide-react';
import './map-styles.css';

interface MapViewProps {
  bars: any[];
  center?: { lat: number; lng: number };
  zoom?: number;
  userLocation?: { lat: number; lng: number };
}

const MapView: React.FC<MapViewProps> = ({ 
  bars = [], 
  center = { lat: 26.7056, lng: -80.0364 }, // Default to West Palm Beach
  zoom = 10,
  userLocation
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [tileFallbackIndex, setTileFallbackIndex] = useState(0);

  // Multiple tile sources in case one fails
  const tileSources = [
    {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  ];

  // Create map instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map if it doesn't exist
    if (!mapRef.current) {
      console.log('Initializing map with center:', center, 'and zoom:', zoom);
      try {
        // Create map instance
        mapRef.current = L.map(mapContainerRef.current).setView(
          [center.lat, center.lng], 
          zoom
        );

        // Add tile layer using current fallback index
        const currentTileSource = tileSources[tileFallbackIndex];
        const tileLayer = L.tileLayer(currentTileSource.url, {
          attribution: currentTileSource.attribution,
          maxZoom: 19
        });

        tileLayer.on('tileerror', () => {
          console.log('Tile error detected, trying next tile source');
          // Try next tile source if current one fails
          if (tileFallbackIndex < tileSources.length - 1) {
            setTileFallbackIndex(prev => prev + 1);
          }
        });

        tileLayer.addTo(mapRef.current);

        // Create a layer group for markers
        markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
      } catch (err) {
        console.error('Error initializing map:', err);
      }
    }

    // Cleanup function
    return () => {
      if (mapRef.current) {
        console.log('Cleaning up map');
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, [center, zoom, tileFallbackIndex]);

  // Handle tile source changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing tile layers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapRef.current?.removeLayer(layer);
      }
    });

    // Add new tile layer
    const currentTileSource = tileSources[tileFallbackIndex];
    L.tileLayer(currentTileSource.url, {
      attribution: currentTileSource.attribution,
      maxZoom: 19
    }).addTo(mapRef.current);

    console.log(`Switched to tile source ${tileFallbackIndex + 1}/${tileSources.length}`);
  }, [tileFallbackIndex]);

  // Update markers when bars change
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    // Add markers for bars
    bars.forEach(bar => {
      if (!bar.latitude || !bar.longitude) return;

      try {
        // Create marker
        const marker = L.marker([bar.latitude, bar.longitude]);

        // Add popup
        marker.bindPopup(`
          <div class="map-popup">
            <h3>${bar.name}</h3>
            <p>${bar.address || 'Address not available'}</p>
            ${bar.rating ? `<p>Rating: ${bar.rating}/5</p>` : ''}
            <a href="/bar/${bar.id}" class="popup-link">
              <span class="popup-view">View Details</span>
              <span class="popup-icon">👁️</span>
            </a>
          </div>
        `);

        // Add to layer group
        marker.addTo(markersLayerRef.current!);
      } catch (err) {
        console.error(`Error adding marker for bar ${bar.id}:`, err);
      }
    });

    // Add user location marker if available
    if (userLocation) {
      const userMarker = L.circleMarker(
        [userLocation.lat, userLocation.lng],
        { 
          radius: 8, 
          fillColor: '#4B0082', 
          color: '#000', 
          weight: 1, 
          opacity: 1, 
          fillOpacity: 0.8 
        }
      ).addTo(markersLayerRef.current);

      userMarker.bindPopup('Your location');
    }

  }, [bars, userLocation]);

  // Handle resize events to fix container sizing issues
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    window.addEventListener('resize', handleResize);

    // Periodically check and fix map size
    const interval = setInterval(() => {
      if (mapRef.current && mapContainerRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 2000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, []);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        zIndex: 0
      }}
      className="map-container"
    >
      {/* Overlay for when map is loading */}
      {!mapRef.current && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70 z-10">
          <div className="text-center">
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;