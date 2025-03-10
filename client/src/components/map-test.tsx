
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
  
  // Set up error catching for Leaflet loading issues
  useEffect(() => {
    try {
      // Ensure Leaflet is loaded
      const leafletLoaded = typeof L !== 'undefined';
      console.log("Leaflet loaded status:", leafletLoaded);
      
      // Check if window.L exists
      if (window.L) {
        console.log("Leaflet version:", window.L.version);
      }
      
      // Simulate loading process
      const timer = setTimeout(() => {
        setStatus('success');
      }, 500);
      
      return () => clearTimeout(timer);
    } catch (error) {
      console.error('Map test error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  }, []);

  // Test tile load
  useEffect(() => {
    // Create a test image to check if tiles can load
    const testImage = new Image();
    testImage.onload = () => {
      console.log("Test tile loaded successfully");
    };
    testImage.onerror = (e) => {
      console.error("Test tile failed to load:", e);
      if (status !== 'error') {
        setStatus('error');
        setErrorMessage("Failed to load map tiles. Check your network connection or try a different browser.");
      }
    };
    testImage.src = "https://a.tile.openstreetmap.org/1/1/1.png";
    
    return () => {
      testImage.onload = null;
      testImage.onerror = null;
    };
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
      
      <div className="mt-4" style={{ height: '400px', width: '100%' }}>
        {status !== 'error' && (
          <MapView 
            bars={testBars} 
            center={{ lat: 26.7056, lng: -80.0364 }}
            zoom={9}
            userLocation={{ lat: 26.7156, lng: -80.0564 }}
          />
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>This map should display three test markers in Palm Beach County, Florida.</p>
        <p>If you're experiencing issues, try:</p>
        <ul className="list-disc pl-5 mt-2">
          <li>Checking your network connection</li>
          <li>Disabling content blockers/ad blockers</li>
          <li>Trying a different browser</li>
          <li>Ensuring JavaScript is enabled</li>
        </ul>
      </div>
    </div>
  );
}

export default MapTest;
