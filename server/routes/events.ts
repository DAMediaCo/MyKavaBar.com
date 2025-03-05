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

    // Get client timezone or use UTC as fallback
    const clientTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    // Debug logging
    console.log('Creating event with raw data:', {
      startDate,
      startTime,
      endDate,
      endTime,
      clientTimezone
    });

    // Parse and convert dates to UTC before storing them
    let parsedStartDate;
    let parsedEndDate;

    try {
      parsedStartDate = new Date(startDate);
      parsedEndDate = new Date(endDate);


      // This section needs more robust timezone handling.  The current approach assumes
      // the input dates are in the clientTimezone.  A more robust solution might involve
      // using a library like moment-timezone or date-fns-tz to handle timezone conversions
      // reliably, especially for handling daylight saving time transitions.
      const utcStartDate = new Date(parsedStartDate.toLocaleString('en-US',{timeZone: clientTimezone, timeZoneName:'short'}));
      const utcEndDate = new Date(parsedEndDate.toLocaleString('en-US',{timeZone: clientTimezone, timeZoneName:'short'}));

      parsedStartDate = utcStartDate;
      parsedEndDate = utcEndDate;

    } catch (dateParseError) {
      console.error("Error parsing dates:", dateParseError);
      return res.status(400).json({error: "Invalid date format"});
    }


    const formattedStartDate = parsedStartDate.toISOString();
    const formattedEndDate = parsedEndDate.toISOString();

    const eventData = {
      barId: parseInt(barId),
      title,
      timezone: clientTimezone, // Store the timezone with the event
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