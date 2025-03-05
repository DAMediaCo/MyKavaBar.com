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
  );