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

    // Parse dates properly ensuring they're in the correct timezone using UTC
    let parsedStartDate = null;
    let parsedEndDate = null;

    if (!isRecurring && startDate) {
      const dateParts = startDate.split('-').map(Number);
      parsedStartDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
    }

    if (!isRecurring && endDate) {
      const dateParts = endDate.split('-').map(Number);
      parsedEndDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
    }

    const eventData = {
      barId: parseInt(barId),
      title,
      description,
      startTime,
      endTime,
      isRecurring,
      dayOfWeek: isRecurring ? dayOfWeek : null,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Creating event with data:', {
      ...eventData,
      startDate: eventData.startDate?.toISOString(),
      endDate: eventData.endDate?.toISOString()
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