# MyKavaBar — Kava Passport Feature (v1)

## Overview
Digital passport where users check in at kava bars via GPS proximity, collect stamps, earn badges, and compete on leaderboards.

## v1 Scope: GPS-Only Check-in
- User must be within 200m of bar to check in
- Max 1 check-in per bar per 24h
- No QR codes (v2)

## Database Schema

### passport_checkins
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| user_id | int FK | references users |
| bar_id | int FK | references bars |
| checked_in_at | timestamp | default now() |
| lat | decimal | user's GPS at check-in |
| lng | decimal | user's GPS at check-in |
| notes | text | optional user note |

### passport_stats (cached/materialized)
| Column | Type | Notes |
|--------|------|-------|
| user_id | int PK FK | |
| total_checkins | int | all-time count |
| unique_bars | int | distinct bars visited |
| current_streak | int | consecutive days |
| longest_streak | int | all-time best |
| rank | int | global rank by unique bars |
| last_checkin_at | timestamp | |

## API Endpoints
- `POST /api/passport/checkin` — (bar_id, lat, lng) → verify proximity, create checkin, update stats
- `GET /api/passport/:userId` — stamps + stats
- `GET /api/leaderboard` — ?scope=global|monthly|state|city
- `GET /api/passport/badges/:userId` — earned badges

## Badges
| Badge | Requirement |
|-------|------------|
| 🌱 First Sip | First check-in |
| 🗺️ Explorer | 5 unique bars |
| 🏆 Kava King/Queen | 25 unique bars |
| 🌍 Globetrotter | Bars in 5+ states |
| 🔥 On Fire | 7-day streak |
| 👑 Legend | 50+ unique bars |

## Leaderboard
- Global (all-time unique bars)
- Monthly (resets, most check-ins)
- By state/city (local competition)
- Top 3 get 🥇🥈🥉

## Passport UI
- Grid of stamps (bar logo/icon, name, date, city)
- Empty "?" slots for nearby undiscovered bars
- Tap stamp → visit history for that bar

## Implementation Order
1. DB schema + migrations
2. Check-in API with GPS verification
3. Passport page — web
4. Leaderboard page — web
5. Badges/milestones logic
6. Mobile passport screen
7. Mobile leaderboard screen
8. Push notification for milestone proximity

## v2 Ideas (Future)
- QR code check-in (auto-generated per bar, printed at counter)
- Sponsored stamps (bars pay for custom stamp art)
- Featured bar spots on leaderboard
- Partner discounts for milestone achievements
- "Nearby undiscovered" push notifications

## Status: PLANNED — Not started
