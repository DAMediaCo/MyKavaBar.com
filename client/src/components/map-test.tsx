import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issues with embedded marker icons to avoid external dependencies
const iconUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFgUlEQVR4Aa1XA5BjWRTN2oW17d3YaZtr2962HUzbDNpjszW24mRt28p47v7zq/bXZtrp/lWnXr337j3nPCe85NcypgSFdugCpW5YoDAMRaIMqRi6aKq5E3YqDQO3qAwjVWrD8Ncq/RBpykd8oZUb/kaJutow8r1aP9II0WmLKLIsJyv1w/kqw9Ch2MYdB++12Onxee/QMwvf4/Dk/Lfp/i4nxTXtOoQ4pW5Aj7wpici1A9erdAN2OH64x8OSP9j3Ft3b7aWkTg/Fm91siTra0f9on5sQr9INejH6CUUUpavjFNq1B+Oadhxmnfa8RfEmN8VNAsQhPqF55xHkMzz3jSmChWU6f7/XZKNH+9+hBLOHYozuKQPxyMPUKkrX/K0uWnfFaJGS1QPRtZsOPtr3NsW0uyh6NNCOkU3Yz+bXbT3I8G3xE5EXLXtCXbbqwCO9zPQYPRTZ5vIDXD7U+w7rFDEoUUf7ibHIR4y6bLVPXrz8JVZEql13trxwue/uDivd3fkWRbS6/IA2bID4uk0UpF1N8qLlbBlXs4Ee7HLTfV1j54APvODnSfOWBqtKVvjgLKzF5YdEk5ewRkGlK0i33Eofffc7HT56jD7/6U+qH3Cx7SBLNntH5YIPvODnyfIXZYRVDPqgHtLs5ABHD3YzLuespb7t79FY34DjMwrVrcTuwlT55YMPvOBnRrJ4VXTdNnYug5ucHLBjEpt30701A3Ts+HEa73u6dT3FNWwflY86eMHPk+Yu+i6pzUpRrW7SNDg5JHR4KapmM5Wv2E8Tfcb1HoqqHMHU+uWDD7zg54mz5/2BSnizi9T1Dg4QQXLToGNCkb6tb1NU+QAlGr1++eADrzhn/u8Q2YZhQVlZ5+CAOtqfbhmaUCS1ezNFVm2imDbPmPng5wmz+gwh+oHDce0eUtQ6OGDIyR0uUhUsoO3vfDmmgOezH0mZN59x7MBi++WDL1g/eEiU3avlidO671bkLfwbw5XV2P8Pzo0ydy4t2/0eu33xYSOMOD8hTf4CrBtGMSoXfPLchX+J0ruSePw3LZeK0juPJbYzrhkH0io7B3k164hiGvawhOKMLkrQLyVpZg8rHFW7E2uHOL888IBPlNZ1FPzstSJM694fWr6RwpvcJK60+0HCILTBzZLFNdtAzJaohze60T8qBzyh5ZuOg5e7uwQppofEmf2++DYvmySqGBuKaicF1blQjhuHdvCIMvp8whTTfZzI7RldpwtSzL+F1+wkdZ2TBOW2gIF88PBTzD/gpeREAMEbxnJcaJHNHrpzji0gQCS6hdkEeYt9DF/2qPcEC8RM28Hwmr3sdNyht00byAut2k3gufWNtgtOEOFGUwcXWNDbdNbpgBGxEvKkOQsxivJx33iow0Vw5S6SVTrpVq11ysA2Rp7gTfPfktc6zhtXBBC+adRLshf6sG2RfHPZ5EAc4sVZ83yCN00Fk/4kggu40ZTvIEm5g24qtU4KjBrx/BTTH8ifVASAG7gKrnWxJDcU7x8X6Ecczhm3o6YicvsLXWfh3Ch1W0k8x0nXF+0fFxgt4phz8QvypiwCCFKMqXCnqXExjq10beH+UUA7+nG6mdG/Pu0f3LgFcGrl2s0kNNjpmoJ9o4B29CMO8dMT4Q5ox8uitF6fqsrJOr8qnwNbRzv6hSnG5wP+64C7h9lp30hKNtKdWjtdkbuPA19nJ7Tz3zR/ibgARbhb4AlhavcBebmTHcFl2fvYEnW0ox9xMxKBS8btJ+KiEbq9zA4RthQXDhPa0T9TEe69gWupwc6uBUphquXgf+/FrIjweHQS4/pduMe5ERUMHUd9xv8ZR98CxkS4F2n3EUrUZ10EYNw7BWm9x1GiPssi3GgiGRDKWRYZfXlON+dfNbM+GgIwYdwAAAAASUVORK5CYII=';
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
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  },
  {
    name: 'Stadia Maps',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>',
    maxZoom: 20
  },
  {
    name: 'Esri WorldStreetMap',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18
  },
  {
    name: 'CartoDB Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19
  }
];
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

// Force a refresh of the map
function MapRefresher({ interval = 5000 }) {
  const map = useMap();
  
  useEffect(() => {
    const refreshTimer = setInterval(() => {
      console.log("Map refresh triggered");
      map.invalidateSize();
    }, interval);
    
    return () => clearInterval(refreshTimer);
  }, [map, interval]);
  
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

  if (mapError) {
    return (
      <div className="p-4 border border-red-500 bg-red-100 rounded">
        <h3 className="text-red-700 font-bold">Error Loading Map</h3>
        <p>{mapError}</p>
        <button 
          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => window.location.reload()}
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-2">React Leaflet Map Test</h2>
      <div className="mb-2">
        {mapLoaded ? (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
            Map loaded successfully
          </span>
        ) : (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
            Loading map...
          </span>
        )}
      </div>
      
      {/* Explicit height and width are critical for map rendering */}
      <div style={{ height: '500px', width: '100%', border: '1px solid #ccc', position: 'relative' }}>
        <MapContainer 
          center={[center.lat, center.lng]} 
          zoom={4} 
          style={{ height: '100%', width: '100%' }}
          whenReady={() => {
            console.log("Map ready");
            if (mapRef.current) {
              console.log("Map reference already exists");
            }
            setMapLoaded(true);
          }}
          ref={mapRef}
          attributionControl={false}
          zoomControl={true}
        >
          <TileLayerFallback />
          <MapRefresher interval={10000} />
          
          {/* Markers for test locations */}
          {testPoints.map((point, index) => (
            <Marker 
              key={index} 
              position={[point.lat, point.lng]}
            >
              <Popup>
                <div>{point.name}</div>
                <div className="text-xs text-gray-500">
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

export default React.memo(MapTest);