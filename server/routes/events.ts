import { Express, Request, Response } from "express";
import { and, or, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@db";
import { barEvents, eventRsvps, kavaBars } from "@db/schema";
import { isAuthenticated } from "../middleware/auth";
import { getNextOccurrence, convertEstToUtcDateTime } from "@utils/time-utils";

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
  app.get("/api/bars/:id/events", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        console.error("Invalid bar ID:", req.params.id);
        return res.status(400).json({ error: "Invalid bar ID" });
      }
      const userId = req.user?.id ?? null;

      // Step 1: Get NY date for queries and log it
      const newYorkTime = new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
      });
      const currentDateNY = new Date(newYorkTime).toISOString().split("T")[0];
      console.log("Current NY Date:", currentDateNY);

      // Step 2: Fetch non-recurring events from DB, log results
      const nonRecurringEvents = await db.query.barEvents.findMany({
        where: and(
          eq(barEvents.barId, id),
          eq(barEvents.isRecurring, false),
          gte(barEvents.endDate, `${currentDateNY}T00:00:00.000Z`),
        ),
      });
      console.log("Non-recurring events fetched:", nonRecurringEvents);

      // Step 3: Fetch recurring events from DB, log results
      const recurringEvents = await db.query.barEvents.findMany({
        where: and(eq(barEvents.barId, id), eq(barEvents.isRecurring, true)),
        orderBy: [barEvents.dayOfWeek],
      });
      console.log("Recurring events fetched:", recurringEvents);

      // Step 4: Improved date constructor for non-recurring events
      function getEventStartDate(event: any): Date {
        if (!event.startDate) {
          console.error(`Missing startDate for event id=${event.id}`);
          throw new Error(`Missing startDate for event id=${event.id}`);
        }
        // If startDate is YYYY-MM-DD, add time
        if (event.startDate.length === 10) {
          if (!event.startTime) {
            console.error(`Missing startTime for event id=${event.id}`);
            throw new Error(`Missing startTime for event id=${event.id}`);
          }
          return new Date(`${event.startDate}T${event.startTime}`);
        } else {
          // startDate is already ISO, use directly
          return new Date(event.startDate);
        }
      }

      // Step 5: Helper to enrich with RSVP flag, debugging at each step
      const enrichWithRsvpFlag = async (event: any) => {
        try {
          let eventDate: string;
          let eventDateTime: Date;

          if (event.isRecurring) {
            // Recurring event: compute next occurrence
            const nextDate = getNextOccurrence(event.dayOfWeek);
            eventDate = nextDate.toISOString().split("T")[0];
            eventDateTime = convertEstToUtcDateTime(nextDate, event.startTime);
            console.log(
              `Recurring event (${event.id}): nextDate=${eventDate}, eventDateTime=${eventDateTime}`,
            );
          } else {
            // Non-recurring event: handle ISO and date-only startDate
            eventDate = event.startDate;
            const start = getEventStartDate(event);
            if (isNaN(start.getTime())) {
              console.error(
                `Invalid constructed start date for event id=${event.id}:`,
                event.startDate,
                event.startTime,
              );
              throw new Error(
                `Invalid start date for event id=${event.id}: ${event.startDate}`,
              );
            }
            eventDateTime = convertEstToUtcDateTime(start, event.startTime);
            console.log(
              `Non-recurring event (${event.id}): start=${start}, eventDateTime=${eventDateTime}`,
            );
          }

          let isRsvped = false;
          // Debugging RSVPed logic
          console.log(
            `Checking RSVP for userId=${userId} and eventDateTime=${eventDateTime}`,
          );
          if (userId && new Date() < eventDateTime) {
            const existing = await db.query.eventRsvps.findFirst({
              where: and(
                eq(eventRsvps.userId, userId),
                eq(eventRsvps.eventId, event.id),
                eq(eventRsvps.eventDate, eventDate),
                eq(eventRsvps.isActive, true),
              ),
            });
            isRsvped = !!existing;
            console.log(`Event id=${event.id} RSVP found:`, existing);
          }

          return { ...event, isRsvped };
        } catch (innerError) {
          console.error(
            `Error enriching event id=${event.id}:`,
            innerError.message,
            event,
          );
          throw innerError;
        }
      };

      // Step 6: Enrich all events and log the process
      const allEvents = [...nonRecurringEvents, ...recurringEvents];
      console.log("All events to enrich:", allEvents);

      const enriched = await Promise.all(
        allEvents.map((e) => enrichWithRsvpFlag(e)),
      );
      console.log("Enriched events result:", enriched);

      res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching bar events:", error.message, error.stack);
      res.status(500).json({ error: error.message });
    }
  });

  // Route for adding events to a bar
  app.post(
    "/api/bars/:barId/events",
    isAuthenticated,
    async (req: Request, res: Response) => {
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
          timezone,
        } = req.body;

        const userId = req.user?.id;

        // Verify bar exists and user owns it
        const [bar] = await db
          .select()
          .from(kavaBars)
          .where(eq(kavaBars.id, parseInt(barId)))
          .limit(1);

        if (!bar) {
          return res.status(404).json({ error: "Bar not found" });
        }

        if (bar.ownerId !== userId && !req.user?.isAdmin) {
          return res
            .status(403)
            .json({ error: "Not authorized to add events to this bar" });
        }

        // Get client timezone or use UTC as fallback
        const clientTimezone = "America/New_York";

        // Debug logging - improved logging to show raw and parsed dates
        console.log("Creating event - Raw incoming dates:", {
          startDate,
          endDate,
          startTime,
          endTime,
          clientTimezone,
        });

        // Properly handle dates to avoid timezone issues
        let parsedStartDate = null;
        let parsedEndDate = null;

        try {
          if (startDate) {
            // For non-recurring events with date strings like "2025-03-08",
            // we need to parse without timezone shifts
            if (!isRecurring) {
              // Parse the date string parts directly
              const [year, month, day] = startDate
                .split("-")
                .map((num: string) => parseInt(num));

              // Create a date using UTC to avoid timezone shifts
              parsedStartDate = new Date(
                Date.UTC(year, month - 1, day, 12, 0, 0),
              );

              console.log(
                `Parsed start date "${startDate}" to UTC noon:`,
                parsedStartDate.toISOString(),
              );
            } else {
              // For recurring events, parse normally
              parsedStartDate = new Date(startDate);
            }
          }

          if (endDate) {
            if (!isRecurring) {
              // Same approach for end date
              const [year, month, day] = endDate
                .split("-")
                .map((num: string) => parseInt(num));
              parsedEndDate = new Date(
                Date.UTC(year, month - 1, day, 12, 0, 0),
              );

              console.log(
                `Parsed end date "${endDate}" to UTC noon:`,
                parsedEndDate.toISOString(),
              );
            } else {
              parsedEndDate = new Date(endDate);
            }
          }
        } catch (dateParseError) {
          console.error("Error parsing dates:", dateParseError);
          return res.status(400).json({ error: "Invalid date format" });
        }

        // For PostgreSQL, we need to format as YYYY-MM-DD strings
        // Since PostgreSQL date type doesn't store timezone information
        const formatDateForPostgres = (date: Date | null): string | null => {
          if (!date) return null;
          // Format as YYYY-MM-DD
          return date.toISOString().split("T")[0];
        };

        const formattedStartDate = formatDateForPostgres(parsedStartDate);
        const formattedEndDate = formatDateForPostgres(parsedEndDate);

        console.log("Formatted dates for storage:", {
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
            const [year, month, day] = startDate
              .split("-")
              .map((num: string) => parseInt(num));
            // Create a date and get its day of week (0-6, where 0 is Sunday)
            const dateObj = new Date(Date.UTC(year, month - 1, day));
            effectiveDayOfWeek = dateObj.getDay();
            console.log(
              `Calculated day of week from start date: ${effectiveDayOfWeek} (${daysOfWeek[effectiveDayOfWeek]})`,
            );
          } catch (error) {
            console.warn(
              "Failed to calculate day of week from start date, using provided value:",
              error,
            );
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

        console.log("Created event with id:", event.id);

        res.status(200).json({
          message: "Event created successfully",
          event,
        });
      } catch (error: any) {
        console.error("Error adding event:", error);
        res.status(500).json({ error: "Failed to add event" });
      }
    },
  );

  // Implement PUT route to update events
  app.put(
    "/api/bars/:barId/events/:eventId",
    isAuthenticated,
    async (req: Request, res: Response) => {
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
          return res.status(404).json({ error: "Bar not found" });
        }

        if (bar.ownerId !== userId && !req.user?.isAdmin) {
          return res
            .status(403)
            .json({ error: "Not authorized to update events for this bar" });
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

        // Debug logging - incoming date values
        console.log("Updating event - Raw incoming dates:", {
          startDate,
          endDate,
          startTime,
          endTime,
        });

        // Handle timezone consistency for dates
        let parsedStartDate = null;
        let parsedEndDate = null;

        try {
          if (startDate) {
            if (!isRecurring) {
              const [year, month, day] = startDate
                .split("-")
                .map((num: string) => parseInt(num));
              parsedStartDate = new Date(
                Date.UTC(year, month - 1, day, 12, 0, 0),
              );

              console.log(
                `Parsed start date "${startDate}" to UTC noon:`,
                parsedStartDate.toISOString(),
              );
            } else {
              parsedStartDate = new Date(startDate);
            }
          }

          if (endDate) {
            if (!isRecurring) {
              const [year, month, day] = endDate
                .split("-")
                .map((num: string) => parseInt(num));
              parsedEndDate = new Date(
                Date.UTC(year, month - 1, day, 12, 0, 0),
              );

              console.log(
                `Parsed end date "${endDate}" to UTC noon:`,
                parsedEndDate.toISOString(),
              );
            } else {
              parsedEndDate = new Date(endDate);
            }
          }
        } catch (dateParseError) {
          console.error("Error parsing dates:", dateParseError);
          return res.status(400).json({ error: "Invalid date format" });
        }

        // Format dates for PostgreSQL storage
        const formatDateForPostgres = (date: Date | null): string | null => {
          if (!date) return null;
          return date.toISOString().split("T")[0];
        };

        const formattedStartDate = formatDateForPostgres(parsedStartDate);
        const formattedEndDate = formatDateForPostgres(parsedEndDate);

        console.log("Formatted dates for storage:", {
          originalStartDate: startDate,
          originalEndDate: endDate,
          parsedStartDate: parsedStartDate?.toISOString(),
          parsedEndDate: parsedEndDate?.toISOString(),
          formattedStartDate,
          formattedEndDate,
        });

        // Ensure valid `dayOfWeek` for non-recurring events
        let effectiveDayOfWeek = dayOfWeek;

        if (!isRecurring && startDate) {
          try {
            const [year, month, day] = startDate
              .split("-")
              .map((num: string) => parseInt(num));
            const dateObj = new Date(Date.UTC(year, month - 1, day));
            effectiveDayOfWeek = dateObj.getDay();
            console.log(`Calculated day of week: ${effectiveDayOfWeek}`);
          } catch (error) {
            console.warn(
              "Failed to calculate day of week, using provided value:",
              error,
            );
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
            dayOfWeek: effectiveDayOfWeek, // Always ensure a valid day of week
            startDate: formattedStartDate,
            endDate: formattedEndDate,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(barEvents.id, parseInt(eventId)),
              eq(barEvents.barId, parseInt(barId)),
            ),
          )
          .returning();

        if (!updatedEvent) {
          return res.status(404).json({ error: "Event not found" });
        }

        res.json({
          message: "Event updated successfully",
          event: updatedEvent,
        });
      } catch (error: any) {
        console.error("Error updating event:", error);
        res.status(500).json({ error: "Failed to update event" });
      }
    },
  );

  // Implement DELETE route for events
  app.delete(
    "/api/bars/:barId/events/:eventId",
    isAuthenticated,
    async (req: Request, res: Response) => {
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
          return res.status(404).json({ error: "Bar not found" });
        }

        if (bar.ownerId !== userId && !req.user?.isAdmin) {
          return res
            .status(403)
            .json({ error: "Not authorized to delete events for this bar" });
        }

        const [deletedEvent] = await db
          .delete(barEvents)
          .where(
            and(
              eq(barEvents.id, parseInt(eventId)),
              eq(barEvents.barId, parseInt(barId)),
            ),
          )
          .returning();

        if (!deletedEvent) {
          return res.status(404).json({ error: "Event not found" });
        }

        res.json({ message: "Event deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting event:", error);
        res.status(500).json({ error: error.message });
      }
    },
  );
}
