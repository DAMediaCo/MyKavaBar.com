import { query, queryOne, queryAll } from '../db.js';

// Get all events with filters
export async function getEvents(req, res) {
  try {
    const { barId, type, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 1;
    
    if (barId) {
      whereClause += ` AND bar_id = $${paramCount++}`;
      values.push(barId);
    }
    
    if (type) {
      whereClause += ` AND event_type = $${paramCount++}`;
      values.push(type);
    }
    
    if (startDate) {
      whereClause += ` AND start_time >= $${paramCount++}`;
      values.push(startDate);
    }
    
    if (endDate) {
      whereClause += ` AND start_time <= $${paramCount++}`;
      values.push(endDate);
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const result = await query(
      `SELECT e.id, e.title, e.description, e.event_type, e.start_time, e.end_time,
              e.is_recurring, e.recurrence_rule, e.image_url, e.bar_id,
              b.name as bar_name, b.city, b.state
       FROM events e
       LEFT JOIN bars b ON e.bar_id = b.id
       ${whereClause}
       ORDER BY e.start_time ASC
       LIMIT $${paramCount++} OFFSET $${paramCount}`,
      [...values, parseInt(limit), offset]
    );
    
    res.json({ events: result.rows });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
}

// Get single event
export async function getEventById(req, res) {
  try {
    const { id } = req.params;
    
    const event = await queryOne(
      `SELECT e.*, b.name as bar_name, b.address as bar_address
       FROM events e
       LEFT JOIN bars b ON e.bar_id = b.id
       WHERE e.id = $1`,
      [id]
    );
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ event });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to get event' });
  }
}

// Create event
export async function createEvent(req, res) {
  try {
    const { 
      barId, title, description, eventType, startTime, endTime,
      isRecurring, recurrenceRule, imageUrl
    } = req.body;
    
    if (!barId || !title || !startTime) {
      return res.status(400).json({ error: 'Bar ID, title, and start time are required' });
    }
    
    // Verify bar exists
    const bar = await queryOne('SELECT id FROM bars WHERE id = $1', [barId]);
    if (!bar) {
      return res.status(404).json({ error: 'Bar not found' });
    }
    
    const result = await query(
      `INSERT INTO events (bar_id, title, description, event_type, start_time, end_time,
                          is_recurring, recurrence_rule, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [barId, title, description, eventType, startTime, endTime, 
       isRecurring || false, recurrenceRule, imageUrl]
    );
    
    res.status(201).json({ event: result.rows[0] });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
}

// Update event
export async function updateEvent(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    delete updates.id;
    delete updates.created_at;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const keys = Object.keys(updates);
    const setClause = keys.map((key, i) => {
      const colName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      return `${colName} = $${i + 2}`;
    }).join(', ');
    
    const result = await query(
      `UPDATE events SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...Object.values(updates)]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ event: result.rows[0] });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
}

// Delete event
export async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM events WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
}
