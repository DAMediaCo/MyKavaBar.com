import { Link } from "wouter";
import MapTest from "@/components/map-test";

export default function MapTestPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Google Maps API Test</h1>
      
      <div className="mb-4">
        <Link href="/" className="text-blue-500 hover:underline">
          &larr; Back to Home
        </Link>
      </div>
      
      <div className="p-4 border rounded mb-6">
        <h2 className="text-lg font-semibold mb-2">API Status Test</h2>
        <p className="mb-4">This page tests if the Google Maps API is working correctly.</p>
        <MapTest />
      </div>
    </div>
  );
}