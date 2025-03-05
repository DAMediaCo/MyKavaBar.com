app.post('/api/bars/:barId/events', requireAuth, async (req, res) => {
  try {
    const { barId } = req.params;
    const { 
      title, 
      description, 
      startTime, 
      endTime, 
      isRecurring, 
      dayOfWeek,
      startDate,
      endDate 
    } = req.body;

    const userId = req.user?.id;

    // Verify the bar exists and user has ownership
    const barOwnerRecord = await db.query.barOwners.findFirst({
      where: and(
        eq(barOwners.userId, userId),
        eq(barOwners.barId, parseInt(barId))
      )
    });

    if (!barOwnerRecord && !req.user?.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to add events for this bar' });
    }

    // Store the dates with timezone information
    // Extract timezone sent from client or use UTC as fallback
    const timezone = req.body.timezone || 'UTC';
    console.log(`Creating event with timezone: ${timezone}`);
    
    const eventData = {
      barId: parseInt(barId),
      title,
      timezone, // Store the timezone with the event
      description,
      startTime,
      endTime,
      isRecurring,
      dayOfWeek: isRecurring ? dayOfWeek : null,
      startDate: startDate,
      endDate: endDate,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Creating event with data:', {
      ...eventData,
      startDate: eventData.startDate,
      endDate: eventData.endDate
    });

    const result = await db.insert(events).values(eventData);

    res.status(200).json({
      message: 'Event created successfully',
      eventId: result.insertId
    });
  } catch (error) {
    console.error('Error adding event:', error);
    res.status(500).json({ error: 'Failed to add event' });
  }
});

// Define event schema and shape of data
const eventSchema = z.object({
  id: z.number().optional(),
  barId: z.number(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  isRecurring: z.boolean().default(true),
  dayOfWeek: z.number().min(0).max(6).optional().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});