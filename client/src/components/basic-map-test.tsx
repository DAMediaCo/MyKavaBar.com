import React, { useEffect, useRef, useState } from 'react';

// This is an extremely simplified map test that uses direct DOM manipulation
// to create a map without any dependencies on external libraries
function BasicMapTest() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Only run this once when the component mounts
    if (!mapRef.current) return;

    try {
      // Create a simple static map image
      const container = mapRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      // Check if we can create and manipulate DOM elements
      container.innerHTML = '';
      container.style.position = 'relative';
      container.style.overflow = 'hidden';
      
      // Create a heading
      const heading = document.createElement('h3');
      heading.textContent = 'Basic Map Test';
      heading.style.position = 'absolute';
      heading.style.top = '10px';
      heading.style.left = '10px';
      heading.style.zIndex = '1000';
      heading.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
      heading.style.padding = '5px 10px';
      heading.style.borderRadius = '4px';
      heading.style.margin = '0';
      heading.style.fontSize = '16px';
      container.appendChild(heading);
      
      // Create markers for test locations
      const markers = [
        { name: 'New York', x: Math.round(width * 0.75), y: Math.round(height * 0.33) },
        { name: 'San Francisco', x: Math.round(width * 0.15), y: Math.round(height * 0.4) },
        { name: 'Miami', x: Math.round(width * 0.8), y: Math.round(height * 0.7) }
      ];
      
      // Create a static map background (fallback)
      const mapBackground = document.createElement('div');
      mapBackground.style.position = 'absolute';
      mapBackground.style.top = '0';
      mapBackground.style.left = '0';
      mapBackground.style.width = '100%';
      mapBackground.style.height = '100%';
      mapBackground.style.backgroundColor = '#e8ecf0';
      mapBackground.style.backgroundImage = `linear-gradient(45deg, #d4e0ed 25%, transparent 25%), 
                                             linear-gradient(-45deg, #d4e0ed 25%, transparent 25%), 
                                             linear-gradient(45deg, transparent 75%, #d4e0ed 75%), 
                                             linear-gradient(-45deg, transparent 75%, #d4e0ed 75%)`;
      mapBackground.style.backgroundSize = '20px 20px';
      mapBackground.style.backgroundPosition = '0 0, 0 10px, 10px -10px, -10px 0px';
      container.appendChild(mapBackground);
      
      // Add a "US outline" rectangle as a simple representation
      const usOutline = document.createElement('div');
      usOutline.style.position = 'absolute';
      usOutline.style.top = '30%';
      usOutline.style.left = '15%';
      usOutline.style.width = '70%';
      usOutline.style.height = '40%';
      usOutline.style.border = '2px solid #3388cc';
      usOutline.style.borderRadius = '5px';
      usOutline.style.backgroundColor = 'rgba(51, 136, 204, 0.1)';
      container.appendChild(usOutline);
      
      // Create each marker
      markers.forEach((marker, index) => {
        const markerElement = document.createElement('div');
        markerElement.style.position = 'absolute';
        markerElement.style.top = `${marker.y - 25}px`;
        markerElement.style.left = `${marker.x - 12}px`;
        markerElement.style.width = '24px';
        markerElement.style.height = '24px';
        markerElement.style.borderRadius = '50% 50% 50% 0';
        markerElement.style.backgroundColor = '#3388cc';
        markerElement.style.transform = 'rotate(-45deg)';
        markerElement.style.cursor = 'pointer';
        markerElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        
        // Create the inner circle
        const inner = document.createElement('div');
        inner.style.position = 'absolute';
        inner.style.top = '6px';
        inner.style.left = '6px';
        inner.style.width = '12px';
        inner.style.height = '12px';
        inner.style.borderRadius = '50%';
        inner.style.backgroundColor = 'white';
        markerElement.appendChild(inner);
        
        // Create label
        const label = document.createElement('div');
        label.textContent = marker.name;
        label.style.position = 'absolute';
        label.style.top = '25px';
        label.style.left = '0';
        label.style.transform = 'rotate(45deg)';
        label.style.whiteSpace = 'nowrap';
        label.style.fontSize = '12px';
        label.style.fontWeight = 'bold';
        label.style.color = '#333';
        label.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        label.style.padding = '2px 4px';
        label.style.borderRadius = '2px';
        markerElement.appendChild(label);
        
        // Add to container
        container.appendChild(markerElement);
        
        // Add click event
        markerElement.addEventListener('click', () => {
          alert(`Clicked on ${marker.name}`);
        });
      });
      
      // Success callback
      setStatus('success');
      console.log('Basic map test rendered successfully');
    } catch (error) {
      // Error handling
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error rendering map');
      console.error('Error in basic map test:', error);
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