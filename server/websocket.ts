import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Express } from 'express';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  isAdmin?: boolean;
  authenticated?: boolean;
  isAlive?: boolean;
}

interface ClientMessage {
  type: string;
  userId?: number;
  isAdmin?: boolean;
  barId?: number;
}

export function setupWebSocket(app: Express, server?: Server) {
  // Initialize WebSocket server with a specific path
  const wss = new WebSocketServer({ 
    noServer: true,
    path: '/ws'  // Specific path for WebSocket connections
  });

  // Heartbeat interval with error handling
  const interval = setInterval(() => {
    try {
      wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          console.log('Terminating inactive WebSocket connection');
          try {
            ws.terminate();
          } catch (error) {
            console.error('Error terminating WebSocket:', error);
          }
          return;
        }

        ws.isAlive = false;
        try {
          ws.ping();
        } catch (error) {
          console.error('Error sending ping:', error);
          ws.terminate();
        }
      });
    } catch (error) {
      console.error('Error in heartbeat interval:', error);
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    console.log('New WebSocket connection established');
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('ping', () => {
      try {
        ws.pong();
      } catch (error) {
        console.error('Error sending pong:', error);
      }
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString()) as ClientMessage;
        console.log('Received WebSocket message:', data);

        switch (data.type) {
          case 'AUTH':
            ws.userId = data.userId;
            ws.isAdmin = data.isAdmin;
            ws.authenticated = true;
            console.log('Client authenticated:', { 
              userId: ws.userId, 
              isAdmin: ws.isAdmin,
              clientsCount: wss.clients.size,
              adminCount: Array.from(wss.clients).filter((client: AuthenticatedWebSocket) => client.isAdmin).length
            });
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      try {
        ws.terminate();
      } catch (terminateError) {
        console.error('Error terminating WebSocket after error:', terminateError);
      }
    });

    ws.on('close', () => {
      ws.isAlive = false;
      console.log('Client disconnected:', {
        userId: ws.userId,
        isAdmin: ws.isAdmin,
        remainingClients: wss.clients.size
      });
    });
  });

  // Handle upgrade for WebSocket connections
  if (server) {
    server.on('upgrade', (request, socket, head) => {
      // Skip Vite HMR connections
      if (request.headers['sec-websocket-protocol'] === 'vite-hmr') {
        return;
      }

      console.log('Processing WebSocket upgrade request:', {
        url: request.url,
        path: wss.options.path,
        headers: {
          upgrade: request.headers.upgrade,
          connection: request.headers.connection,
          protocol: request.headers['sec-websocket-protocol']
        }
      });

      // Only handle requests for our WebSocket path
      if (request.url !== wss.options.path) {
        socket.destroy();
        return;
      }

      try {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } catch (error) {
        console.error('Error during WebSocket upgrade:', error);
        socket.destroy();
      }
    });
  }

  return wss;
}

export function notifyAdmins(wss: WebSocketServer, message: any) {
  console.log('Broadcasting to admins:', message);

  const adminClients = Array.from(wss.clients).filter(
    (client: AuthenticatedWebSocket) => client.isAdmin && client.authenticated
  );

  console.log(`Found ${adminClients.length} admin clients to notify`);

  adminClients.forEach((client: AuthenticatedWebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        console.log('Sending notification to admin:', client.userId);
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message to admin:', error);
      }
    } else {
      console.log('Admin client not in OPEN state:', {
        userId: client.userId,
        readyState: client.readyState
      });
    }
  });
}