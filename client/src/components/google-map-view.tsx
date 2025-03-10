import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { useMap } from './map-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

const containerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '0.5rem',
};

const defaultOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: true,
  scrollwheel: true,
  mapTypeControl: true,
  fullscreenControl: true,
};

interface GoogleMapViewProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: Array<{
    id: number | string;
    position: { lat: number; lng: number };
    title: string;
    content?: React.ReactNode;
  }>;
  height?: string | number;
  onMarkerClick?: (id: number | string) => void;
  showInfoOnHover?: boolean;
  className?: string;
}

export default function GoogleMapView({
  center = { lat: 28.3772, lng: -80.6077 }, // Default to Melbourne, FL
  zoom = 10,
  markers = [],
  height = '400px',
  onMarkerClick,
  showInfoOnHover = false,
  className = '',
}: GoogleMapViewProps) {
  const { isLoaded, loadError } = useMap();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<number | string | null>(null);

  // Styling
  const mapContainerStyle = {
    ...containerStyle,
    height,
  };

  // Map ref callback when the map loads
  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  // Cleanup function
  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // When markers change, reset the selected marker
  useEffect(() => {
    setSelectedMarker(null);
  }, [markers]);

  // Handle marker click
  const handleMarkerClick = (markerId: number | string) => {
    setSelectedMarker(markerId);
    if (onMarkerClick) {
      onMarkerClick(markerId);
    }
  };

  // If the map isn't loaded yet, show a skeleton loader
  if (!isLoaded) {
    return (
      <Skeleton className={`w-full h-[${typeof height === 'number' ? `${height}px` : height}] ${className}`} />
    );
  }

  // Show error message if map failed to load
  if (loadError) {
    return (
      <div className={`w-full flex flex-col items-center justify-center p-6 border border-dashed rounded-lg ${className}`} style={{ height }}>
        <p className="text-destructive mb-2">Failed to load Google Maps</p>
        <p className="text-sm text-muted-foreground">{loadError.message}</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={zoom}
        options={defaultOptions}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            title={marker.title}
            onClick={() => handleMarkerClick(marker.id)}
            onMouseOver={() => showInfoOnHover && setSelectedMarker(marker.id)}
            onMouseOut={() => showInfoOnHover && setSelectedMarker(null)}
          />
        ))}

        {selectedMarker !== null && (
          <InfoWindow
            position={markers.find(m => m.id === selectedMarker)?.position}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="p-1 max-w-xs">
              {markers.find(m => m.id === selectedMarker)?.content || (
                <div>
                  <h3 className="font-medium">{markers.find(m => m.id === selectedMarker)?.title}</h3>
                  <div className="mt-1">
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto text-xs"
                      onClick={() => {
                        const marker = markers.find(m => m.id === selectedMarker);
                        if (marker) {
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${marker.position.lat},${marker.position.lng}`,
                            '_blank'
                          );
                        }
                      }}
                    >
                      View in Google Maps <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}