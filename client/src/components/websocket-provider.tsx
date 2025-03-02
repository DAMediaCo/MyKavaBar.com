import { createContext, useContext, useEffect, useState } from "react";
import { connectWebSocket, closeWebSocket } from "@/lib/websocket";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface WebSocketContextType {
  connected: boolean;
  connectionError: string | null;
}

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  connectionError: null
});

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      console.log('Initializing WebSocket connection for user:', {
        userId: user.id,
        isAdmin: user.isAdmin
      });

      try {
        connectWebSocket(user.id, user.isAdmin);
        setConnected(true);
        setConnectionError(null);
      } catch (error) {
        console.error('Error initializing WebSocket:', error);
        setConnected(false);
        setConnectionError(error instanceof Error ? error.message : 'Failed to connect');

        toast({
          title: "Connection Error",
          description: "Failed to establish server connection. Some features may be limited.",
          variant: "destructive",
        });
      }

      return () => {
        console.log('Cleaning up WebSocket connection');
        closeWebSocket();
        setConnected(false);
      };
    }
  }, [user, toast]);

  return (
    <WebSocketContext.Provider value={{ connected, connectionError }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => useContext(WebSocketContext);