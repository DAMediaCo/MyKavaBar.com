
import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./map-styles.css";

export default function MapTest() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    // Clean up any existing map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    if (!mapContainerRef.current) return;

    try {
      console.log("Initializing test map");
      
      // Fix Leaflet icon issue
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Create map
      const map = L.map(mapContainerRef.current).setView([34.0522, -118.2437], 5);
      mapRef.current = map;
      
      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add event listeners for debugging
      map.on('load', () => {
        console.log("Map loaded event fired");
      });

      map.on('error', (e) => {
        console.error("Map error:", e);
        setStatus('error');
        setErrorMessage(e.error?.message || 'Unknown map error');
      });

      // Add tile layer with error handling
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      });

      tileLayer.on('loading', () => {
        console.log("Tile layer loading");
      });

      tileLayer.on('load', () => {
        console.log("Tile layer loaded");
        setStatus('success');
      });

      tileLayer.on('error', (e) => {
        console.error("Tile layer error:", e);
        setStatus('error');
        setErrorMessage('Failed to load map tiles. Please check your network connection.');
      });

      tileLayer.addTo(map);

      // Add test markers
      L.marker([34.0522, -118.2437]).addTo(map)
        .bindPopup("Los Angeles")
        .openPopup();

      L.marker([40.7128, -74.0060]).addTo(map)
        .bindPopup("New York");

      L.marker([25.7617, -80.1918]).addTo(map)
        .bindPopup("Miami");

      // Set a timeout to ensure we don't hang indefinitely
      const timeout = setTimeout(() => {
        if (status === 'loading') {
          console.warn("Map still loading after timeout");
          
          // Check if the map seems to be working despite not firing events
          if (mapRef.current && mapRef.current.getContainer()) {
            const mapContainer = mapRef.current.getContainer();
            if (mapContainer.querySelector('.leaflet-tile-loaded')) {
              console.log("Found loaded tiles, map seems to be working");
              setStatus('success');
            } else {
              setStatus('error');
              setErrorMessage('Map failed to load tiles within the expected time.');
            }
          } else {
            setStatus('error');
            setErrorMessage('Map initialization timed out.');
          }
        }
      }, 5000);

      return () => {
        clearTimeout(timeout);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (err) {
      console.error("Error initializing map:", err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to initialize map component');
    }
  }, []);

  return (
    <div className="border rounded-md p-4">
      <h2 className="text-xl font-semibold mb-4">Map Test</h2>
      
      {status === 'loading' && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md mb-4">
          <h3 className="font-semibold">Loading Map...</h3>
          <p>Please wait while the map is being initialized.</p>
        </div>
      )}
      
      {status === 'error' && (
        <div className="p-4 bg-red-50 text-red-800 rounded-md mb-4">
          <h3 className="font-semibold">Map Loading Error</h3>
          <p>{errorMessage || 'Failed to load the map component'}</p>
          <div className="mt-2 text-sm">
            <p>Troubleshooting tips:</p>
            <ul className="list-disc list-inside">
              <li>Check your internet connection</li>
              <li>Verify that the OpenStreetMap tile server is accessible.</li>
              <li>Check the browser's console for detailed error messages.</li>
            </ul>
          </div>
        </div>
      )}

      <div 
        ref={mapContainerRef} 
        className="w-full h-[400px] rounded-md border border-gray-300"
        style={{ display: status === 'error' ? 'none' : 'block' }}
      />

      {status === 'success' && (
        <div className="mt-2 text-sm text-green-600">
          ✓ Map loaded successfully
        </div>
      )}
    </div>
  );
}
