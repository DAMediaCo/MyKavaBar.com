import { useRef, useEffect, useState } from 'react';

function BasicMapTest() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Only run this once when the component mounts
    if (!mapRef.current) return;

    try {
      const container = mapRef.current;

      // Create a basic map with DOM elements
      const createMarker = (lat: number, lng: number, label: string) => {
        const marker = document.createElement('div');
        marker.style.position = 'absolute';
        marker.style.backgroundColor = '#3B82F6';
        marker.style.border = '2px solid white';
        marker.style.borderRadius = '50%';
        marker.style.width = '20px';
        marker.style.height = '20px';
        marker.style.transform = 'translate(-50%, -50%)';
        marker.style.cursor = 'pointer';

        // Convert lat/lng to pixel position (simple approximation)
        // This is a very simplified formula and not geographically accurate
        const mapWidth = container.clientWidth;
        const mapHeight = container.clientHeight;
        const x = (lng + 180) * (mapWidth / 360);
        const y = (90 - lat) * (mapHeight / 180);

        marker.style.left = `${x}px`;
        marker.style.top = `${y}px`;

        // Add tooltip
        marker.title = label;

        // Add label below marker
        const labelElement = document.createElement('div');
        labelElement.textContent = label;
        labelElement.style.position = 'absolute';
        labelElement.style.left = `${x}px`;
        labelElement.style.top = `${y + 10}px`;
        labelElement.style.transform = 'translateX(-50%)';
        labelElement.style.fontSize = '12px';
        labelElement.style.fontWeight = 'bold';
        labelElement.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        labelElement.style.padding = '2px 4px';
        labelElement.style.borderRadius = '2px';

        container.appendChild(marker);
        container.appendChild(labelElement);
      };

      // Clear any existing content
      container.innerHTML = '';

      // Add a basic grid background
      container.style.backgroundImage = 'linear-gradient(#ccc 1px, transparent 1px), linear-gradient(90deg, #ccc 1px, transparent 1px)';
      container.style.backgroundSize = '20px 20px';

      // Add some markers
      createMarker(40.7128, -74.0060, 'New York');
      createMarker(34.0522, -118.2437, 'Los Angeles');
      createMarker(25.7617, -80.1918, 'Miami');

      // Add a title to the map
      const title = document.createElement('div');
      title.textContent = 'Basic Map - DOM Fallback';
      title.style.position = 'absolute';
      title.style.top = '10px';
      title.style.left = '10px';
      title.style.padding = '5px 10px';
      title.style.backgroundColor = 'white';
      title.style.borderRadius = '5px';
      title.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
      title.style.fontSize = '14px';
      title.style.fontWeight = 'bold';
      container.appendChild(title);

      setStatus('success');
    } catch (err) {
      console.error('Error creating basic map:', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error creating basic map');
    }
  }, []);

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-2">Basic Map Test</h2>
      <div className="mb-2">
        {status === 'loading' && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
            Loading basic map...
          </span>
        )}
        {status === 'success' && (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
            Basic map loaded successfully
          </span>
        )}
        {status === 'error' && (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
            Error loading basic map: {errorMessage}
          </span>
        )}
      </div>

      <div 
        ref={mapRef} 
        style={{ 
          height: '300px', 
          width: '100%', 
          border: '1px solid #ccc', 
          position: 'relative',
          backgroundColor: '#e0e0e0'
        }} 
      />

      <div className="mt-4 text-sm text-gray-600">
        <p>This is a simple fallback map that doesn't rely on external libraries or network resources.</p>
        <p>If you can see this map with markers for New York, San Francisco, and Miami, basic DOM manipulation is working.</p>
      </div>
    </div>
  );
}

export default BasicMapTest;