import { and, eq, sql, gte } from "drizzle-orm";
import { db } from "../../db"; // your DB instance
import { eventRsvps, barEvents, kavaBars } from "../../db/schema";
import { fromEasternToUTC, getNextOccurrence } from "../utils/time-utils";
import { Request, Response } from "express";

/**
 * RSVP controller
 */
export async function rsvpToEvent({
  userId,
  eventId,
}: {
  userId: number;
  eventId: number;
}) {
  // 1. Get the event
  const [event] = await db
    .select()
    .from(barEvents)
    .where(eq(barEvents.id, eventId))
    .limit(1);

  if (!event) throw new Error("Event not found");

  // 2. Compute the next occurrence
  const eventDate = getNextOccurrence(event.dayOfWeek);
  const eventDateTime = fromEasternToUTC({
    date: eventDate,
    time: event.startTime,
  });

  // 3. Validate timing
  if (new Date() >= eventDateTime) {
    throw new Error("RSVP window has closed for this event");
  }

  // 4. Check existing RSVP (active or inactive)
  const [existing] = await db
    .select()
    .from(eventRsvps)
    .where(
      and(
        eq(eventRsvps.userId, userId),
        eq(eventRsvps.eventId, eventId),
        eq(eventRsvps.eventDate, eventDate),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.isActive) {
      throw new Error("You’ve already RSVPed to this event");
    }

    // 5a. Reactivate the RSVP
    await db
      .update(eventRsvps)
      .set({ isActive: true })
      .where(eq(eventRsvps.id, existing.id));

    return { success: true, message: "RSVP reactivated successfully" };
  }

  // 5b. Create new RSVP
  await db.insert(eventRsvps).values({
    userId,
    eventId,
    eventDate,
    eventDateTime,
    isActive: true,
  });

  return { success: true, message: "RSVP successful" };
}

