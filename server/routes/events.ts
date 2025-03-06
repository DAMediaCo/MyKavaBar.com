import { Express, Request, Response } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@db";
import { barEvents, kavaBars } from "@db/schema";
import { z } from "zod";
import { isAuthenticated } from "../middleware/auth";

// Array of day of week names for logging
const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function registerEventRoutes(app: Express) {
  // Route for fetching bar events
  app.get("/api/bars/:id/events", async (req: Request, res: Response) => {
    try {
      const events = await db.query.barEvents.findMany({
        where: eq(barEvents.barId, Number(req.params.id)),
        orderBy: [asc(barEvents.dayOfWeek), asc(barEvents.startTime)],
      });
      res.json(events);
    } catch (error: any) {
      console.error("Error fetching bar events:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Route for adding events to a bar
  app.post('/api/bars/:barId/events', isAuthenticated, async (req: Request, res: Response) => {
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

    // Verify bar exists and user owns it
    const [bar] = await db
      .select()
      .from(kavaBars)
      .where(eq(kavaBars.id, parseInt(barId)))
      .limit(1);

    if (!bar) {
      return res.status(404).json({ error: 'Bar not found' });
    }

    if (bar.ownerId !== userId && !req.user?.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to add events to this bar' });
    }

    // Get client timezone or use UTC as fallback
    const clientTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    // Debug logging - improved logging to show raw and parsed dates
    console.log('Creating event - Raw incoming dates:', { startDate, endDate, startTime, endTime, clientTimezone });

    // Properly handle dates to avoid timezone issues
    let parsedStartDate = null;
    let parsedEndDate = null;

    try {
      if (startDate) {
        // For non-recurring events with date strings like "2025-03-08", 
        // we need to parse without timezone shifts
        if (!isRecurring) {
          // Parse the date string parts directly
          const [year, month, day] = startDate.split('-').map((num: string) => parseInt(num));
          
          // Create a date using UTC to avoid timezone shifts
          parsedStartDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
          
          console.log(`Parsed start date "${startDate}" to UTC noon:`, parsedStartDate.toISOString());
        } else {
          // For recurring events, parse normally
          parsedStartDate = new Date(startDate);
        }
      }
      
      if (endDate) {
        if (!isRecurring) {
          // Same approach for end date
          const [year, month, day] = endDate.split('-').map((num: string) => parseInt(num));
          parsedEndDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
          
          console.log(`Parsed end date "${endDate}" to UTC noon:`, parsedEndDate.toISOString());
        } else {
          parsedEndDate = new Date(endDate);
        }
      }
    } catch (dateParseError) {
      console.error("Error parsing dates:", dateParseError);
      return res.status(400).json({error: "Invalid date format"});
    }

    // For PostgreSQL, we need to format as YYYY-MM-DD strings
    // Since PostgreSQL date type doesn't store timezone information
    const formatDateForPostgres = (date: Date | null): string | null => {
      if (!date) return null;
      // Format as YYYY-MM-DD
      return date.toISOString().split('T')[0];
    };
    
    const formattedStartDate = formatDateForPostgres(parsedStartDate);
    const formattedEndDate = formatDateForPostgres(parsedEndDate);

    console.log('Formatted dates for storage:', {
      originalStartDate: startDate,
      originalEndDate: endDate,
      parsedStartDate: parsedStartDate?.toISOString(),
      parsedEndDate: parsedEndDate?.toISOString(),
      formattedStartDate,
      formattedEndDate,
    });

    // For non-recurring events we still need a valid dayOfWeek value
    // If a specific date is provided, calculate the day of week from it
    let effectiveDayOfWeek = dayOfWeek;
    
    // For non-recurring events, try to calculate the day of week from the start date
    if (!isRecurring && startDate) {
      try {
        const [year, month, day] = startDate.split('-').map((num: string) => parseInt(num));
        // Create a date and get its day of week (0-6, where 0 is Sunday)
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        effectiveDayOfWeek = dateObj.getDay();
        console.log(`Calculated day of week from start date: ${effectiveDayOfWeek} (${daysOfWeek[effectiveDayOfWeek]})`);
      } catch (error) {
        console.warn('Failed to calculate day of week from start date, using provided value:', error);
      }
    }
    
    // Insert event using table field names
    const [event] = await db
      .insert(barEvents)
      .values({
        barId: parseInt(barId),
        title,
        description: description || null,
        dayOfWeek: effectiveDayOfWeek, // Always use a valid day of week
        startTime,
        endTime,
        isRecurring,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log('Created event with id:', event.id);

    res.status(200).json({
      message: 'Event created successfully',
      event
    });
  } catch (error: any) {
    console.error('Error adding event:', error);
    res.status(500).json({ error: 'Failed to add event' });
  }
  });

  // Implement PUT route to update events
  app.put("/api/bars/:barId/events/:eventId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { barId, eventId } = req.params;
      const userId = req.user?.id;
      
      // Check bar ownership
      const [bar] = await db
        .select()
        .from(kavaBars)
        .where(eq(kavaBars.id, parseInt(barId)))
        .limit(1);

      if (!bar) {
        return res.status(404).json({ error: 'Bar not found' });
      }

      if (bar.ownerId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ error: 'Not authorized to update events for this bar' });
      }

      const {
        title,
        description,
        startTime,
        endTime,
        isRecurring,
        dayOfWeek,
        startDate,
        endDate,
      } = req.body;

      // Process dates without timezone shifts for non-recurring events
      let processedStartDate = null;
      let processedEndDate = null;

      if (!isRecurring && startDate) {
        try {
          const [year, month, day] = startDate.split('-').map((num: string) => parseInt(num));
          processedStartDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
          
          if (endDate) {
            const [endYear, endMonth, endDay] = endDate.split('-').map((num: string) => parseInt(num));
            processedEndDate = new Date(Date.UTC(endYear, endMonth - 1, endDay, 12, 0, 0));
          }
        } catch (error) {
          console.error('Error processing dates:', error);
          return res.status(400).json({ error: 'Invalid date format' });
        }
      }

      // For PostgreSQL, we need to format as YYYY-MM-DD strings for date type columns
      const formatDateForPostgres = (date: Date | null): string | null => {
        if (!date) return null;
        // Format as YYYY-MM-DD
        return date.toISOString().split('T')[0];
      };
      
      const formattedStartDate = formatDateForPostgres(processedStartDate);
      const formattedEndDate = formatDateForPostgres(processedEndDate);

      console.log('Updating event with formatted dates:', {
        originalStartDate: startDate,
        originalEndDate: endDate,
        processedStartDate: processedStartDate?.toISOString(),
        processedEndDate: processedEndDate?.toISOString(),
        formattedStartDate,
        formattedEndDate,
      });

      // Calculate effective day of week for non-recurring events
      let effectiveDayOfWeek = dayOfWeek;
      
      // For non-recurring events, try to calculate the day of week from the start date
      if (!isRecurring && startDate) {
        try {
          const [year, month, day] = startDate.split('-').map((num: string) => parseInt(num));
          const dateObj = new Date(Date.UTC(year, month - 1, day));
          effectiveDayOfWeek = dateObj.getDay();
          console.log(`Calculated day of week for update from start date: ${effectiveDayOfWeek}`);
        } catch (error) {
          console.warn('Failed to calculate day of week for update, using provided value:', error);
        }
      }
      
      // Update the event
      const [updatedEvent] = await db
        .update(barEvents)
        .set({
          title,
          description,
          startTime,
          endTime,
          isRecurring,
          dayOfWeek: effectiveDayOfWeek, // Always use a valid day of week
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          updatedAt: new Date(),
        })
        .where(and(
          eq(barEvents.id, parseInt(eventId)),
          eq(barEvents.barId, parseInt(barId))
        ))
        .returning();

      if (!updatedEvent) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json(updatedEvent);
    } catch (error: any) {
      console.error('Error updating event:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Implement DELETE route for events
  app.delete("/api/bars/:barId/events/:eventId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { barId, eventId } = req.params;
      const userId = req.user?.id;
      
      // Check bar ownership 
      const [bar] = await db
        .select()
        .from(kavaBars)
        .where(eq(kavaBars.id, parseInt(barId)))
        .limit(1);

      if (!bar) {
        return res.status(404).json({ error: 'Bar not found' });
      }

      if (bar.ownerId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ error: 'Not authorized to delete events for this bar' });
      }

      const [deletedEvent] = await db
        .delete(barEvents)
        .where(and(
          eq(barEvents.id, parseInt(eventId)),
          eq(barEvents.barId, parseInt(barId))
        ))
        .returning();

      if (!deletedEvent) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json({ message: "Event deleted successfully" });
    } catch (error: any) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: error.message });
    }
  });
}