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

  // For non-recurring events, ensure we properly handle the dates
  // For debugging
  if (!isRecurring) {
    console.log('Processing non-recurring event with dates:', {
      startDate,
      endDate
    });
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
    // For non-recurring events, store the date exactly as received
    startDate: isRecurring ? null : startDate,
    endDate: isRecurring ? null : endDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  // Log the created event for verification
  console.log('Created event:', event);