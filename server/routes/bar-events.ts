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

  // For non-recurring events, ensure dates are properly formatted
  // Store dates as they are received without timezone conversion
  let processedStartDate = null;
  let processedEndDate = null;
  
  if (!isRecurring) {
    // Keep the dates exactly as submitted without manipulation
    processedStartDate = startDate;
    processedEndDate = endDate;
    
    console.log('Processing non-recurring event with dates:', {
      originalStartDate: startDate,
      originalEndDate: endDate,
      processedStartDate,
      processedEndDate
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
    // For non-recurring events, store dates exactly as processed
    startDate: processedStartDate,
    endDate: processedEndDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
  
  console.log('Created event with dates:', {
    id: event[0].id,
    isRecurring: event[0].isRecurring,
    startDate: event[0].startDate,
    endDate: event[0].endDate
  });

  // Log the created event for verification
  console.log('Created event:', event);