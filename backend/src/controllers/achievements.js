import { query, queryOne, queryAll, transaction } from '../db.js';

// Get all achievements with user progress
export async function getAchievements(req, res) {
  try {
    const userId = req.user?.id;
    
    const achievements = await query(
      `SELECT a.*, 
              ua.id as user_achievement_id, ua.unlocked_at
       FROM achievements a
       LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
       ORDER BY a.category, a.title`,
      [userId || null]
    );
    
    // Group by category
    const grouped = achievements.rows.reduce((acc, achievement) => {
      const cat = achievement.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(achievement);
      return acc;
    }, {});
    
    res.json({ 
      achievements: achievements.rows,
      groupedByCategory: grouped,
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
}

// Get user's unlocked achievements
export async function getMyAchievements(req, res) {
  try {
    const userId = req.user.id;
    
    const result = await query(
      `SELECT a.key, a.title, a.description, a.icon, a.category, a.shell_reward,
              ua.unlocked_at
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.id
       WHERE ua.user_id = $1
       ORDER BY ua.unlocked_at DESC`,
      [userId]
    );
    
    res.json({ achievements: result.rows });
  } catch (error) {
    console.error('Get my achievements error:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
}

// Check and unlock achievements (called after check-in)
export async function checkAndUnlockAchievements(userId) {
  try {
    // Get user stats
    const user = await queryOne(
      `SELECT total_checkins, unique_bars_visited, current_streak, longest_streak
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (!user) return;
    
    // Get all achievements user hasn't unlocked yet
    const achievements = await query(
      `SELECT a.* 
       FROM achievements a
       LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
       WHERE ua.id IS NULL`,
      [userId]
    );
    
    for (const achievement of achievements.rows) {
      const req = achievement.requirement;
      let shouldUnlock = false;
      
      if (req.total_checkins && user.total_checkins >= req.total_checkins) {
        shouldUnlock = true;
      }
      if (req.unique_bars && user.unique_bars_visited >= req.unique_bars) {
        shouldUnlock = true;
      }
      if (req.streak && user.current_streak >= req.streak) {
        shouldUnlock = true;
      }
      if (req.longest_streak && user.longest_streak >= req.longest_streak) {
        shouldUnlock = true;
      }
      
      if (shouldUnlock) {
        // Unlock achievement
        await transaction(async (client) => {
          await client.query(
            'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
            [userId, achievement.id]
          );
          
          // Award shells if reward exists
          if (achievement.shell_reward) {
            await client.query(
              'UPDATE users SET shells = shells + $1 WHERE id = $2',
              [achievement.shell_reward, userId]
            );
          }
        });
        
        console.log(`User ${userId} unlocked achievement: ${achievement.title}`);
      }
    }
  } catch (error) {
    console.error('Check achievements error:', error);
  }
}

// Create achievement (admin)
export async function createAchievement(req, res) {
  try {
    const { key, title, description, icon, category, requirement, shellReward } = req.body;
    
    if (!key || !title) {
      return res.status(400).json({ error: 'Key and title are required' });
    }
    
    // Check key uniqueness
    const existing = await queryOne(
      'SELECT id FROM achievements WHERE key = $1',
      [key]
    );
    
    if (existing) {
      return res.status(400).json({ error: 'Achievement key already exists' });
    }
    
    const result = await query(
      `INSERT INTO achievements (key, title, description, icon, category, requirement, shell_reward)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [key, title, description, icon, category, JSON.stringify(requirement || {}), shellReward || 0]
    );
    
    res.status(201).json({ achievement: result.rows[0] });
  } catch (error) {
    console.error('Create achievement error:', error);
    res.status(500).json({ error: 'Failed to create achievement' });
  }
}
