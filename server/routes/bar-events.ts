// Extract the event data from the request body
  const { title, description, dayOfWeek, startTime, endTime, isRecurring, startDate, endDate } = req.body;

  // For debugging
  console.log('Received event data:', {
    title, 
    isRecurring,
    startDate, 
    endDate,
    dayOfWeek,
    startTime,
    endTime
  });

  // Store dates as they are received without timezone conversion
  let processedStartDate = null;
  let processedEndDate = null;

  if (!isRecurring) {
    try {
      // Create proper Date objects from the ISO strings
      processedStartDate = startDate ? new Date(startDate) : null;
      processedEndDate = endDate ? new Date(endDate) : null;

      console.log('Processing non-recurring event with dates:', {
        originalStartDate: startDate,
        originalEndDate: endDate,
        processedStartDate: processedStartDate?.toISOString(),
        processedEndDate: processedEndDate?.toISOString(),
      });
    } catch (error) {
      console.error('Error processing dates:', error);
      return res.status(400).json({ error: 'Invalid date format provided' });
    }
  }

  // Create a new event in the database
  const event = await db.insert(barEvents).values({
    barId: barId,
    title: title,
    description: description || null,
    dayOfWeek: isRecurring ? dayOfWeek : null,
    startTime: startTime,
    endTime: endTime,
    isRecurring: isRecurring,
    // For non-recurring events, store dates exactly as processed
    startDate: processedStartDate,
    endDate: processedEndDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  console.log('Created event with dates:', {
    id: event[0].id,
    isRecurring: event[0].isRecurring,
    startDate: event[0].startDate instanceof Date ? event[0].startDate.toISOString() : event[0].startDate,
    endDate: event[0].endDate instanceof Date ? event[0].endDate.toISOString() : event[0].endDate,
  });

  // Log the created event for verification
  console.log('Created event:', event);

app.post("/api/bars/:id/events", async (req, res) => {
    console.log("Event creation request. Auth status:", req.isAuthenticated() ? "Authenticated" : "Not authenticated");
    console.log("User session:", req.user ? `User ID: ${req.user.id}` : "No user in session");

    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        error: "Authentication required", 
        message: "You must be logged in to create events" 
      });
    }

    const barId = parseInt(req.params.id);

    // ...rest of the original event creation logic...

  });