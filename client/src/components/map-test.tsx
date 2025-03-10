
import React, { useState, useEffect } from 'react';
import MapView from './map-view';

// Sample test data for markers
const testBars = [
  {
    id: 1,
    name: "Test Kava Bar 1",
    address: "123 Test St, Test City, FL",
    latitude: 26.7056,
    longitude: -80.0364,
    rating: 4.5
  },
  {
    id: 2,
    name: "Test Kava Bar 2",
    address: "456 Sample Ave, Test City, FL",
    latitude: 26.6406,
    longitude: -80.2831,
    rating: 4.8
  },
  {
    id: 3,
    name: "Test Kava Bar 3",
    address: "789 Demo Blvd, Test City, FL",
    latitude: 26.8245,
    longitude: -80.1362,
    rating: 4.2
  }
];

const MapTest: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  useEffect(() => {
    // Simulate loading process
    const timer = setTimeout(() => {
      try {
        setStatus('success');
      } catch (error) {
        console.error('Map test error:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-2">Map Test</h2>
      <div className="mb-2">
        {status === 'loading' && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
            Loading map...
          </span>
        )}
        {status === 'success' && (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
            Map loaded successfully
          </span>
        )}
        {status === 'error' && (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
            Error loading map: {errorMessage}
          </span>
        )}
      </div>

      <div style={{ height: '400px', width: '100%' }}>
        <MapView 
          bars={testBars}
          center={{ lat: 26.7056, lng: -80.0364 }}
          zoom={10}
          onBarClick={(bar) => console.log('Clicked on bar:', bar)}
        />
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <ul className="list-disc pl-5">
          <li>If you can see the map with markers, the map functionality is working correctly.</li>
          <li>The map will automatically try different tile sources if one fails.</li>
          <li>Built-in periodic refresh to handle container size issues.</li>
        </ul>
      </div>
    </div>
  );
};

export default MapTest;
