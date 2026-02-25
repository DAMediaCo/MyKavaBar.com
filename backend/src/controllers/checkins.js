import { query, queryOne, queryAll, transaction } from '../db.js';
import { isWithinRange, calculateStreak, calculateCheckinShells } from '../utils/helpers.js';
import { checkAndCompleteMissions } from './missions.js';
import { checkAndUnlockAchievements } from './achievements.js';

// Create check-in
export async function createCheckin(req, res) {
  try {
    const { barId, photoUrl, note, latitude, longitude, validationMethod } = req.body;
    const userId = req.user.id;
    
    if (!barId) {
      return res.status(400).json({ error: 'Bar ID is required' });
    }
    
    // Get bar details
    const bar = await queryOne(
      'SELECT id, name, latitude, longitude FROM bars WHERE id = $1',
      [barId]
    );
    
    if (!bar) {
      return res.status(404).json({ error: 'Bar not found' });
    }
    
    // Check geo-fencing if coordinates provided
    if (latitude && longitude && bar.latitude && bar.longitude) {
      const withinRange = isWithinRange(latitude, longitude, parseFloat(bar.latitude), parseFloat(bar.longitude));
      if (!withinRange) {
        return res.status(400).json({ 
          error: 'You must be at the bar to check in',
          code: 'NOT_AT_BAR'
        });
      }
    }
    
    // Check if this is a new bar for the user
    const existingCheckin = await queryOne(
      'SELECT id FROM checkins WHERE user_id = $1 AND bar_id = $2',
      [userId, barId]
    );
    const isNewBar = !existingCheckin;
    
    // Calculate shells
    const shellsEarned = calculateCheckinShells(isNewBar);
    
    // Run in transaction
    const result = await transaction(async (client) => {
      // Create check-in record
      const checkinResult = await client.query(
        `INSERT INTO checkins (user_id, bar_id, validated_by, validation_method, photo_url, note, shells_earned)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, barId, null, validationMethod || 'auto', photoUrl, note, shellsEarned]
      );
      
      // Get user's last check-in dates for streak calculation
      const userCheckins = await client.query(
        `SELECT created_at FROM checkins 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 30`,
        [userId]
      );
      
      const checkinDates = userCheckins.rows.map(c => c.created_at);
      const { currentStreak, longestStreak } = calculateStreak(checkinDates);
      
      // Update user stats
      const uniqueBarsUpdate = isNewBar 
        ? ', unique_bars_visited = unique_bars_visited + 1' 
        : '';
      
      await client.query(
        `UPDATE users SET 
           shells = shells + $1,
           total_checkins = total_checkins + 1,
           current_streak = $2,
           longest_streak = GREATEST(longest_streak, $3),
           last_checkin_date = CURRENT_DATE,
           updated_at = NOW()
         ${uniqueBarsUpdate}
         WHERE id = $4`,
        [shellsEarned, currentStreak, longestStreak, userId]
      );
      
      return { 
        checkin: checkinResult.rows[0],
        isNewBar,
        shellsEarned,
        currentStreak,
        longestStreak
      };
    });
    
    // Check for mission completion (async, don't wait)
    checkAndCompleteMissions(userId, barId);
    checkAndUnlockAchievements(userId);
    
    res.status(201).json({
      message: 'Check-in successful',
      checkin: {
        id: result.checkin.id,
        barId: result.checkin.bar_id,
        shellsEarned: result.shellsEarned,
        createdAt: result.checkin.created_at,
      },
      isNewBar,
      totalShells: result.shellsEarned, // Will need to fetch actual total
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
}

// Get user's check-in history
export async function getMyCheckins(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const result = await query(
      `SELECT c.id, c.bar_id, c.photo_url, c.note, c.shells_earned, c.created_at,
              b.name as bar_name, b.city, b.state, b.address
       FROM checkins c
       LEFT JOIN bars b ON c.bar_id = b.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), offset]
    );
    
    // Get total count
    const countResult = await queryOne(
      'SELECT COUNT(*) as total FROM checkins WHERE user_id = $1',
      [userId]
    );
    
    res.json({
      checkins: result.rows,
      pagination: {
        total: parseInt(countResult.total),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.total / parseInt(limit)),
      }
    });
  } catch (error) {
    console.error('Get checkins error:', error);
    res.status(500).json({ error: 'Failed to get check-ins' });
  }
}

// Validate check-in (kavatender)
export async function validateCheckin(req, res) {
  try {
    const { id } = req.params;
    const { validatedBy } = req.body;
    
    const checkin = await queryOne(
      'SELECT id, user_id, bar_id, validated_by FROM checkins WHERE id = $1',
      [id]
    );
    
    if (!checkin) {
      return res.status(404).json({ error: 'Check-in not found' });
    }
    
    if (checkin.validated_by) {
      return res.status(400).json({ error: 'Check-in already validated' });
    }
    
    await query(
      `UPDATE checkins SET validated_by = $1, validation_method = 'manual'
       WHERE id = $2`,
      [validatedBy || req.user.id, id]
    );
    
    res.json({ message: 'Check-in validated' });
  } catch (error) {
    console.error('Validate checkin error:', error);
    res.status(500).json({ error: 'Failed to validate check-in' });
  }
}

// Get user check-in stats
export async function getCheckinStats(req, res) {
  try {
    const userId = req.user.id;
    
    const stats = await queryOne(
      `SELECT shells, total_checkins, unique_bars_visited, 
              current_streak, longest_streak, last_checkin_date
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (!stats) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get this month's check-ins
    const monthlyCheckins = await queryOne(
      `SELECT COUNT(*) as count FROM checkins 
       WHERE user_id = $1 
       AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [userId]
    );
    
    // Get this week's check-ins
    const weeklyCheckins = await queryOne(
      `SELECT COUNT(*) as count FROM checkins 
       WHERE user_id = $1 
       AND created_at >= DATE_TRUNC('week', CURRENT_DATE)`,
      [userId]
    );
    
    res.json({
      shells: stats.shells,
      totalCheckins: stats.total_checkins,
      uniqueBarsVisited: stats.unique_bars_visited,
      currentStreak: stats.current_streak,
      longestStreak: stats.longest_streak,
      lastCheckinDate: stats.last_checkin_date,
      monthlyCheckins: parseInt(monthlyCheckins?.count || 0),
      weeklyCheckins: parseInt(weeklyCheckins?.count || 0),
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}
