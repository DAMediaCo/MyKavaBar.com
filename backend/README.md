# MyKavaBar Backend API - Phase 1

Node.js Express + PostgreSQL API for MyKavaBar iOS app.

## Quick Start

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database URL
npm run migrate
npm run seed
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/me` - Update profile

### Bars
- `GET /api/bars` - List bars (filters: city, state, search)
- `GET /api/bars/:id` - Get bar details
- `GET /api/bars/:id/events` - Get bar events
- `GET /api/bars/:id/menu` - Get bar menu
- `POST /api/bars/:id/claim` - Claim bar ownership

### Events
- `GET /api/events` - List events
- `GET /api/events/:id` - Get event details
- `POST /api/events` - Create event (kavatender)
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Check-ins
- `POST /api/checkins` - Create check-in (with geo-validation)
- `GET /api/checkins/me` - Get my check-in history
- `GET /api/checkins/stats` - Get user stats
- `POST /api/checkins/:id/validate` - Kavatender validates

### Favorites
- `GET /api/favorites` - Get my favorites
- `POST /api/favorites` - Add to favorites
- `DELETE /api/favorites/:barId` - Remove from favorites

### Missions
- `GET /api/missions` - Get active missions
- `GET /api/missions/history` - Get completed missions
- `POST /api/missions/:id/claim` - Claim reward

### Achievements
- `GET /api/achievements` - Get all achievements + progress
- `GET /api/achievements/me` - Get unlocked achievements

## Features

- ✅ JWT Authentication
- ✅ Geo-fencing (Haversine formula)
- ✅ Streak calculation
- ✅ Mission auto-complete
- ✅ Achievement system
- ✅ Shell economy (10 base + 25 new bar bonus)
- ✅ Socket.io for real-time TV games
- ✅ Rate limiting & security middleware

## Database Schema (14 tables)

- users
- bars
- events
- menus
- checkins
- favorites
- missions
- user_missions
- achievements
- user_achievements
- kava_crawls
- crawl_participants
- game_rooms
- game_participants
