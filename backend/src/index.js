import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';

import authRoutes from './routes/auth.js';
import barsRoutes from './routes/bars.js';
import eventsRoutes from './routes/events.js';
import checkinsRoutes from './routes/checkins.js';
import favoritesRoutes from './routes/favorites.js';
import missionsRoutes from './routes/missions.js';
import achievementsRoutes from './routes/achievements.js';
import leaderboardsRoutes from './routes/leaderboards.js';

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bars', barsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/checkins', checkinsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/missions', missionsRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/leaderboards', leaderboardsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// WebSocket handling for TV games
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_room', ({ roomId, userId }) => {
    socket.join(roomId);
    io.to(roomId).emit('player_joined', { userId, socketId: socket.id });
  });

  socket.on('game_action', ({ roomId, action, data }) => {
    io.to(roomId).emit('game_update', { action, data, socketId: socket.id });
  });

  socket.on('leave_room', ({ roomId }) => {
    socket.leave(roomId);
    io.to(roomId).emit('player_left', { socketId: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 MyKavaBar API running on port ${PORT}`);
  console.log(`   WebSocket ready for TV games`);
});

export { app, io };
