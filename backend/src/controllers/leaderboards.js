import { query, queryOne } from '../db.js';

// Get leaderboards
export async function getLeaderboards(req, res) {
  try {
    const { type = 'shells', page = 1, limit = 20 } = req.query;
    
    let orderBy;
    switch (type) {
      case 'checkins':
        orderBy = 'total_checkins DESC';
        break;
      case 'streak':
        orderBy = 'current_streak DESC';
        break;
      case 'bars':
        orderBy = 'unique_bars_visited DESC';
        break;
      default:
        orderBy = 'shells DESC';
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const result = await query(
      `SELECT id, username, avatar_url, shells, total_checkins, 
              unique_bars_visited, current_streak, longest_streak
       FROM users
       WHERE status = 'active' OR status IS NULL
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );
    
    // Add rank
    const ranked = result.rows.map((user, index) => ({
      rank: offset + index + 1,
      ...user,
    }));
    
    res.json({ 
      type,
      leaderboard: ranked,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
      }
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
}
