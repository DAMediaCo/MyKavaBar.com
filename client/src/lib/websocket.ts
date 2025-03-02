import { toast } from "@/hooks/use-toast";

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

function getWebSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  // Use the specific WebSocket path
  return `${protocol}//${host}/ws`;
}

export function connectWebSocket(userId?: number, isAdmin?: boolean) {
  if (ws) {
    console.log('WebSocket connection already exists');
    return;
  }

  try {
    console.log('Attempting to connect WebSocket...', {
      url: getWebSocketUrl(),
      userId,
      isAdmin
    });

    ws = new WebSocket(getWebSocketUrl());

    ws.onopen = () => {
      console.log('WebSocket connection established');
      reconnectAttempts = 0;

      // Send authentication message
      if (userId) {
        try {
          ws.send(JSON.stringify({
            type: 'AUTH',
            userId,
            isAdmin
          }));
          console.log('Authentication message sent');
        } catch (error) {
          console.error('Error sending authentication message:', error);
        }
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket connection closed:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      ws = null;

      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        console.log(`Attempting to reconnect (${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(() => {
          reconnectAttempts++;
          connectWebSocket(userId, isAdmin);
        }, RECONNECT_DELAY);
      } else {
        console.log('Max reconnection attempts reached');
        toast({
          title: "Connection Lost",
          description: "Unable to maintain connection to the server. Please refresh the page.",
          variant: "destructive",
        });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', {
        error,
        readyState: ws?.readyState,
        url: getWebSocketUrl()
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received message:', data);

        switch (data.type) {
          case 'PING':
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'PONG' }));
            }
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

  } catch (error) {
    console.error('Error creating WebSocket connection:', {
      error,
      url: getWebSocketUrl(),
      userId,
      isAdmin
    });
    ws = null;
  }
}

export function closeWebSocket() {
  if (ws) {
    try {
      ws.close();
    } catch (error) {
      console.error('Error closing WebSocket:', error);
    }
    ws = null;
  }
}

export function sendWebSocketMessage(message: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Communication Error",
        description: "Failed to send message to server",
        variant: "destructive",
      });
    }
  } else {
    console.warn('WebSocket is not connected');
    toast({
      title: "Connection Issue",
      description: "Not connected to server",
      variant: "destructive",
    });
  }
}