export const getMyRsvps = async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user.id) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const userId = req.user.id;
  try {
    const rsvps = await db
      .select({
        rsvpId: eventRsvps.id,
        eventTitle: barEvents.title,
        eventDate: eventRsvps.eventDate,
        eventDateTime: eventRsvps.eventDateTime,
        barName: kavaBars.name,
        barId: kavaBars.id,
      })
      .from(eventRsvps)
      .innerJoin(barEvents, eq(eventRsvps.eventId, barEvents.id))
      .innerJoin(kavaBars, eq(barEvents.barId, kavaBars.id))
      .where(and(eq(eventRsvps.userId, userId), eq(eventRsvps.isActive, true)))
      .orderBy(eventRsvps.eventDateTime);

    return res.json({ success: true, data: rsvps });
  } catch (err: any) {
    console.error("Error fetching RSVPs:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export async function deleteRsvp(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated() || !req.user)
      return res.status(403).json({ error: "Unauthorized" });

    const userId = req.user?.id; // Ensure middleware sets req.user
    const rsvpId = parseInt(req.params.rsvpId, 10);

    if (isNaN(rsvpId)) {
      return res.status(400).json({ success: false, error: "Invalid RSVP ID" });
    }

    // 1. Get the RSVP
    const [rsvp] = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.id, rsvpId))
      .limit(1);

    if (!rsvp) {
      return res.status(404).json({ success: false, error: "RSVP not found" });
    }

    if (rsvp.userId !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    // 2. Only allow delete if it's a future event
    const nowUtc = new Date();
    const eventTime = new Date(rsvp.eventDateTime); // Already in UTC

    if (eventTime <= nowUtc) {
      return res
        .status(400)
        .json({ success: false, error: "Cannot cancel past RSVPs" });
    }

    // 3. Delete the RSVP
    await db
      .update(eventRsvps)
      .set({ isActive: false })
      .where(eq(eventRsvps.id, rsvpId));

    return res.json({ success: true, message: "RSVP canceled successfully" });
  } catch (err) {
    console.error("Delete RSVP error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export const getBarRsvpStats = async (req: Request, res: Response) => {
  const { barId } = req.params;
  if (!req.isAuthenticated() || !req.user)
    return res.status(403).json({ error: "Unauthorized" });
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const isAdmin = user.role === "admin";
  const isBarOwner = user.role === "bar_owner";
  try {
    if (isBarOwner && !isAdmin) {
      const bar = await db.query.kavaBars.findFirst({
        where: and(eq(kavaBars.id, +barId), eq(kavaBars.ownerId, user.id)),
      });
      if (!bar) {
        return res
          .status(403)
          .json({ success: false, message: "You do not own this bar." });
      }
    }
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

    // Fetch all events for the bar
    const events = await db
      .select({
        eventId: barEvents.id,
        title: barEvents.title,
        description: barEvents.description,
        isRecurring: barEvents.isRecurring,
        dayOfWeek: barEvents.dayOfWeek,
        startDate: barEvents.startDate,
        endDate: barEvents.endDate,
        startTime: barEvents.startTime,
        endTime: barEvents.endTime,
        createdAt: barEvents.createdAt,
      })
      .from(barEvents)
      .where(eq(barEvents.barId, +barId));
    if (events.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          past: [],
          upcoming: [],
        },
      });
    }

    // Always fetch all RSVPs from (today - 90 days) to include all relevant stats
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split("T")[0];

    const eventIds = events.map((e) => e.eventId);

    const allRsvps =
      eventIds.length > 0
        ? await db
            .select({
              id: eventRsvps.id,
              userId: eventRsvps.userId,
              eventId: eventRsvps.eventId,
              eventDate: eventRsvps.eventDate,
              isActive: eventRsvps.isActive,
            })
            .from(eventRsvps)
            .where(
              and(
                sql`${eventRsvps.eventId} IN (${sql.join(
                  eventIds.map((id) => sql`${id}`),
                  sql`, `,
                )})`,
                gte(eventRsvps.eventDate, ninetyDaysAgoStr),
              ),
            )
        : [];

    const pastEvents: any[] = [];
    const upcomingEvents: any[] = [];

    for (const event of events) {
      if (event.isRecurring) {
        if (!event.createdAt) continue;

        // Only generate past recurring instances from MAX(90 days ago, createdAt)
        const createdAtDate = new Date(event.createdAt);
        const eventStartDate =
          createdAtDate > ninetyDaysAgo ? createdAtDate : ninetyDaysAgo;
        const startDateStr = eventStartDate.toISOString().split("T")[0];

        // Generate all instances from eventStartDate up to today or endDate if specified
        const pastInstances = generateRecurringInstancesBetweenDates(
          event.dayOfWeek,
          startDateStr,
          todayStr,
          event.endDate,
        );
        for (const instanceDate of pastInstances) {
          const stats = getRsvpStatsFromMemory(
            allRsvps,
            event.eventId,
            instanceDate,
          );
          pastEvents.push({
            eventId: event.eventId,
            title: event.title,
            description: event.description,
            isRecurring: true,
            schedule: {
              type: "recurring",
              dayOfWeek: event.dayOfWeek,
              specificDate: instanceDate,
              time: `${event.startTime} - ${event.endTime}`,
            },
            rsvps: stats,
          });
        }
        // Always provide only the next *upcoming* instance
        const nextInstance = getNextRecurringInstance(
          event.dayOfWeek,
          todayStr,
          event.endDate,
        );
        if (nextInstance) {
          const stats = getRsvpStatsFromMemory(
            allRsvps,
            event.eventId,
            nextInstance,
          );
          upcomingEvents.push({
            eventId: event.eventId,
            title: event.title,
            description: event.description,
            isRecurring: true,
            schedule: {
              type: "recurring",
              dayOfWeek: event.dayOfWeek,
              specificDate: nextInstance,
              time: `${event.startTime} - ${event.endTime}`,
            },
            rsvps: stats,
          });
        }
      } else {
        if (!event.startDate) continue;
        const eventDateStr =
          typeof event.startDate === "string"
            ? event.startDate.split("T")[0]
            : new Date(event.startDate).toISOString().split("T")[0];
        const eventDate = new Date(eventDateStr);
        if (eventDate >= ninetyDaysAgo) {
          const stats = getRsvpStatsFromMemory(
            allRsvps,
            event.eventId,
            eventDateStr,
          );
          const eventData = {
            eventId: event.eventId,
            title: event.title,
            description: event.description,
            isRecurring: false,
            schedule: {
              type: "non-recurring",
              date: eventDateStr,
              time: `${event.startTime} - ${event.endTime}`,
            },
            rsvps: stats,
          };
          if (eventDate < today) {
            pastEvents.push(eventData);
          } else {
            upcomingEvents.push(eventData);
          }
        }
      }
    }
    // Sort past events newest first
    pastEvents.sort((a, b) => {
      const dateA =
        a.schedule.type === "recurring"
          ? a.schedule.specificDate
          : a.schedule.date;
      const dateB =
        b.schedule.type === "recurring"
          ? b.schedule.specificDate
          : b.schedule.date;
      return (dateB || "").localeCompare(dateA || "");
    });
    // Sort upcoming events soonest first
    upcomingEvents.sort((a, b) => {
      const dateA =
        a.schedule.type === "recurring"
          ? a.schedule.specificDate
          : a.schedule.date;
      const dateB =
        b.schedule.type === "recurring"
          ? b.schedule.specificDate
          : b.schedule.date;
      return (dateA || "").localeCompare(dateB || "");
    });
    return res.status(200).json({
      success: true,
      data: {
        past: pastEvents,
        upcoming: upcomingEvents,
      },
    });
  } catch (error) {
    console.error("[BAR_RSVP_STATS_ERROR]", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch RSVP stats." });
  }
};

