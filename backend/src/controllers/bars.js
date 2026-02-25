import { query, queryOne, queryAll } from '../db.js';

// Get all bars with filters
export async function getBars(req, res) {
  try {
    const { city, state, search, page = 1, limit = 20 } = req.query;
    
    let whereClause = 'WHERE is_active = true';
    const values = [];
    let paramCount = 1;
    
    if (city) {
      whereClause += ` AND LOWER(city) = LOWER($${paramCount++})`;
      values.push(city);
    }
    
    if (state) {
      whereClause += ` AND LOWER(state) = LOWER($${paramCount++})`;
      values.push(state);
    }
    
    if (search) {
      whereClause += ` AND (LOWER(name) LIKE LOWER($${paramCount}) OR LOWER(description) LIKE LOWER($${paramCount}))`;
      values.push(`%${search}%`);
      paramCount++;
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count
    const countResult = await queryOne(
      `SELECT COUNT(*) as total FROM bars ${whereClause}`,
      values
    );
    
    // Get bars
    const result = await query(
      `SELECT id, name, slug, address, city, state, zip, phone, website, 
              latitude, longitude, hours, description, photos, amenities, 
              is_active, created_at
       FROM bars ${whereClause}
       ORDER BY name ASC
       LIMIT $${paramCount++} OFFSET $${paramCount}`,
      [...values, parseInt(limit), offset]
    );
    
    res.json({
      bars: result.rows,
      pagination: {
        total: parseInt(countResult.total),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.total / parseInt(limit)),
      }
    });
  } catch (error) {
    console.error('Get bars error:', error);
    res.status(500).json({ error: 'Failed to get bars' });
  }
}

// Get single bar by ID
export async function getBarById(req, res) {
  try {
    const { id } = req.params;
    
    const bar = await queryOne(
      `SELECT id, name, slug, address, city, state, zip, phone, website,
              latitude, longitude, hours, description, photos, amenities,
              is_active, claimed_by, created_at
       FROM bars WHERE id = $1`,
      [id]
    );
    
    if (!bar) {
      return res.status(404).json({ error: 'Bar not found' });
    }
    
    // Get check-in count
    const checkinCount = await queryOne(
      'SELECT COUNT(*) as count FROM checkins WHERE bar_id = $1',
      [id]
    );
    
    // Get rating average (if reviews exist - placeholder)
    const rating = 0; // Will integrate with existing reviews system
    
    res.json({
      ...bar,
      checkinCount: parseInt(checkinCount?.count || 0),
      rating,
    });
  } catch (error) {
    console.error('Get bar error:', error);
    res.status(500).json({ error: 'Failed to get bar' });
  }
}

// Get bar events
export async function getBarEvents(req, res) {
  try {
    const { id } = req.params;
    const { upcoming } = req.query;
    
    let whereClause = 'WHERE bar_id = $1';
    const values = [id];
    
    if (upcoming === 'true') {
      whereClause += ' AND start_time > NOW()';
    }
    
    const result = await query(
      `SELECT id, bar_id, title, description, event_type, start_time, end_time,
              is_recurring, recurrence_rule, image_url, created_at
       FROM events ${whereClause}
       ORDER BY start_time ASC
       LIMIT 50`,
      values
    );
    
    res.json({ events: result.rows });
  } catch (error) {
    console.error('Get bar events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
}

// Get bar menu
export async function getBarMenu(req, res) {
  try {
    const { id } = req.params;
    const { category } = req.query;
    
    let whereClause = 'WHERE bar_id = $1 AND is_available = true';
    const values = [id];
    
    if (category) {
      whereClause += ' AND category = $2';
      values.push(category);
    }
    
    const result = await query(
      `SELECT id, bar_id, name, category, description, price, photo_url, 
              is_available, created_at
       FROM menus ${whereClause}
       ORDER BY category, name`,
      values
    );
    
    // Group by category
    const menuByCategory = result.rows.reduce((acc, item) => {
      const cat = item.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
    
    res.json({ 
      menu: result.rows,
      menuByCategory,
    });
  } catch (error) {
    console.error('Get bar menu error:', error);
    res.status(500).json({ error: 'Failed to get menu' });
  }
}

// Claim bar ownership
export async function claimBar(req, res) {
  try {
    const { id } = req.params;
    
    const bar = await queryOne(
      'SELECT id, claimed_by FROM bars WHERE id = $1',
      [id]
    );
    
    if (!bar) {
      return res.status(404).json({ error: 'Bar not found' });
    }
    
    if (bar.claimed_by) {
      return res.status(400).json({ error: 'Bar already claimed' });
    }
    
    await query(
      'UPDATE bars SET claimed_by = $1, updated_at = NOW() WHERE id = $2',
      [req.user.id, id]
    );
    
    res.json({ message: 'Bar claimed successfully' });
  } catch (error) {
    console.error('Claim bar error:', error);
    res.status(500).json({ error: 'Failed to claim bar' });
  }
}

// Create bar (admin/kavatender)
export async function createBar(req, res) {
  try {
    const { 
      name, slug, address, city, state, zip, phone, website,
      latitude, longitude, hours, description, photos, amenities
    } = req.body;
    
    if (!name || !address || !city || !state) {
      return res.status(400).json({ error: 'Name, address, city, and state are required' });
    }
    
    // Check slug uniqueness
    const existing = await queryOne(
      'SELECT id FROM bars WHERE slug = $1',
      [slug || name.toLowerCase().replace(/\s+/g, '-')]
    );
    
    if (existing) {
      return res.status(400).json({ error: 'Bar with this name already exists' });
    }
    
    const barSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const result = await query(
      `INSERT INTO bars (name, slug, address, city, state, zip, phone, website,
                         latitude, longitude, hours, description, photos, amenities)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [name, barSlug, address, city, state, zip, phone, website,
       latitude, longitude, JSON.stringify(hours || {}), description,
       JSON.stringify(photos || []), JSON.stringify(amenities || [])]
    );
    
    res.status(201).json({ bar: result.rows[0] });
  } catch (error) {
    console.error('Create bar error:', error);
    res.status(500).json({ error: 'Failed to create bar' });
  }
}

// Update bar
export async function updateBar(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Remove non-updatable fields
    delete updates.id;
    delete updates.created_at;
    
    const keys = Object.keys(updates);
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const setClause = keys.map((key, i) => {
      const value = typeof updates[key] === 'object' ? JSON.stringify(updates[key]) : updates[key];
      return `${key} = $${i + 2}`;
    }).join(', ');
    
    const result = await query(
      `UPDATE bars SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...Object.values(updates).map(v => typeof v === 'object' ? JSON.stringify(v) : v)]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bar not found' });
    }
    
    res.json({ bar: result.rows[0] });
  } catch (error) {
    console.error('Update bar error:', error);
    res.status(500).json({ error: 'Failed to update bar' });
  }
}
