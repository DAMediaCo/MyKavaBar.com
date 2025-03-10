
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map-styles.css';

// Fix Leaflet icon paths
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Set up default icon for Leaflet
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const MapTest = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    try {
      // Create map instance
      const map = L.map(mapContainerRef.current).setView([27.9944, -82.4324], 10); // Tampa, FL as default
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      
      // Add some test markers
      const locations = [
        { name: 'Test Location 1', lat: 27.9506, lng: -82.4572 },
        { name: 'Test Location 2', lat: 28.0395, lng: -82.4946 },
        { name: 'Test Location 3', lat: 27.9477, lng: -82.4584 },
      ];
      
      locations.forEach(loc => {
        L.marker([loc.lat, loc.lng])
          .addTo(map)
          .bindPopup(`<strong>${loc.name}</strong>`);
      });
      
      setStatus('success');
      
      // Cleanup function
      return () => {
        map.remove();
      };
    } catch (error) {
      console.error('Error initializing map:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error initializing map');
    }
  }, []);
  
  return (
    <div className="w-full">
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
};

export default MapTest;
