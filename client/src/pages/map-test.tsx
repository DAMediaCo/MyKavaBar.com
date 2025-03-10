import { Link } from "wouter";
import { useState } from "react";
import MapTest from "@/components/map-test";
import BasicMapTest from "@/components/basic-map-test";

export default function MapTestPage() {
  const [currentTab, setCurrentTab] = useState<'leaflet' | 'basic'>('leaflet');
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Map Testing Center</h1>
      
      <div className="mb-4">
        <Link href="/" className="text-blue-500 hover:underline">
          &larr; Back to Home
        </Link>
      </div>
      
      <div className="mb-4 flex border-b">
        <button
          className={`px-4 py-2 font-medium ${
            currentTab === 'leaflet' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setCurrentTab('leaflet')}
        >
          React Leaflet Map
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            currentTab === 'basic' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setCurrentTab('basic')}
        >
          Basic Map Test
        </button>
      </div>
      
      <div className="p-4 border rounded mb-6">
        {currentTab === 'leaflet' && (
          <>
            <h2 className="text-lg font-semibold mb-2">React Leaflet Map Test</h2>
            <p className="mb-4">This tab tests if the React Leaflet map implementation is working correctly.</p>
            <MapTest />
          </>
        )}
        
        {currentTab === 'basic' && (
          <>
            <h2 className="text-lg font-semibold mb-2">Basic Map Fallback Test</h2>
            <p className="mb-4">This tab tests if a simple DOM-based map implementation works as a fallback.</p>
            <BasicMapTest />
          </>
        )}
      </div>
      
      <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50">
        <h3 className="font-medium text-yellow-800">Troubleshooting Tips</h3>
        <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
          <li>If the React Leaflet map doesn't display, try switching to the Basic Map Test tab</li>
          <li>If neither map displays, there may be an issue with the DOM or JavaScript execution</li>
          <li>Check browser console logs for errors by opening developer tools (F12)</li>
          <li>Some tile servers may be blocked by corporate firewalls or content blockers</li>
        </ul>
      </div>
    </div>
  );
}