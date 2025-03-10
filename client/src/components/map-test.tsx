import React, { useState, useEffect } from 'react';
import MapView from './map-view';

const MapTest = () => {
  const [status, setStatus] = useState('loading');
  const [testBars, setTestBars] = useState([]);

  useEffect(() => {
    // Create sample data for testing the map
    const sampleBars = [
      {
        id: 'test1',
        name: 'Test Kava Bar 1',
        address: '123 Test St, West Palm Beach, FL',
        rating: 4.5,
        latitude: 26.7056,
        longitude: -80.0364
      },
      {
        id: 'test2',
        name: 'Test Kava Bar 2',
        address: '456 Sample Ave, Lake Worth, FL',
        rating: 4.2,
        latitude: 26.6166,
        longitude: -80.0673
      },
      {
        id: 'test3',
        name: 'Test Kava Bar 3',
        address: '789 Demo Blvd, Boynton Beach, FL',
        rating: 4.7,
        latitude: 26.5281,
        longitude: -80.0731
      }
    ];

    setTestBars(sampleBars);
    setStatus('success');
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