
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map-styles.css';
import { Bar } from '@/types/bar';

// Fix Leaflet icon paths
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default icon issue in Leaflet
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  bars: Bar[];
  center: { lat: number; lng: number };
  zoom: number;
  userLocation?: { lat: number; lng: number };
}

export default function MapView({ bars, center, zoom, userLocation }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  
  // Initialize map on first render
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Initialize the map only if it hasn't been initialized yet
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(
        [center.lat, center.lng], 
        zoom
      );
      
      // Add tile layer (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }
    
    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map center and zoom when props change
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom]);

  // Add/update markers for bars
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    // Add markers for each bar
    bars.forEach(bar => {
      if (bar.latitude && bar.longitude) {
        const marker = L.marker([bar.latitude, bar.longitude])
          .addTo(mapRef.current!)
          .bindPopup(`<strong>${bar.name}</strong><br>${bar.address || ''}`);
        
        markersRef.current.push(marker);
      }
    });
  }, [bars]);

  // Add/update user location marker
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Remove existing user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    
    // Add user location marker if available
    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: '<div class="user-location-dot"></div><div class="user-location-pulse"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(mapRef.current)
        .bindPopup('Your location');
    }
  }, [userLocation]);

  return (
    <div ref={mapContainerRef} className="map-container" style={{ height: '100%', width: '100%' }}></div>
  );
}
