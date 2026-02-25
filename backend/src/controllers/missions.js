import { query, queryOne, queryAll, transaction } from '../db.js';

// Get active missions for user
export async function getMissions(req, res) {
  try {
    const userId = req.user.id;
    
    // Get active missions that haven't been completed by this user
    const missions = await query(
      `SELECT m.*, 
              um.id as user_mission_id, um.progress, um.completed_at, um.claimed_at
       FROM missions m
       LEFT JOIN user_missions um ON m.id = um.mission_id AND um.user_id = $1
       WHERE m.is_active = true
       AND (m.expires_at IS NULL OR m.expires_at > NOW())
       ORDER BY 
         CASE m.mission_type 
           WHEN 'daily' THEN 1 
           WHEN 'weekly' THEN 2 
           ELSE 3 
         END,
         m.created_at DESC`,
      [userId]
    );
    
    res.json({ missions: missions.rows });
  } catch (error) {
    console.error('Get missions error:', error);
    res.status(500).json({ error: 'Failed to get missions' });
  }
}

// Get mission history
export async function getMissionHistory(req, res) {
  try {
    const userId = req.user.id;
    
    const result = await query(
      `SELECT m.title, m.description, m.mission_type, m.shell_reward,
              um.completed_at, um.claimed_at
       FROM user_missions um
       JOIN missions m ON um.mission_id = m.id
       WHERE um.user_id = $1 AND um.claimed_at IS NOT NULL
       ORDER BY um.claimed_at DESC
       LIMIT 50`,
      [userId]
    );
    
    res.json({ history: result.rows });
  } catch (error) {
    console.error('Get mission history error:', error);
    res.status(500).json({ error: 'Failed to get mission history' });
  }
}

// Claim mission reward
export async function claimMission(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Get user mission
    const userMission = await queryOne(
      `SELECT um.*, m.shell_reward
       FROM user_missions um
       JOIN missions m ON um.mission_id = m.id
       WHERE um.mission_id = $1 AND um.user_id = $2`,
      [id, userId]
    );
    
    if (!userMission) {
      return res.status(404).json({ error: 'Mission not found' });
    }
    
    if (!userMission.completed_at) {
      return res.status(400).json({ error: 'Mission not completed' });
    }
    
    if (userMission.claimed_at) {
      return res.status(400).json({ error: 'Reward already claimed' });
    }
    
    // Claim reward
    await transaction(async (client) => {
      // Mark as claimed
      await client.query(
        'UPDATE user_missions SET claimed_at = NOW() WHERE id = $1',
        [userMission.id]
      );
      
      // Add shells
      await client.query(
        'UPDATE users SET shells = shells + $1 WHERE id = $2',
        [userMission.shell_reward, userId]
      );
    });
    
    res.json({ 
      message: 'Reward claimed',
      shellsEarned: userMission.shell_reward
    });
  } catch (error) {
    console.error('Claim mission error:', error);
    res.status(500).json({ error: 'Failed to claim reward' });
  }
}

// Check and complete missions (called after check-in)
export async function checkAndCompleteMissions(userId, barId) {
  try {
    // Get active missions for user
    const missions = await query(
      `SELECT m.*, um.id as um_id, um.progress
       FROM missions m
       LEFT JOIN user_missions um ON m.id = um.mission_id AND um.user_id = $1
       WHERE m.is_active = true
       AND (um.completed_at IS NULL OR um.claimed_at IS NOT NULL)`,
      [userId]
    );
    
    // Get user's check-in stats
    const userStats = await queryOne(
      'SELECT total_checkins, unique_bars_visited FROM users WHERE id = $1',
      [userId]
    );
    
    for (const mission of missions.rows) {
      const criteria = mission.criteria;
      let shouldComplete = false;
      let progress = mission.progress || {};
      
      // Check criteria
      if (criteria.checkins) {
        const required = criteria.checkins;
        progress.checkins_count = (progress.checkins_count || 0);
        if (userStats.total_checkins >= required) {
          shouldComplete = true;
        }
      }
      
      if (criteria.unique_bars) {
        const required = criteria.unique_bars;
        progress.bars_visited = progress.bars_visited || [];
        if (userStats.unique_bars_visited >= required) {
          shouldComplete = true;
        }
      }
      
      // If bar-specific mission
      if (criteria.bar_ids && barId) {
        progress.bars_visited = progress.bars_visited || [];
        if (!progress.bars_visited.includes(barId)) {
          progress.bars_visited.push(barId);
        }
        if (criteria.bar_ids.includes(barId)) {
          shouldComplete = progress.bars_visited.length >= criteria.bar_ids.length;
        }
      }
      
      if (shouldComplete && !mission.completed_at) {
        if (mission.um_id) {
          await query(
            'UPDATE user_missions SET completed_at = NOW(), progress = $1 WHERE id = $2',
            [JSON.stringify(progress), mission.um_id]
          );
        } else {
          await query(
            `INSERT INTO user_missions (user_id, mission_id, progress, completed_at)
             VALUES ($1, $2, $3, NOW())`,
            [userId, mission.id, JSON.stringify(progress)]
          );
        }
      }
    }
  } catch (error) {
    console.error('Check missions error:', error);
  }
}

// Create mission (admin)
export async function createMission(req, res) {
  try {
    const { title, description, missionType, criteria, shellReward, expiresAt } = req.body;
    
    if (!title || !missionType || !shellReward) {
      return res.status(400).json({ error: 'Title, type, and reward are required' });
    }
    
    const result = await query(
      `INSERT INTO missions (title, description, mission_type, criteria, shell_reward, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description, missionType, JSON.stringify(criteria || {}), shellReward, expiresAt]
    );
    
    res.status(201).json({ mission: result.rows[0] });
  } catch (error) {
    console.error('Create mission error:', error);
    res.status(500).json({ error: 'Failed to create mission' });
  }
}
