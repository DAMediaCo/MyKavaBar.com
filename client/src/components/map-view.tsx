import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EyeIcon } from 'lucide-react';
import './map-styles.css';

// Import marker icons directly
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default icon issue
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

// Set default icon
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
  onBarClick?: (bar: any) => void;
}

const MapView: React.FC<MapViewProps> = ({ 
  bars = [], 
  center = { lat: 27.6648, lng: -81.5158 }, // Florida by default
  zoom = 7,
  onBarClick
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tileLayerIndex, setTileLayerIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize map on component mount
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      console.log("Initializing map...");

      // Create map instance if it doesn't exist
      if (!mapRef.current && mapContainerRef.current) {
        mapRef.current = L.map(mapContainerRef.current, {
          center: [center.lat, center.lng],
          zoom: zoom,
          zoomControl: true,
          attributionControl: true
        });

        console.log("Map instance created successfully");
      }

      // Try to add the current tile layer
      const addTileLayer = () => {
        if (!mapRef.current) return;

        try {
          const currentLayer = TILE_LAYERS[tileLayerIndex];
          console.log(`Adding tile layer ${tileLayerIndex}: ${currentLayer.url}`);

          L.tileLayer(currentLayer.url, {
            attribution: currentLayer.attribution,
            maxZoom: 19
          }).addTo(mapRef.current);

          console.log("Tile layer added successfully");
          setMapLoaded(true);
        } catch (err) {
          console.error("Error adding tile layer:", err);

          // Try next tile layer if available
          if (tileLayerIndex < TILE_LAYERS.length - 1) {
            setTileLayerIndex(tileLayerIndex + 1);
          } else {
            setError("Failed to load map tiles from any source");
          }
        }
      };

      addTileLayer();

      // Add markers for bars
      if (mapRef.current && bars.length > 0) {
        console.log(`Adding ${bars.length} markers to map`);

        bars.forEach(bar => {
          if (bar.latitude && bar.longitude) {
            const marker = L.marker([bar.latitude, bar.longitude], { 
              title: bar.name,
              alt: `Marker for ${bar.name}`
            }).addTo(mapRef.current!);

            // Add popup with bar info
            marker.bindPopup(`
              <div>
                <strong>${bar.name}</strong>
                <p>${bar.address || 'Address not available'}</p>
                ${bar.rating ? `<p>Rating: ${bar.rating}/5</p>` : ''}
                <button class="view-details">View Details</button>
              </div>
            `);

            // Handle click event if callback provided
            if (onBarClick) {
              marker.on('click', () => {
                onBarClick(bar);
              });
            }
          }
        });

        console.log("Markers added successfully");
      }

      // Cleanup function
      return () => {
        if (mapRef.current) {
          console.log("Cleaning up map instance");
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (err) {
      console.error("Error initializing map:", err);
      setError(`Map initialization error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [bars, center, zoom, tileLayerIndex, onBarClick]);

  // Handle container size changes
  useEffect(() => {
    if (!mapRef.current) return;

    const handleResize = () => {
      if (mapRef.current) {
        console.log("Invalidating map size");
        mapRef.current.invalidateSize();
      }
    };

    // Initial invalidation after a short delay to ensure container is properly sized
    const initialResizeTimeout = setTimeout(handleResize, 500);

    // Periodic check for size changes (helpful for mobile devices and dynamic layouts)
    const intervalId = setInterval(handleResize, 2000);

    // Event listener for window resize
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(initialResizeTimeout);
      clearInterval(intervalId);
      window.removeEventListener('resize', handleResize);
    };
  }, [mapRef.current]);

  return (
    <div className="relative w-full h-full">
      {/* Map loading indicator */}
      {!mapLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-75 z-20">
          <div className="text-center p-4 max-w-md">
            <div className="text-red-500 text-3xl mb-2">⚠️</div>
            <p className="font-semibold text-red-800">Map Error</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button 
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      )}

      {/* Map container */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full leaflet-container" 
        style={{ minHeight: '300px' }}
      />
    </div>
  );
};

export default MapView;