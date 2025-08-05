import { and, eq, sql } from "drizzle-orm";
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

  const user = req.user; // Assuming this is set via auth middleware

  if (!user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const isAdmin = user.role === "admin";
  const isBarOwner = user.role === "bar_owner";
  try {
    // ✅ Validate ownership if bar owner (but not admin)
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

    // ✅ Fetch events with RSVP counts via LEFT JOIN
    const events = await db
      .select({
        eventId: barEvents.id,
        title: barEvents.title,
        isRecurring: barEvents.isRecurring,
        dayOfWeek: barEvents.dayOfWeek,
        startDate: barEvents.startDate,
        startTime: barEvents.startTime,
        endTime: barEvents.endTime,
        activeCount: sql<number>`COUNT(CASE WHEN ${eventRsvps.isActive} = true THEN 1 END)`,
        inactiveCount: sql<number>`COUNT(CASE WHEN ${eventRsvps.isActive} = false THEN 1 END)`,
      })
      .from(barEvents)
      .leftJoin(eventRsvps, eq(barEvents.id, eventRsvps.eventId))
      .where(eq(barEvents.barId, +barId))
      .groupBy(
        barEvents.id,
        barEvents.title,
        barEvents.isRecurring,
        barEvents.dayOfWeek,
        barEvents.startDate,
        barEvents.startTime,
        barEvents.endTime,
      ).orderBy(sql`CASE 
      WHEN ${barEvents.isRecurring} = true THEN 
        LPAD(${barEvents.dayOfWeek}::text, 2, '0') || '|' || ${barEvents.startTime}
      ELSE 
        ${barEvents.startDate} || 'T' || ${barEvents.startTime}
    END`);

    // ✅ Format result
    const result = events.map((e) => ({
      eventId: e.eventId,
      title: e.title,
      isRecurring: e.isRecurring,
      schedule: e.isRecurring
        ? {
            type: "recurring",
            dayOfWeek: e.dayOfWeek,
            time: `${e.startTime} - ${e.endTime}`,
          }
        : {
            type: "non-recurring",
            date: e.startDate,
            time: `${e.startTime} - ${e.endTime}`,
          },
      rsvps: {
        activeCount: Number(e.activeCount) || 0,
        inactiveCount: Number(e.inactiveCount) || 0,
      },
    }));

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("[BAR_RSVP_STATS_ERROR]", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch RSVP stats." });
  }
};
