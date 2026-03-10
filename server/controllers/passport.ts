import { Request, Response } from "express";
import { db } from "../../db";
import {
  passportCheckins,
  passportStats,
  kavaBars,
  users,
} from "../../db/schema";
import { eq, and, gte, desc, sql, inArray } from "drizzle-orm";
import { differenceInDays, startOfDay, subDays } from "date-fns";

// Haversine formula to calculate distance between two GPS coordinates (in meters)
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Calculate streak from check-ins
function calculateStreak(checkins: Array<{ checkedInAt: Date }>): {
  currentStreak: number;
  longestStreak: number;
} {
  if (checkins.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Sort by date descending
  const sorted = checkins
    .map((c) => startOfDay(new Date(c.checkedInAt)))
    .sort((a, b) => b.getTime() - a.getTime());

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;
  const today = startOfDay(new Date());

  // Check if most recent check-in is today or yesterday
  const daysSinceLastCheckin = differenceInDays(today, sorted[0]);
  if (daysSinceLastCheckin > 1) {
    currentStreak = 0;
  } else {
    currentStreak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = differenceInDays(sorted[i - 1], sorted[i]);
      if (diff === 1) {
        currentStreak++;
        tempStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  tempStreak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = differenceInDays(sorted[i - 1], sorted[i]);
    if (diff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  return { currentStreak, longestStreak };
}

/**
 * POST /api/passport/checkin
 * Check in at a bar with GPS verification
 */
export const checkin = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { barId, lat, lng, notes } = req.body;
    const userId = req.user.id;

    if (!barId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Get bar location
    const [bar] = await db
      .select()
      .from(kavaBars)
      .where(eq(kavaBars.id, barId))
      .limit(1);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    if (!bar.location || typeof bar.location !== "object") {
      return res.status(400).json({ error: "Bar location not available" });
    }

    const barLocation = bar.location as { lat: number; lng: number };
    const distance = haversineDistance(
      parseFloat(lat),
      parseFloat(lng),
      barLocation.lat,
      barLocation.lng,
    );

    // Verify user is within 200m
    if (distance > 200) {
      return res.status(400).json({
        error: "Too far from bar",
        distance: Math.round(distance),
        required: 200,
      });
    }

    // Check for duplicate check-in within 24h
    const yesterday = subDays(new Date(), 1);
    const [recentCheckin] = await db
      .select()
      .from(passportCheckins)
      .where(
        and(
          eq(passportCheckins.userId, userId),
          eq(passportCheckins.barId, barId),
          gte(passportCheckins.checkedInAt, yesterday),
        ),
      )
      .limit(1);

    if (recentCheckin) {
      return res.status(400).json({
        error: "Already checked in at this bar within 24 hours",
      });
    }

    // Create check-in
    const [checkinResult] = await db
      .insert(passportCheckins)
      .values({
        userId,
        barId,
        lat: lat.toString(),
        lng: lng.toString(),
        notes: notes || null,
      })
      .returning();

    // Get all user check-ins for stats calculation
    const allCheckins = await db
      .select()
      .from(passportCheckins)
      .where(eq(passportCheckins.userId, userId));

    // Calculate unique bars
    const uniqueBarIds = new Set(allCheckins.map((c) => c.barId));

    // Calculate streaks
    const { currentStreak, longestStreak } = calculateStreak(allCheckins);

    // Update or create stats
    const [existingStats] = await db
      .select()
      .from(passportStats)
      .where(eq(passportStats.userId, userId))
      .limit(1);

    if (existingStats) {
      await db
        .update(passportStats)
        .set({
          totalCheckins: allCheckins.length,
          uniqueBars: uniqueBarIds.size,
          currentStreak,
          longestStreak,
          lastCheckinAt: new Date(),
        })
        .where(eq(passportStats.userId, userId));
    } else {
      await db.insert(passportStats).values({
        userId,
        totalCheckins: allCheckins.length,
        uniqueBars: uniqueBarIds.size,
        currentStreak,
        longestStreak,
        lastCheckinAt: new Date(),
      });
    }

    // Update ranks for all users
    await updateRanks();

    return res.json({
      success: true,
      checkin: checkinResult,
      stats: {
        totalCheckins: allCheckins.length,
        uniqueBars: uniqueBarIds.size,
        currentStreak,
        longestStreak,
      },
    });
  } catch (error) {
    console.error("Check-in error:", error);
    return res.status(500).json({ error: "Failed to check in" });
  }
};

/**
 * Update ranks for all users based on unique bars visited
 */
async function updateRanks() {
  const allStats = await db
    .select()
    .from(passportStats)
    .orderBy(desc(passportStats.uniqueBars));

  for (let i = 0; i < allStats.length; i++) {
    await db
      .update(passportStats)
      .set({ rank: i + 1 })
      .where(eq(passportStats.userId, allStats[i].userId));
  }
}

/**
 * GET /api/passport/:userId
 * Get user's passport stamps and stats
 */
export const getPassport = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Get user stats
    const [stats] = await db
      .select()
      .from(passportStats)
      .where(eq(passportStats.userId, userId))
      .limit(1);

    // Get all check-ins with bar details
    const checkins = await db
      .select({
        id: passportCheckins.id,
        barId: passportCheckins.barId,
        checkedInAt: passportCheckins.checkedInAt,
        notes: passportCheckins.notes,
        barName: kavaBars.name,
        barAddress: kavaBars.address,
        barLocation: kavaBars.location,
      })
      .from(passportCheckins)
      .leftJoin(kavaBars, eq(passportCheckins.barId, kavaBars.id))
      .where(eq(passportCheckins.userId, userId))
      .orderBy(desc(passportCheckins.checkedInAt));

    return res.json({
      stats: stats || {
        userId,
        totalCheckins: 0,
        uniqueBars: 0,
        currentStreak: 0,
        longestStreak: 0,
        rank: null,
        lastCheckinAt: null,
      },
      stamps: checkins,
    });
  } catch (error) {
    console.error("Get passport error:", error);
    return res.status(500).json({ error: "Failed to get passport" });
  }
};

/**
 * GET /api/passport/leaderboard
 * Get leaderboard with optional scope filtering
 */
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const scope = (req.query.scope as string) || "global";
    const limit = parseInt(req.query.limit as string) || 50;

    let query = db
      .select({
        userId: passportStats.userId,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profilePhotoUrl: users.profilePhotoUrl,
        totalCheckins: passportStats.totalCheckins,
        uniqueBars: passportStats.uniqueBars,
        currentStreak: passportStats.currentStreak,
        rank: passportStats.rank,
      })
      .from(passportStats)
      .leftJoin(users, eq(passportStats.userId, users.id))
      .orderBy(desc(passportStats.uniqueBars))
      .limit(limit);

    // For monthly scope, only include users who checked in this month
    if (scope === "monthly") {
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);

      const monthlyCheckins = await db
        .select({
          userId: passportCheckins.userId,
          count: sql<number>`count(distinct ${passportCheckins.barId})`,
        })
        .from(passportCheckins)
        .where(gte(passportCheckins.checkedInAt, firstDayOfMonth))
        .groupBy(passportCheckins.userId)
        .orderBy(desc(sql`count(distinct ${passportCheckins.barId})`))
        .limit(limit);

      return res.json({
        scope,
        leaderboard: monthlyCheckins,
      });
    }

    // For state/city scope, we'd need to filter by bar locations
    // This would require joining with check-ins and bars
    if (scope === "state" || scope === "city") {
      const locationFilter = req.query.location as string;
      if (!locationFilter) {
        return res
          .status(400)
          .json({ error: "Location parameter required for state/city scope" });
      }

      // Get unique bars per user in the specified location
      const result = await db
        .select({
          userId: passportCheckins.userId,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          profilePhotoUrl: users.profilePhotoUrl,
          uniqueBars: sql<number>`count(distinct ${passportCheckins.barId})`,
        })
        .from(passportCheckins)
        .leftJoin(users, eq(passportCheckins.userId, users.id))
        .leftJoin(kavaBars, eq(passportCheckins.barId, kavaBars.id))
        .where(sql`${kavaBars.address} ILIKE ${`%${locationFilter}%`}`)
        .groupBy(
          passportCheckins.userId,
          users.username,
          users.firstName,
          users.lastName,
          users.profilePhotoUrl,
        )
        .orderBy(desc(sql`count(distinct ${passportCheckins.barId})`))
        .limit(limit);

      return res.json({
        scope,
        location: locationFilter,
        leaderboard: result,
      });
    }

    // Global leaderboard
    const result = await query;

    return res.json({
      scope,
      leaderboard: result,
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    return res.status(500).json({ error: "Failed to get leaderboard" });
  }
};

