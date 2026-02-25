import { query, queryOne, queryAll } from '../db.js';

// Get user's favorites
export async function getFavorites(req, res) {
  try {
    const userId = req.user.id;
    
    const result = await query(
      `SELECT f.id, f.created_at,
              b.id as bar_id, b.name, b.slug, b.address, b.city, b.state, 
              b.phone, b.website, b.latitude, b.longitude, b.photos, b.amenities
       FROM favorites f
       JOIN bars b ON f.bar_id = b.id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );
    
    res.json({ favorites: result.rows });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
}

// Add to favorites
export async function addFavorite(req, res) {
  try {
    const { barId } = req.body;
    const userId = req.user.id;
    
    if (!barId) {
      return res.status(400).json({ error: 'Bar ID is required' });
    }
    
    // Verify bar exists
    const bar = await queryOne('SELECT id FROM bars WHERE id = $1', [barId]);
    if (!bar) {
      return res.status(404).json({ error: 'Bar not found' });
    }
    
    // Check if already favorited
    const existing = await queryOne(
      'SELECT id FROM favorites WHERE user_id = $1 AND bar_id = $2',
      [userId, barId]
    );
    
    if (existing) {
      return res.status(400).json({ error: 'Bar already in favorites' });
    }
    
    const result = await query(
      'INSERT INTO favorites (user_id, bar_id) VALUES ($1, $2) RETURNING *',
      [userId, barId]
    );
    
    res.status(201).json({ 
      message: 'Added to favorites',
      favorite: result.rows[0]
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
}

// Remove from favorites
export async function removeFavorite(req, res) {
  try {
    const { barId } = req.params;
    const userId = req.user.id;
    
    const result = await query(
      'DELETE FROM favorites WHERE user_id = $1 AND bar_id = $2 RETURNING id',
      [userId, barId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    
    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
}

// Check if bar is favorited
export async function checkFavorite(req, res) {
  try {
    const { barId } = req.params;
    const userId = req.user.id;
    
    const favorite = await queryOne(
      'SELECT id FROM favorites WHERE user_id = $1 AND bar_id = $2',
      [userId, barId]
    );
    
    res.json({ isFavorited: !!favorite });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({ error: 'Failed to check favorite' });
  }
}
