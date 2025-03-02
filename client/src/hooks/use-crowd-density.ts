import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export type CrowdDensityLevel = 'low' | 'medium' | 'high' | 'very_high';

export interface CrowdDensity {
  id: number;
  barId: number;
  level: CrowdDensityLevel;
  count?: number;
  timestamp: string;
  note?: string;
}

interface CrowdUpdate {
  type: 'crowd_update';
  barId: number;
  level: CrowdDensityLevel;
  count?: number;
  timestamp: string;
}

export function useCrowdDensity(barId: number) {
  const ws = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeout = useRef<NodeJS.Timeout>();

  // Fetch initial crowd density data
  const { data: history } = useQuery<CrowdDensity[]>({
    queryKey: [`/api/kava-bars/${barId}/crowd-density`],
    staleTime: 0, // Always fetch fresh data
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    console.log('Connecting to WebSocket...');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws.current = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      // Subscribe to updates for this bar
      if (ws.current) {
        const subscribeMessage = JSON.stringify({ type: 'subscribe', barId });
        console.log('Subscribing to updates:', subscribeMessage);
        ws.current.send(subscribeMessage);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      // Try to reconnect after 5 seconds
      reconnectTimeout.current = setTimeout(connect, 5000);
    };

    ws.current.onmessage = (event) => {
      try {
        console.log('Received WebSocket message:', event.data);
        const update = JSON.parse(event.data) as CrowdUpdate;
        if (update.type === 'crowd_update' && update.barId === barId) {
          console.log('Processing crowd update:', update);
          // Update the query cache with the new data
          queryClient.setQueryData<CrowdDensity[]>(
            [`/api/kava-bars/${barId}/crowd-density`],
            (old) => {
              const newDensity: CrowdDensity = {
                id: Math.random(), // Temporary ID for new entries
                barId: update.barId,
                level: update.level,
                count: update.count,
                timestamp: update.timestamp
              };

              console.log('Updating density data:', newDensity);
              if (!old) return [newDensity];
              return [newDensity, ...old];
            }
          );
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [barId, queryClient]);

  // Connect on mount and cleanup on unmount
  useEffect(() => {
    connect();
    return () => {
      console.log('Cleaning up WebSocket connection');
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [connect]);

  const updateDensity = useCallback(async (
    level: CrowdDensityLevel,
    count?: number,
    note?: string
  ) => {
    console.log('Updating density:', { level, count, note });
    const response = await fetch(`/api/kava-bars/${barId}/crowd-density`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ level, count, note }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to update crowd density');
    }

    const data = await response.json();
    console.log('Density update response:', data);
    return data;
  }, [barId]);

  return {
    history,
    isConnected,
    updateDensity,
    currentDensity: history?.[0], // Return the most recent density update
  };
}