/**
 * GET /api/passport/badges/:userId
 * Get earned badges based on stats
 */
export const getBadges = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Get user stats
    const [stats] = await db
      .select()
      .from(passportStats)
      .where(eq(passportStats.userId, userId))
      .limit(1);

    if (!stats) {
      return res.json({ badges: [] });
    }

    // Get all check-ins to check for multi-state achievement
    const checkins = await db
      .select({
        barAddress: kavaBars.address,
      })
      .from(passportCheckins)
      .leftJoin(kavaBars, eq(passportCheckins.barId, kavaBars.id))
      .where(eq(passportCheckins.userId, userId));

    // Extract states from addresses (simple approach - look for state abbreviations)
    const statePattern = /\b([A-Z]{2})\b/g;
    const states = new Set<string>();
    checkins.forEach((c) => {
      if (c.barAddress) {
        const matches = c.barAddress.match(statePattern);
        if (matches) {
          matches.forEach((state) => states.add(state));
        }
      }
    });

    const badges = [];

    // 🌱 First Sip - First check-in
    if (stats.totalCheckins >= 1) {
      badges.push({
        id: "first_sip",
        emoji: "🌱",
        name: "First Sip",
        description: "Completed your first check-in",
        earnedAt: stats.lastCheckinAt,
      });
    }

    // 🗺️ Explorer - 5 unique bars
    if (stats.uniqueBars >= 5) {
      badges.push({
        id: "explorer",
        emoji: "🗺️",
        name: "Explorer",
        description: "Visited 5 unique kava bars",
        earnedAt: stats.lastCheckinAt,
      });
    }

    // 🏆 Kava King/Queen - 25 unique bars
    if (stats.uniqueBars >= 25) {
      badges.push({
        id: "kava_royalty",
        emoji: "🏆",
        name: "Kava King/Queen",
        description: "Visited 25 unique kava bars",
        earnedAt: stats.lastCheckinAt,
      });
    }

    // 🌍 Globetrotter - Bars in 5+ states
    if (states.size >= 5) {
      badges.push({
        id: "globetrotter",
        emoji: "🌍",
        name: "Globetrotter",
        description: "Visited kava bars in 5+ states",
        earnedAt: stats.lastCheckinAt,
      });
    }

    // 🔥 On Fire - 7-day streak
    if (stats.currentStreak >= 7) {
      badges.push({
        id: "on_fire",
        emoji: "🔥",
        name: "On Fire",
        description: "7-day check-in streak",
        earnedAt: stats.lastCheckinAt,
      });
    }

    // 👑 Legend - 50+ unique bars
    if (stats.uniqueBars >= 50) {
      badges.push({
        id: "legend",
        emoji: "👑",
        name: "Legend",
        description: "Visited 50+ unique kava bars",
        earnedAt: stats.lastCheckinAt,
      });
    }

    return res.json({ badges });
  } catch (error) {
    console.error("Get badges error:", error);
    return res.status(500).json({ error: "Failed to get badges" });
  }
};
