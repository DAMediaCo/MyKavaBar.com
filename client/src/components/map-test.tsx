
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issues with embedded marker icons to avoid external dependencies
const iconUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFgUlEQVR4Aa1XA5BjWRTN2oW17d3YaZtr2962HUzbDNpjszW24mRt28p47v7zq/bXZtrp/lWnXr337j3nPCe/meEEhMkNybdLO6MfF9cLBeaSJ1oHJDunCerCm/B0+zA9gQEEiNZJdBgBGA8MhGZuwvCjQUw487tgFQyjv8SYw8CAVS1Q9WedKBjljJSYAbOGUtgL7bcXn2MR5GlQ5JoM8k/KfvSgW+ZA7n1/O5vR0/pnPxMjVLGcmUDm8z//J0E3ulEaoQQSxSOqR+aWJtXWdlVSJzeZEjUcWaUSiY5i6HmtjXYqXDbkjErGX8PptCIzFMB3jeEqMRbL6JoyYP4mZSd67BcDlGTc9xJhMQB5U14SYCzKWtvHovTtFrwK7YdIHNoIQlJG2UBCPYynMRbLK9FYp2xxMUXQ0dQ9YJe05X/lKCFuA8EwVX8XvgWCuXCsAzwJTRJIceKFk++R65aMBHO5+cJwblyvYhnJoJyHCgOYNmLjPhWXiAkqhJJ/mc0Z5sHpzU9s1QAmNXQKPAYvJYyD8YJO4Na0Eub0iEyQI1OchW50TIrYl4eGcK5+NSxXpY/r8W3KbEGib4j/JkCQcU9OjIIPWttk9BjXfu0mPEFu dDf3/d9JRBaNdnBkugOtVNwvNYJ/BrLpXK2fQteL7P9/VBHpYEFyvNM0dMYfuLz62db28XKeAlnJS1qytLAsBVQmvu7PCcoGCE7rwUffFmfXswjqWCxQFtZLKbZZYLB4KwxQCz8dXw9fDN+MOmOoRRqE0tKhX4iNuwLLL2RRSmKY/vXYw3cWKwG4vjgxHQeA7z7P8zQq6Z+P8/gECgUHw/LhOogx0lZjDxwdDDfEWeZbnPzjOHDvcNXb+LwCGTvVgKcl3s+LS8np51k1/15KLz9kUP3mzo69u3r3STmv7Pj6+WpOy7aTZtm9rP3WUjSklJvHeOIvpB3/vXPlDtjqifugz7X9P7P5G1yn6S71cKVKmbvP2gaBgaGTayKUFwi6Fatlxz6+5aHjbvKjX5JaNXWK0vNlunpl+l4N7Z2ei9gP1S3+qcUGIi2+ZwSTzpvP9KhFRvw32bsb2ZfJkFC5QKBeFEgGYPnNB64deffcwTziT3rXotlbr9ebzaFjPQ08R/m563KAZzY3L4ENbQcKuB9J32HGbxLYrPO/5c/qQXv5Z3ZnGBcnPBkhhSdb/xLycIlviJee86CMjE4ZpZlYcQ== ';
const shadowUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAApCAQAAAACach9AAACMUlEQVR4Ae3ShY7jQBAE0Aoz/f9/HTMzhg1zrdKUrJbdx+Kd2nD8VNudfsL/Th///dyQN2TH6f3y/BGpC379rV+S+qqetBOxImNQXL8JCAr2V4iMQXHGNJxeCfZXhSRBcQMfvkOWUdtfzlLgAENmZDcmo2TVmt8OSM2eXxBp3DjHSMFutqS7SbmemzBiR+xpKCNUIRkdkkYxhAkyGoBvyQFEJEefwSmmvBfJuJ6aKqKWnAkvGZOaZXTUgFqYULWNSHUckZuR1HIIimUExutRxwzOLROIG4vKmCKQt364mIlhSyzAf1m9lHZHJZrlAOMMztRRiKimp/rpdJDc9Awry5xTZCte7FHtuS8wJgeYGrex28xNTd086Dik7vUMscQOa8y4DoGtCCSkAKlNwpgNtphjrC6MIHUkR6YWxxs6Sc5xqn222mmCRFzIt8lEdKx+ikCtg91qS2WpwVfBelJCiQJwvzixfI9cxZQWgiSJelKnwBElKYtDOb2MFbhmUigbReQBV0Cg1Sg8w4SUyYWspo9fF+Lu0J5qkYdMgUctIGPMXgAlyHTRBs4sVn7Bnsc473AqkDZkMgpZNAR5MQszDpqQrZVSg6KRHRtGjrUKGWFpAH4mRLbrZA0LmrindwvLyu+0Hy7Ptn2fTNFu1Kdo1X7Ysx9w/A/SAXhH6QssIAAAAASUVORK5CYII=';

// Fix Leaflet icon issues - this is critical to ensure icons display correctly
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl,
  shadowUrl,
  iconRetinaUrl: iconUrl
});

// Multiple tile layers for fallback in case one provider is down
const tileLayers = [
  {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> contributors',
    name: "CARTO"
  },
  {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    name: "OpenStreetMap"
  },
  {
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> contributors',
    name: "Stadia Maps"
  }
];

