// Create a new event
  app.post(
    "/api/events",
    requireAuth,
    validateRequest({
      body: z.object({
        title: z.string().min(3).max(100),
        description: z.string().optional(),
        barId: z.number(),
        isRecurring: z.boolean(),
        dayOfWeek: z.number().min(0).max(6).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        startTime: z.string(),
        endTime: z.string(),
      }),
    }),
    async (req, res) => {
      const body = req.body;
      const event = await prisma.event.create({
        data: {
          title: body.title,
          description: body.description,
          barId: body.barId,
          isRecurring: body.isRecurring,
          dayOfWeek: body.dayOfWeek,
          startDate: body.startDate,
          endDate: body.endDate,
          startTime: new Date(body.startTime),
          endTime: new Date(body.endTime),
        },
      });

      // Make sure date strings are properly formatted
      const formattedEventData = {
        id: event.id,
        barId: event.barId,
        title: event.title,
        description: event.description,
        date: event.date.toISOString(), // Assuming 'date' property exists on the event object.  This might need adjustment depending on your schema
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        isRecurring: event.isRecurring,
        isMultiDay: event.isMultiDay, // Assuming 'isMultiDay' property exists.  Adjust as needed.
        createdAt: event.createdAt
      };

      return res.status(201).json(formattedEventData);
    }
  );