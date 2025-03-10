import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapTest: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      console.log("Initializing map test...");

      // Check if Leaflet is available
      if (typeof L === 'undefined') {
        throw new Error('Leaflet library not loaded');
      }

      console.log("Leaflet version:", L.version);

      // Initialize map
      const map = L.map(mapContainerRef.current).setView([28.538336, -81.379234], 8);

      // Add a more robust tile layer -  handling potential errors
      const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QHwADwQYE/g8BDwAAAAASUVORK5CYII=' // Default error tile
      }).addTo(map);

      tileLayer.on('tileerror', (error) => {
        console.error('Tile layer error:', error);
        setStatus('error');
        setErrorMessage("Failed to load map tiles. Check your internet connection.");
      });

      // Add a marker
      L.marker([28.538336, -81.379234]).addTo(map)
        .bindPopup('Test Marker')
        .openPopup();


      // Save map reference
      mapRef.current = map;

      // Set success status
      setStatus('success');

      // Trigger a resize event after rendering to ensure the map displays correctly
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);

      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (error) {
      console.error('Map test error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  }, []);

  return (
    <div className="relative">
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
          <div className="text-center">
            <div className="spinner mb-2"></div>
            <p>Loading map test...</p>
          </div>
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
};

export default MapTest;