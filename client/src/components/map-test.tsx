import React, { useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '400px'
};

const center = {
  lat: 39.8283,
  lng: -98.5795
};

function MapTest() {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  console.log('API Key detected:', !!apiKey);
  console.log('API Key length:', apiKey ? apiKey.length : 0);
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    version: 'weekly',
  });
  
  const onLoad = React.useCallback(function callback(map: google.maps.Map) {
    console.log('Map loaded successfully');
    setMap(map);
  }, []);

  const onUnmount = React.useCallback(function callback() {
    console.log('Map unmounted');
    setMap(null);
  }, []);

  if (loadError) {
    return (
      <div className="p-4 border border-red-500 bg-red-100 rounded">
        <h3 className="text-red-700 font-bold">Error Loading Google Maps</h3>
        <p>{loadError.message}</p>
        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
          {JSON.stringify(loadError, null, 2)}
        </pre>
      </div>
    );
  }

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-2">Google Maps Test</h2>
      <div className="mb-2">
        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
          Maps API loaded successfully
        </span>
      </div>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={4}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        <Marker position={center} />
      </GoogleMap>
    </div>
  );
}

export default React.memo(MapTest);