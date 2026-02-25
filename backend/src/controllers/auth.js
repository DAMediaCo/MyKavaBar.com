import bcrypt from 'bcryptjs';
import { query, queryOne, queryAll } from '../db.js';
import { generateToken, verifyToken } from '../middleware/auth.js';
import { generateReferralCode, isValidEmail, sanitizeInput } from '../utils/helpers.js';

// Register new user
export async function register(req, res) {
  try {
    const { email, password, username, phone, referralCode } = req.body;
    
    // Validation
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password, and username are required' });
    }
    
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if user exists
    const existingEmail = await queryOne(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const existingUsername = await queryOne(
      'SELECT id FROM users WHERE username = $1',
      [username.toLowerCase()]
    );
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Generate referral code
    const userReferralCode = generateReferralCode();
    
    // Handle referral
    let referredById = null;
    if (referralCode) {
      const referrer = await queryOne(
        'SELECT id FROM users WHERE referral_code = $1',
        [referralCode.toUpperCase()]
      );
      if (referrer) {
        referredById = referrer.id;
      }
    }
    
    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, username, phone, referral_code, referred_by, shells)
       VALUES ($1, $2, $3, $4, $5, $6, 10)
       RETURNING id, email, username, phone, shells, created_at`,
      [email.toLowerCase(), passwordHash, username.toLowerCase(), phone || null, userReferralCode, referredById]
    );
    
    const user = result.rows[0];
    
    // Generate token
    const token = generateToken(user);
    
    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        phone: user.phone,
        shells: user.shells,
        createdAt: user.created_at,
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}

// Login user
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const user = await queryOne(
      `SELECT id, email, username, phone, password_hash, shells, total_checkins, 
              unique_bars_visited, current_streak, longest_streak, avatar_url, theme, created_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(user);
    
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        phone: user.phone,
        shells: user.shells,
        totalCheckins: user.total_checkins,
        uniqueBarsVisited: user.unique_bars_visited,
        currentStreak: user.current_streak,
        longestStreak: user.longest_streak,
        avatarUrl: user.avatar_url,
        theme: user.theme,
        createdAt: user.created_at,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

// Get current user profile
export async function getMe(req, res) {
  try {
    const user = await queryOne(
      `SELECT id, email, username, phone, avatar_url, profile_frame, profile_ring,
              theme, shells, total_checkins, unique_bars_visited, current_streak, 
              longest_streak, last_checkin_date, referral_code, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get achievement count
    const achievements = await queryOne(
      'SELECT COUNT(*) as count FROM user_achievements WHERE user_id = $1',
      [req.user.id]
    );
    
    // Get mission progress
    const activeMissions = await queryOne(
      `SELECT COUNT(*) as count FROM user_missions 
       WHERE user_id = $1 AND completed_at IS NOT NULL AND claimed_at IS NULL`,
      [req.user.id]
    );
    
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      profileFrame: user.profile_frame,
      profileRing: user.profile_ring,
      theme: user.theme,
      shells: user.shells,
      totalCheckins: user.total_checkins,
      uniqueBarsVisited: user.unique_bars_visited,
      currentStreak: user.current_streak,
      longestStreak: user.longest_streak,
      lastCheckinDate: user.last_checkin_date,
      referralCode: user.referral_code,
      achievementsUnlocked: parseInt(achievements?.count || 0),
      pendingMissionRewards: parseInt(activeMissions?.count || 0),
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
}

// Refresh token
export async function refreshToken(req, res) {
  try {
    const user = await queryOne(
      'SELECT id, email, username FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const token = generateToken(user);
    
    res.json({ token });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
}

// Update profile
export async function updateProfile(req, res) {
  try {
    const { username, avatarUrl, theme, profileFrame, profileRing, phone } = req.body;
    
    // Check username uniqueness if changing
    if (username) {
      const existing = await queryOne(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username.toLowerCase(), req.user.id]
      );
      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (username) {
      updates.push(`username = $${paramCount++}`);
      values.push(username.toLowerCase());
    }
    if (avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`);
      values.push(avatarUrl);
    }
    if (theme) {
      updates.push(`theme = $${paramCount++}`);
      values.push(theme);
    }
    if (profileFrame) {
      updates.push(`profile_frame = $${paramCount++}`);
      values.push(profileFrame);
    }
    if (profileRing) {
      updates.push(`profile_ring = $${paramCount++}`);
      values.push(profileRing);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(req.user.id);
    
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}
       RETURNING id, email, username, phone, avatar_url, profile_frame, profile_ring, theme`,
      values
    );
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}
