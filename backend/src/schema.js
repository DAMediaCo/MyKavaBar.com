// MyKavaBar Backend - PostgreSQL Schema (Phase 1)
// All 14 tables as per specification

import { pool } from './db.js';

// ====================== USERS ======================
export const usersTable = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  profile_frame VARCHAR(50) DEFAULT 'default',
  profile_ring VARCHAR(50) DEFAULT 'none',
  theme VARCHAR(50) DEFAULT 'default',
  shells INTEGER DEFAULT 0,
  total_checkins INTEGER DEFAULT 0,
  unique_bars_visited INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_checkin_date DATE,
  referral_code VARCHAR(10) UNIQUE,
  referred_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
`;

// ====================== BARS ======================
export const barsTable = `
CREATE TABLE IF NOT EXISTS bars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  zip VARCHAR(10),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  phone VARCHAR(20),
  website TEXT,
  hours JSONB,
  description TEXT,
  photos JSONB,
  amenities JSONB,
  is_active BOOLEAN DEFAULT true,
  claimed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bars_location ON bars(state, city);
CREATE INDEX IF NOT EXISTS idx_bars_slug ON bars(slug);
`;

// ====================== EVENTS ======================
export const eventsTable = `
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(50),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_bar_id ON events(bar_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
`;

// ====================== MENUS ======================
export const menusTable = `
CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  description TEXT,
  price DECIMAL(6,2),
  photo_url TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_menus_bar_id ON menus(bar_id);
`;

// ====================== CHECK-INS ======================
export const checkinsTable = `
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bar_id UUID REFERENCES bars(id) ON DELETE CASCADE,
  validated_by UUID REFERENCES users(id),
  validation_method VARCHAR(20),
  photo_url TEXT,
  note TEXT,
  shells_earned INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_bar_id ON checkins(bar_id);
CREATE INDEX IF NOT EXISTS idx_checkins_created_at ON checkins(created_at);
`;

// ====================== FAVORITES ======================
export const favoritesTable = `
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bar_id UUID REFERENCES bars(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, bar_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
`;

// ====================== MISSIONS ======================
export const missionsTable = `
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  mission_type VARCHAR(50),
  criteria JSONB,
  shell_reward INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_missions_type ON missions(mission_type);
CREATE INDEX IF NOT EXISTS idx_missions_active ON missions(is_active);
`;

// ====================== USER MISSIONS ======================
export const userMissionsTable = `
CREATE TABLE IF NOT EXISTS user_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  progress JSONB,
  completed_at TIMESTAMP,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, mission_id)
);
CREATE INDEX IF NOT EXISTS idx_user_missions_user_id ON user_missions(user_id);
`;

// ====================== ACHIEVEMENTS ======================
export const achievementsTable = `
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  category VARCHAR(50),
  requirement JSONB,
  shell_reward INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_achievements_key ON achievements(key);
`;

// ====================== USER ACHIEVEMENTS ======================
export const userAchievementsTable = `
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
`;

// ====================== KAVA CRAWLS ======================
export const kavaCrawlsTable = `
CREATE TABLE IF NOT EXISTS kava_crawls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  bar_ids JSONB NOT NULL,
  is_template BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  shell_reward INTEGER DEFAULT 200,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kava_crawls_creator ON kava_crawls(creator_id);
`;

// ====================== CRAWL PARTICIPANTS ======================
export const crawlParticipantsTable = `
CREATE TABLE IF NOT EXISTS crawl_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id UUID REFERENCES kava_crawls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  progress JSONB,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(crawl_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_crawl_participants_crawl ON crawl_participants(crawl_id);
CREATE INDEX IF NOT EXISTS idx_crawl_participants_user ON crawl_participants(user_id);
`;

// ====================== GAME ROOMS ======================
export const gameRoomsTable = `
CREATE TABLE IF NOT EXISTS game_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id) ON DELETE CASCADE,
  game_type VARCHAR(50) NOT NULL,
  join_code VARCHAR(6) UNIQUE NOT NULL,
  host_id UUID REFERENCES users(id),
  state JSONB,
  is_active BOOLEAN DEFAULT true,
  max_players INTEGER DEFAULT 8,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '4 hours'
);
CREATE INDEX IF NOT EXISTS idx_game_rooms_code ON game_rooms(join_code);
CREATE INDEX IF NOT EXISTS idx_game_rooms_active ON game_rooms(is_active);
`;

// ====================== GAME PARTICIPANTS ======================
export const gameParticipantsTable = `
CREATE TABLE IF NOT EXISTS game_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_game_participants_room ON game_participants(room_id);
`;

// Run all migrations
export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    
    const tables = [
      { name: 'users', sql: usersTable },
      { name: 'bars', sql: barsTable },
      { name: 'events', sql: eventsTable },
      { name: 'menus', sql: menusTable },
      { name: 'checkins', sql: checkinsTable },
      { name: 'favorites', sql: favoritesTable },
      { name: 'missions', sql: missionsTable },
      { name: 'user_missions', sql: userMissionsTable },
      { name: 'achievements', sql: achievementsTable },
      { name: 'user_achievements', sql: userAchievementsTable },
      { name: 'kava_crawls', sql: kavaCrawlsTable },
      { name: 'crawl_participants', sql: crawlParticipantsTable },
      { name: 'game_rooms', sql: gameRoomsTable },
      { name: 'game_participants', sql: gameParticipantsTable },
    ];

    for (const table of tables) {
      await client.query(table.sql);
      console.log(`✓ ${table.name} table ready`);
    }

    console.log('All migrations complete!');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Export table names for reference
export const tableNames = {
  users: 'users',
  bars: 'bars',
  events: 'events',
  menus: 'menus',
  checkins: 'checkins',
  favorites: 'favorites',
  missions: 'missions',
  userMissions: 'user_missions',
  achievements: 'achievements',
  userAchievements: 'user_achievements',
  kavaCrawls: 'kava_crawls',
  crawlParticipants: 'crawl_participants',
  gameRooms: 'game_rooms',
  gameParticipants: 'game_participants',
};
