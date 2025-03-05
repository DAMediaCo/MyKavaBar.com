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
      endDate,
      timezone 
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

    console.log('Creating event with raw data:', { 
      startDate, endDate, 
      timezone, 
      isRecurring
    });

    // Format dates to ensure they're stored correctly without timezone shifting
    // For non-recurring events, explicitly preserve the date as entered

    let formattedStartDate = startDate;
    let formattedEndDate = endDate;

    // Attempt to parse dates; if failure, log error and return 400
    try {
      const parsedStartDate = new Date(startDate);
      const parsedEndDate = new Date(endDate);
      formattedStartDate = parsedStartDate.toISOString(); //Store as ISO String for DB consistency
      formattedEndDate = parsedEndDate.toISOString();
    } catch (dateParseError) {
      console.error("Error parsing dates:", dateParseError);
      return res.status(400).json({error: "Invalid date format"});
    }

    const eventData = {
      barId: parseInt(barId),
      title,
      timezone: timezone || 'UTC', // Store the timezone with the event, default to UTC
      description,
      startTime,
      endTime,
      isRecurring,
      dayOfWeek: isRecurring ? dayOfWeek : null,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Storing event with data:', {
      ...eventData,
      serverTime: new Date().toISOString()
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
  timezone: z.string().optional() // Added timezone to the schema
});