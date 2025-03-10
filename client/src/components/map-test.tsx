import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for Leaflet default icon paths by using static URLs
let DefaultIcon = L.icon({
  iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Set the default icon for all markers
L.Marker.prototype.options.icon = DefaultIcon;

const center = {
  lat: 39.8283,
  lng: -98.5795
};

function MapTest() {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    // Set a timeout to check if map loaded successfully
    const timeout = setTimeout(() => {
      if (!mapLoaded) {
        console.log("Map still loading after timeout, checking elements");
        const mapContainer = document.querySelector(".leaflet-container");
        if (mapContainer) {
          console.log("Map container found, forcing load state");
          setMapLoaded(true);
        } else {
          setMapError("Failed to load map components");
        }
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [mapLoaded]);

  if (mapError) {
    return (
      <div className="p-4 border border-red-500 bg-red-100 rounded">
        <h3 className="text-red-700 font-bold">Error Loading Map</h3>
        <p>{mapError}</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-2">React Leaflet Map Test</h2>
      <div className="mb-2">
        {mapLoaded && (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
            Map loaded successfully
          </span>
        )}
      </div>
      <div style={{ height: '400px', width: '100%' }}>
        <MapContainer 
          center={[center.lat, center.lng]} 
          zoom={4} 
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
          whenReady={() => {
            console.log("Map is ready");
            setMapLoaded(true);
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            eventHandlers={{
              loading: () => console.log("Tiles loading..."),
              load: () => console.log("Tiles loaded successfully"),
              error: (e) => {
                console.error("Error loading tiles:", e);
                setMapError("Failed to load map tiles");
              }
            }}
          />
          <Marker position={[center.lat, center.lng]}>
            <Popup>
              Center of the United States
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}

export default React.memo(MapTest);