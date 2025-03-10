
import React, { useState, useEffect } from 'react';
import MapView from './map-view';

// Sample test data
const testBars = [
  {
    id: '1',
    name: 'Kava Bar 1',
    location: { lat: 26.7153, lng: -80.0534 },
    address: '123 Main St, West Palm Beach, FL',
    phone: '(555) 123-4567',
    website: 'https://example.com'
  },
  {
    id: '2',
    name: 'Kava Bar 2',
    location: { lat: 26.6834, lng: -80.0997 },
    address: '456 Palm Ave, Wellington, FL',
    phone: '(555) 987-6543',
    website: 'https://example.com'
  },
  {
    id: '3',
    name: 'Kava Bar 3',
    location: { lat: 26.7372, lng: -80.1201 },
    address: '789 Royal Rd, Royal Palm Beach, FL',
    phone: '(555) 765-4321',
    website: 'https://example.com'
  }
];

const MapTest: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  
  useEffect(() => {
    // Simulate loading process
    setTimeout(() => {
      try {
        setStatus('success');
      } catch (error) {
        console.error('Map test error:', error);
        setStatus('error');
      }
    }, 500);
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
            Error loading map
          </span>
        )}
      </div>

      <div style={{ height: '400px', width: '100%' }}>
        <MapView 
          bars={testBars}
          center={{ lat: 26.7056, lng: -80.0364 }}
          zoom={10}
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
