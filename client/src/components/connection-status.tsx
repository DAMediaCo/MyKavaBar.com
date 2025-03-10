import React, { useState, useEffect } from 'react';
import { useMap } from './map-provider';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Map, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from '@/components/ui/tooltip';

export default function ConnectionStatus() {
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [databaseOnline, setDatabaseOnline] = useState<boolean>(false);
  const [checkingServer, setCheckingServer] = useState<boolean>(true);
  const [checkingDatabase, setCheckingDatabase] = useState<boolean>(true);
  const { isLoaded: mapApiLoaded, loadError: mapApiError } = useMap();

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        setCheckingServer(true);
        const response = await fetch('/api/health?t=' + Date.now(), {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        setServerOnline(response.ok);
      } catch (error) {
        console.error('Server health check error:', error);
        setServerOnline(false);
      } finally {
        setCheckingServer(false);
      }
    };

    const checkDatabaseStatus = async () => {
      try {
        setCheckingDatabase(true);
        const response = await fetch('/api/database-status?t=' + Date.now(), {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        setDatabaseOnline(response.ok);
      } catch (error) {
        console.error('Database status check error:', error);
        setDatabaseOnline(false);
      } finally {
        setCheckingDatabase(false);
      }
    };

    // Check initial status
    checkServerStatus();
    checkDatabaseStatus();

    // Set up periodic checks
    const serverInterval = setInterval(checkServerStatus, 30000); // Check every 30 seconds
    const dbInterval = setInterval(checkDatabaseStatus, 30000);

    return () => {
      clearInterval(serverInterval);
      clearInterval(dbInterval);
    };
  }, []);

  if (!import.meta.env.DEV) {
    // Only show in development mode
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={serverOnline ? "outline" : "destructive"} className="flex items-center gap-1 cursor-help">
              {serverOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span className="hidden sm:inline">API</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{serverOnline ? 'API Server: Connected' : 'API Server: Disconnected'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={databaseOnline ? "outline" : "destructive"} className="flex items-center gap-1 cursor-help">
              {databaseOnline ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              <span className="hidden sm:inline">DB</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{databaseOnline ? 'Database: Connected' : 'Database: Disconnected'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={mapApiLoaded ? "outline" : "destructive"} className="flex items-center gap-1 cursor-help">
              {mapApiLoaded ? <Map className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              <span className="hidden sm:inline">Maps</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>
              {mapApiLoaded
                ? 'Google Maps: Connected'
                : mapApiError
                  ? `Google Maps Error: ${mapApiError.message}`
                  : 'Google Maps: Disconnected'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}