
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EyeIcon } from 'lucide-react';
import './map-styles.css';

// Fix Leaflet icon paths
// This is necessary because of how bundlers handle assets
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default icon issue
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Tile layer URLs to try (in order of preference)
const TILE_LAYERS = [
  {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
  }
];

interface MapViewProps {
  bars: any[];
  center: { lat: number; lng: number };
  zoom: number;
  onMarkerClick?: (bar: any) => void;
  selectedBarId?: string;
}

const MapView: React.FC<MapViewProps> = ({ 
  bars, 
  center, 
  zoom, 
  onMarkerClick,
  selectedBarId 
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const [currentTileLayerIndex, setCurrentTileLayerIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Clean up previous map instance if it exists
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    try {
      console.log('Initializing Leaflet map...');
      const map = L.map(mapContainerRef.current).setView([center.lat, center.lng], zoom);
      mapRef.current = map;

      // Add tile layer with error handling
      const addTileLayer = (index: number) => {
        if (index >= TILE_LAYERS.length) {
          console.error('All tile layers failed to load');
          return false;
        }

        const layer = TILE_LAYERS[index];
        try {
          const tileLayer = L.tileLayer(layer.url, {
            attribution: layer.attribution,
            maxZoom: 19
          });
          
          tileLayer.on('tileerror', () => {
            console.warn(`Tile layer ${index} failed, trying next one...`);
            map.removeLayer(tileLayer);
            setCurrentTileLayerIndex(prev => prev + 1);
            addTileLayer(index + 1);
          });
          
          tileLayer.addTo(map);
          return true;
        } catch (error) {
          console.error(`Error adding tile layer ${index}:`, error);
          setCurrentTileLayerIndex(prev => prev + 1);
          return addTileLayer(index + 1);
        }
      };

      // Start with the current tile layer index
      addTileLayer(currentTileLayerIndex);
      
      // Add scale control
      L.control.scale().addTo(map);
      
      // Map is now loaded
      setIsLoaded(true);
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [center, zoom, currentTileLayerIndex]);

  // Add markers for bars
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !bars.length) return;
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => {
      if (mapRef.current) marker.removeFrom(mapRef.current);
    });
    markersRef.current = {};
    
    // Add new markers
    bars.forEach(bar => {
      if (!bar.location?.lat || !bar.location?.lng) return;
      
      try {
        // Create marker
        const marker = L.marker([bar.location.lat, bar.location.lng], {
          title: bar.name
        });
        
        // Determine if this marker should be highlighted
        if (selectedBarId && bar.id === selectedBarId) {
          marker.setIcon(L.divIcon({
            className: 'highlighted-marker',
            html: `<div class="marker-icon selected"></div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30]
          }));
        }
        
        // Add popup
        marker.bindPopup(`
          <div class="map-popup">
            <h3>${bar.name}</h3>
            <p>${bar.address || 'No address available'}</p>
            ${bar.phone ? `<p><a href="tel:${bar.phone}">${bar.phone}</a></p>` : ''}
            ${bar.website ? `<p><a href="${bar.website}" target="_blank" rel="noopener noreferrer">Visit Website</a></p>` : ''}
          </div>
        `);
        
        // Add click handler
        if (onMarkerClick) {
          marker.on('click', () => {
            onMarkerClick(bar);
          });
        }
        
        // Add to map
        marker.addTo(mapRef.current);
        
        // Store reference
        markersRef.current[bar.id] = marker;
      } catch (error) {
        console.error(`Error adding marker for ${bar.name}:`, error);
      }
    });
    
    // If we have bars and no center was explicitly provided, fit bounds
    if (bars.length > 0 && mapRef.current) {
      try {
        const points = bars
          .filter(bar => bar.location?.lat && bar.location?.lng)
          .map(bar => [bar.location.lat, bar.location.lng]);
          
        if (points.length > 0) {
          const bounds = L.latLngBounds(points as [number, number][]);
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }
    }
  }, [bars, isLoaded, onMarkerClick, selectedBarId]);
  
  // Center map or highlight selected bar when selectedBarId changes
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !selectedBarId) return;
    
    const marker = markersRef.current[selectedBarId];
    if (marker) {
      // Center map on marker
      const markerPosition = marker.getLatLng();
      mapRef.current.setView(markerPosition, mapRef.current.getZoom());
      
      // Open popup
      marker.openPopup();
    }
  }, [selectedBarId, isLoaded]);

  // Add periodic resize handler to fix container sizing issues
  useEffect(() => {
    if (!mapRef.current) return;
    
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };
    
    // Initial invalidate
    setTimeout(handleResize, 100);
    
    // Set up interval to periodically invalidate size
    const interval = setInterval(handleResize, 2000);
    
    // Add window resize listener
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, [isLoaded]);

  return (
    <div className="map-container">
      <div ref={mapContainerRef} className="map-view"></div>
      {!isLoaded && (
        <div className="map-loading">
          <div className="map-loading-indicator">
            <span>Loading map...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
