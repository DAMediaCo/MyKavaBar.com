import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import MapView from './map-view';
import type { KavaBar } from '@/hooks/use-kava-bars';

interface MapProviderProps {
  barId?: number | string;
  zoom?: number;
  height?: string;
  width?: string;
  center?: { lat: number; lng: number };
}

export default function MapProvider({
  barId,
  zoom = 12,
  height = '500px',
  width = '100%',
  center
}: MapProviderProps) {
  const { toast } = useToast();
  
  // If barId is provided, fetch the bar's location
  const { data: bar, isLoading } = useQuery({
    queryKey: barId ? [`/api/kava-bars/${barId}`] : [],
    queryFn: async () => {
      if (!barId) return null;
      
      const response = await fetch(`/api/kava-bars/${barId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch bar details');
      }
      
      return response.json();
    },
    enabled: !!barId,
  });
  
  // Choose the location to display (either from props or from fetched bar)
  const displayLocation = center || (bar?.location ? { 
    lat: bar.location.lat, 
    lng: bar.location.lng 
  } : null);

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="flex items-center justify-center p-4" style={{ height }}>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!displayLocation) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-4" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Alert>
            <AlertDescription>
              Location data is not available. The map cannot be displayed.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Create an array with the single bar if we have it
  const bars: KavaBar[] = bar ? [bar as KavaBar] : [];

  // Use the MapView component to display the map with the bar location
  return (
    <Card className="shadow-sm">
      <CardContent className="p-0 overflow-hidden" style={{ height, width }}>
        <div style={{ height: '100%', width: '100%' }}>
          <MapView 
            bars={bars} 
            center={displayLocation} 
            zoom={zoom} 
          />
        </div>
      </CardContent>
    </Card>
  );
}