// Generates recurring event instances from startDate to endDate (both yyyy-mm-dd), with optional event endDate cap.
function generateRecurringInstancesBetweenDates(
  dayOfWeek: number,
  startDateStr: string,
  endDateStr: string,
  eventEndDateStr: string | null,
): string[] {
  const instances: string[] = [];
  let current = new Date(startDateStr + "T00:00:00.000Z");
  const endDate = new Date(endDateStr + "T00:00:00.000Z");
  const eventEndDate = eventEndDateStr
    ? new Date(eventEndDateStr + "T00:00:00.000Z")
    : null;
  while (current.getUTCDay() !== dayOfWeek) {
    current.setUTCDate(current.getUTCDate() + 1);
  }
  while (current < endDate) {
    if (eventEndDate && current > eventEndDate) break;
    instances.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 7);
  }
  return instances;
}

function getNextRecurringInstance(
  dayOfWeek: number,
  todayDateStr: string,
  eventEndDateStr: string | null,
): string | null {
  const today = new Date(todayDateStr + "T00:00:00.000Z");
  const eventEndDate = eventEndDateStr
    ? new Date(eventEndDateStr + "T00:00:00.000Z")
    : null;
  if (today.getUTCDay() === dayOfWeek) {
    const todayStr = today.toISOString().split("T")[0];
    if (!eventEndDate || today <= eventEndDate) return todayStr;
  }
  let current = new Date(today);
  current.setUTCDate(current.getUTCDate() + 1);
  while (current.getUTCDay() !== dayOfWeek) {
    current.setUTCDate(current.getUTCDate() + 1);
  }
  if (eventEndDate && current > eventEndDate) return null;
  return current.toISOString().split("T")[0];
}

function toUTCDateString(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toISOString().split("T")[0];
}

function getRsvpStatsFromMemory(
  allRsvps: any[],
  eventId: number,
  targetDate: string,
) {
  const normalizedTargetDate = targetDate.split("T")[0];
  const relevantRsvps = allRsvps.filter((rsvp) => {
    if (rsvp.eventId !== eventId) return false;
    const rsvpDateStr = toUTCDateString(rsvp.eventDate);
    return rsvpDateStr === normalizedTargetDate;
  });
  const activeCount = relevantRsvps.filter(
    (rsvp) => rsvp.isActive === true,
  ).length;
  const inactiveCount = relevantRsvps.filter(
    (rsvp) => rsvp.isActive === false,
  ).length;
  return {
    activeCount,
    inactiveCount,
  };
}