// Test location: Center of the United States
const center = {
  lat: 39.8283,
  lng: -98.5795
};

// Testing locations: a few points around the US
const testPoints = [
  { lat: 40.7128, lng: -74.0060, name: "New York City" },
  { lat: 37.7749, lng: -122.4194, name: "San Francisco" },
  { lat: 25.7617, lng: -80.1918, name: "Miami" },
];

// Component to handle tile layer fallbacks
function TileLayerFallback() {
  const [currentLayerIndex, setCurrentLayerIndex] = useState(0);
  const [layerError, setLayerError] = useState(false);
  const [loadSuccess, setLoadSuccess] = useState(false);
  const map = useMap();
  
  // Handler for tile error
  const handleTileError = () => {
    console.log(`Tile layer ${tileLayers[currentLayerIndex].name} failed, trying next provider`);
    setLayerError(true);
    
    if (currentLayerIndex < tileLayers.length - 1) {
      setCurrentLayerIndex(prev => prev + 1);
    } else {
      console.error("All tile layers failed to load");
    }
  };

  // Handler for successful tile load
  const handleTileLoad = () => {
    console.log(`Tile layer ${tileLayers[currentLayerIndex].name} loaded successfully`);
    setLoadSuccess(true);
  };
  
  useEffect(() => {
    // Reset error state when changing layer
    setLayerError(false);
  }, [currentLayerIndex]);

  // Log map state for debugging
  useEffect(() => {
    console.log("Map instance:", map ? "Available" : "Not available");
    console.log("Map container size:", 
      map && map.getContainer() ? 
      `${map.getContainer().clientWidth}x${map.getContainer().clientHeight}` : 
      "Unknown"
    );
    console.log("Map zoom:", map ? map.getZoom() : "Unknown");
    console.log("Current center:", map ? map.getCenter() : "Unknown");
    
    // Force refresh
    if (map) {
      setTimeout(() => {
        map.invalidateSize();
        console.log("Forced map size refresh");
      }, 1000);
    }
  }, [map]);
  
  const currentLayer = tileLayers[currentLayerIndex];
  
  return (
    <>
      <div className="absolute top-2 right-2 z-[1000] bg-white p-1 rounded shadow text-xs">
        Using {currentLayer.name} tiles {loadSuccess ? "✓" : "..."}
      </div>
      
      <TileLayer
        key={`tile-layer-${currentLayerIndex}`}
        url={currentLayer.url}
        attribution={currentLayer.attribution}
        eventHandlers={{
          tileerror: handleTileError,
          load: handleTileLoad
        }}
      />
    </>
  );
}

// Force refreshing component for map
function MapRefresher() {
  const map = useMap();
  
  useEffect(() => {
    const timer = setInterval(() => {
      if (map) {
        map.invalidateSize();
        console.log("Periodic map refresh");
      }
    }, 3000);
    
    return () => clearInterval(timer);
  }, [map]);
  
  return null;
}

function MapTest() {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Force resize on window changes
  useEffect(() => {
    const handleResize = () => {
      console.log("Window resize detected, refreshing map");
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Force resize after a short delay to ensure map has loaded
    const timeoutId = setTimeout(() => {
      handleResize();
    }, 500);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Check for map loading issues
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!mapLoaded) {
        console.log("Map still loading after timeout");
        
        // Check if container exists
        const container = document.querySelector('.leaflet-container');
        if (container) {
          console.log("Container exists but map not loaded, forcing refresh");
          window.dispatchEvent(new Event('resize'));
          setMapLoaded(true);
        } else {
          console.log("Container doesn't exist, setting error");
          setMapError("Failed to load map container");
        }
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [mapLoaded]);

  // Handle successful map reference acquisition
  const handleMapCreated = (map: L.Map) => {
    console.log("Map reference obtained");
    mapRef.current = map;
    setMapLoaded(true);
    
    // Add initial invalidation to handle mobile issues
    setTimeout(() => {
      map.invalidateSize();
      console.log("Initial map size refresh");
    }, 100);
  };

  return (
    <div className="flex flex-col">
      <div className="h-[400px] w-full border rounded overflow-hidden relative">
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
            <div className="text-red-500">
              <p>{mapError}</p>
              <button 
                className="mt-2 px-4 py-2 bg-red-100 rounded" 
                onClick={() => window.location.reload()}
              >
                Reload Page
              </button>
            </div>
          </div>
        )}
        
        <MapContainer 
          center={[center.lat, center.lng]} 
          zoom={4} 
          className="h-full w-full"
          whenCreated={handleMapCreated}
        >
          <TileLayerFallback />
          <MapRefresher />
          
          {testPoints.map((point, idx) => (
            <Marker 
              key={idx} 
              position={[point.lat, point.lng]}
            >
              <Popup>
                <div>
                  <strong>{point.name}</strong><br/>
                  {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>This is a test of the Leaflet map component with multiple tile providers for better reliability.</p>
        <ul className="list-disc ml-5 mt-2">
          <li>If you can see the map with markers, the map functionality is working correctly.</li>
          <li>The map will automatically try different tile sources if one fails.</li>
          <li>Built-in periodic refresh to handle container size issues.</li>
        </ul>
      </div>
    </div>
  );
}

export default MapTest;
