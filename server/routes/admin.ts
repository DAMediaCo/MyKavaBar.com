import { Router } from "express";
import { db } from "@db";
import { getUsersEligibleForPayout } from "../utils/payouts";
import {
  users,
  bannedPhoneNumbers,
  userActivityLogs,
  kavaBars,
} from "@db/schema";
import { and, eq, ne, or, inArray } from "drizzle-orm";
import { requireAdmin } from "../middleware/admin";
import { crypto } from "../utils/crypto";
import { fetchKavaBarsByCoordinates } from "../scripts/fetch-by-coordinates";
import { restoreMissingFloridaBars } from "../scripts/restore-missing-florida-bars";
import { backupDatabase } from "../utils/backup-database";
import * as fs from "fs/promises";
import { updateRewardSchema } from "../schema/referrals";
import { referralAmount, payouts } from "@db/schema";
const router = Router();
import { z } from "zod";
const updateUserSchema = z
  .object({
    username: z
      .string()
      .min(4)
      .max(20)
      .regex(/^[a-zA-Z0-9_]+$/)
      .optional(),
    email: z.string().email().optional(),
    phoneNumber: z
      .string()
      .min(10)
      .max(15)
      .regex(/^[+\d][\d\s\-]{7,15}$/)
      .optional(),
    password: z.preprocess(
      (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
      z.string().min(8).optional(),
    ),
  })
  .refine(
    (data) =>
      data.username !== undefined ||
      data.email !== undefined ||
      data.phoneNumber !== undefined ||
      data.password !== undefined,
    { message: "At least one field must be provided" },
  );
// Get all users with complete user information
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const usersList = await db.query.users.findMany({
      orderBy: (users, { desc }) => [desc(users.createdAt)],
      columns: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        phoneNumber: true,
        isPhoneVerified: true,
        provider: true,
        points: true,
        isAdmin: true,
        createdAt: true,
        lastLoginAt: true,
        updatedAt: true,
      },
    });

    // Fetch ban reasons for banned users
    const bannedPhones = usersList
      .filter(u => u.status === "banned" && u.phoneNumber)
      .map(u => u.phoneNumber!);

    let banReasonMap: Record<string, { reason: string | null; bannedAt: Date }> = {};
    if (bannedPhones.length > 0) {
      const bans = await db
        .select({ phoneNumber: bannedPhoneNumbers.phoneNumber, reason: bannedPhoneNumbers.reason, bannedAt: bannedPhoneNumbers.bannedAt })
        .from(bannedPhoneNumbers)
        .where(inArray(bannedPhoneNumbers.phoneNumber, bannedPhones));
      bans.forEach(b => { banReasonMap[b.phoneNumber] = { reason: b.reason, bannedAt: b.bannedAt }; });
    }

    const usersWithBanInfo = usersList.map(u => ({
      ...u,
      banReason: u.status === "banned" && u.phoneNumber ? (banReasonMap[u.phoneNumber]?.reason ?? null) : null,
      bannedAt: u.status === "banned" && u.phoneNumber ? (banReasonMap[u.phoneNumber]?.bannedAt ?? null) : null,
    }));

    res.set({ "Cache-Control": "no-store", Pragma: "no-cache" });
    res.json(usersWithBanInfo);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      error: "Failed to fetch users",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
router.patch("/users/:userId", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const parseResult = updateUserSchema.safeParse(req.body);
    const [userDetail] = await db
      .select({ id: users.id, provider: users.provider })
      .from(users)
      .where(eq(users.id, Number(userId)))
      .limit(1);

    if (!userDetail) return res.status(404).json({ error: "User not found" });

    if (!parseResult.success) {
      console.log("Validation failed:", parseResult.error.issues);
      return res.status(400).json({
        error:
          "Invalid payload. Only username, email, phoneNumber or password allowed.",
        details: parseResult.error.issues,
      });
    }

    const updates: Record<string, any> = {};

    // Username uniqueness check (exclude self)
    if (parseResult.data.username) {
      console.log(
        "Checking uniqueness of username:",
        parseResult.data.username,
      );
      const existing = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.username, parseResult.data.username),
            ne(users.id, Number(userId)),
          ),
        )
        .limit(1);
      if (existing[0]) {
        console.log("Username already exists for another user.");
        return res.status(409).json({ error: "Username already exists" });
      }
      updates.username = parseResult.data.username.trim();
      console.log("Username will be updated.");
    }

    // Phone number uniqueness check (exclude self)
    if (parseResult.data.phoneNumber) {
      console.log(
        "Checking uniqueness of phoneNumber:",
        parseResult.data.phoneNumber,
      );
      const existingPhone = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.phoneNumber, parseResult.data.phoneNumber),
            ne(users.id, Number(userId)),
          ),
        )
        .limit(1);
      if (existingPhone[0]) {
        console.log("Phone number already exists for another user.");
        return res.status(409).json({ error: "Phone number already exists" });
      }
      updates.phoneNumber = parseResult.data.phoneNumber.trim();
      console.log("Phone number will be updated.");
    }

    // Email updating (optional, add uniqueness check if needed)
    if (parseResult.data.email) {
      updates.email = parseResult.data.email.trim();
      console.log("Email will be updated to:", updates.email);
    }

    // Password hashing
    if (parseResult.data.password) {
      console.log("Hashing password.");
      updates.password = await crypto.hash(parseResult.data.password);
      console.log("Password hashed.");
    }

    // No permitted fields provided
    if (Object.keys(updates).length === 0) {
      console.log("No permitted fields provided for update.");
      return res
        .status(400)
        .json({ error: "No permitted fields provided for update." });
    }

    if (userDetail.provider !== "local") {
      delete updates.email;
      delete updates.password;
    }

    console.log("Performing update with:", updates);
    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, Number(userId)));

    console.log("User info updated successfully.");
    res.json({ success: true, message: "User info updated." });
  } catch (error: any) {
    console.log("ERROR WHILE UPDATING USER:", error);
    res.status(500).json({
      error: "Failed to update user",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.post("/payouts", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId || typeof userId !== "number") {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Get user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .then((rows) => rows[0]);

    if (!user || user.pending < 50) {
      return res.status(400).json({ error: "User not eligible for payout" });
    }
    // Insert payout
    await db.insert(payouts).values({
      userId,
      amount: 50,
      paidAt: new Date(),
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error marking payout:", error);
    return res.status(500).json({
      error: "Failed to mark payout",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
router.get("/payouts/eligible", requireAdmin, async (req, res) => {
  try {
    const usersWithPending = await getUsersEligibleForPayout();
    res.json({ success: true, data: usersWithPending });
  } catch (error: any) {
    console.log("Error fetching eligible payouts: ", error);
    res.status(500).json({
      error: "Failed to fetch eligible payouts",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.get("/referral-reward", requireAdmin, async (_: any, res) => {
  try {
    let reward = 3.0;
    // Get the existing record (if any)
    const existing = await db
      .select({ reward: referralAmount.reward })
      .from(referralAmount)
      .limit(1);

    reward = existing[0]?.reward || reward;
    return res.json({ reward });
  } catch (error: any) {
    console.error("Error updating referral reward:", error);
    res.status(500).json({
      error: "Failed to update reward",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.put("/referral-reward", requireAdmin, async (req: any, res) => {
  try {
    const { reward } = req.body;
    const validatedFields = updateRewardSchema.safeParse({ reward });
    if (!validatedFields.success) {
      return res.status(400).json({ error: "Invalid reward value" });
    }
    // Get the existing record (if any)
    const existing = await db.select().from(referralAmount).limit(1);
    console.log("Existing referral reward:", existing);
    await db
      .update(referralAmount)
      .set({ reward, updatedAt: new Date() })
      .where(eq(referralAmount.id, 1));
    return res.json({ success: "Updated reward successfully" });
  } catch (error: any) {
    console.error("Error updating referral reward:", error);
    res.status(500).json({
      error: "Failed to update reward",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Add new user
router.post("/users", requireAdmin, async (req, res) => {
  try {
    const { username, email, password, role, phoneNumber } = req.body;

    // Check if username exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)))
      .limit(1);

    if (existingUser) {
      return res
        .status(400)
        .json({ error: "Username or email already exists" });
    }

    // Check if phone is banned
    if (phoneNumber) {
      const [bannedPhone] = await db
        .select()
        .from(bannedPhoneNumbers)
        .where(eq(bannedPhoneNumbers.phoneNumber, phoneNumber))
        .limit(1);

      if (bannedPhone) {
        return res
          .status(400)
          .json({ error: "This phone number has been banned" });
      }
    }

    const hashedPassword = await crypto.hash(password);

    // Insert the new user
    const result = await db
      .insert(users)
      .values({
        username,
        email,
        password: hashedPassword,
        role,
        phoneNumber,
        status: "active",
        isPhoneVerified: false,
      })
      .returning();

    const newUser = result[0];

    // Log the user creation
    await db.insert(userActivityLogs).values({
      userId: newUser.id,
      activityType: "user_created",
      details: {
        createdBy: req.user?.id,
        role,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error: any) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: error.message });
  }
});

// Edit user
router.put("/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, email, role, phoneNumber } = req.body;

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set({
        username,
        email,
        role,
        phoneNumber,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    // Log the update
    await db.insert(userActivityLogs).values({
      userId,
      activityType: "user_updated",
      details: {
        updatedBy: req.user?.id,
        oldRole: existingUser.role,
        newRole: role,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error: any) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete user
router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Log the deletion first
    await db.insert(userActivityLogs).values({
      userId,
      activityType: "user_deleted",
      details: {
        deletedBy: req.user?.id,
        username: existingUser.username,
        email: existingUser.email,
        role: existingUser.role,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Delete the user
    await db.delete(users).where(eq(users.id, userId));

    res.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: error.message });
  }
});

// Ban user
router.post("/users/:id/ban", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "Ban reason is required" });
    }

    // Get user details
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user status to banned
    await db
      .update(users)
      .set({
        status: "banned",
        statusChangedAt: new Date(),
        statusChangedBy: req.user?.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Blacklist their phone number if they have one
    if (user.phoneNumber && req.user?.id) {
      await db.insert(bannedPhoneNumbers).values({
        phoneNumber: user.phoneNumber,
        reason,
        bannedBy: req.user.id,
        notes: `User ${user.username} banned`,
      });
    }

    // Log the ban activity
    await db.insert(userActivityLogs).values({
      userId,
      activityType: "user_banned",
      details: {
        bannedBy: req.user?.id,
        reason,
        phoneNumber: user.phoneNumber,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({ message: "User banned successfully" });
  } catch (error: any) {
    console.error("Error banning user:", error);
    res.status(500).json({ error: error.message });
  }
});

// Unban user
router.post("/users/:id/unban", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.status !== "banned") return res.status(400).json({ error: "User is not banned" });

    // Restore user status to active
    await db
      .update(users)
      .set({ status: "active", statusChangedAt: new Date(), statusChangedBy: req.user?.id, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Remove phone from banned list
    if (user.phoneNumber) {
      await db.delete(bannedPhoneNumbers).where(eq(bannedPhoneNumbers.phoneNumber, user.phoneNumber));
    }

    // Log the unban
    await db.insert(userActivityLogs).values({
      userId,
      activityType: "user_unbanned",
      details: { unbannedBy: req.user?.id, phoneNumber: user.phoneNumber },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({ message: "User unbanned successfully" });
  } catch (error: any) {
    console.error("Error unbanning user:", error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle admin status for a user
router.post("/users/:id/toggle-admin", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    const newAdminStatus = !user.isAdmin;
    const [updated] = await db
      .update(users)
      .set({ isAdmin: newAdminStatus, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id, isAdmin: users.isAdmin, username: users.username });
    res.json({ success: true, user: updated });
  } catch (error: any) {
    console.error("Error toggling admin:", error);
    res.status(500).json({ error: error.message });
  }
});

// Google Maps API update endpoint
router.post("/update-google-maps-data", requireAdmin, async (req, res) => {
  try {
    // Extract latitude and longitude from request body
    const { latitude, longitude } = req.body;

    console.log("Admin requested Google Maps data update:", {
      latitude,
      longitude,
      user: req.user?.id,
    });

    if (typeof latitude === "number" && typeof longitude === "number") {
      await fetchKavaBarsByCoordinates(latitude, longitude);
    }

    res.status(200).json({
      success: true,
      message: "Google Maps data update request received",
      coordinates: {
        latitude: latitude || null,
        longitude: longitude || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in Google Maps update endpoint:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process Google Maps update request",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Restore missing Florida kava bars endpoint
router.post("/restore-florida-bars", requireAdmin, async (req, res) => {
  try {
    console.log("Admin requested Florida bar restoration analysis:", {
      user: req.user?.id,
      timestamp: new Date().toISOString(),
    });

    // First phase - analyze missing bars
    const result = await restoreMissingFloridaBars();

    res.status(200).json({
      success: true,
      message: "Florida bars analysis completed successfully",
      result: {
        analyzed: result.length,
        missingBars: result, // Include the actual missing bars data
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error analyzing Florida bars:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze Florida bars",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Targeted analysis of Broward and Palm Beach counties
router.post("/analyze-broward-palm-beach", requireAdmin, async (req, res) => {
  try {
    console.log("Admin requested Broward/Palm Beach bar analysis:", {
      user: req.user?.id,
      timestamp: new Date().toISOString(),
    });

    // Get all bars from the database
    const existingBars = await db
      .select({
        id: kavaBars.id,
        placeId: kavaBars.placeId,
        name: kavaBars.name,
        address: kavaBars.address,
      })
      .from(kavaBars);

    // Identify bars in Broward and Palm Beach counties
    const browardPalmBeachBars = existingBars.filter((bar) => {
      if (!bar.address) return false;

      const addr = bar.address.toLowerCase();
      return (
        addr.includes("broward") ||
        addr.includes("fort lauderdale") ||
        addr.includes("hollywood, fl") ||
        addr.includes("pompano") ||
        addr.includes("deerfield") ||
        addr.includes("palm beach") ||
        addr.includes("boca raton") ||
        addr.includes("delray") ||
        addr.includes("boynton") ||
        addr.includes("west palm")
      );
    });

    // Do a specific analysis to find missing bars in these counties
    const result = await restoreMissingFloridaBars();

    // Filter missing bars for just Broward and Palm Beach
    const browardPalmBeachMissing = result.filter((bar: any) => {
      if (!bar.address) return false;

      const addr = bar.address.toLowerCase();
      return (
        addr.includes("broward") ||
        addr.includes("fort lauderdale") ||
        addr.includes("hollywood, fl") ||
        addr.includes("pompano") ||
        addr.includes("deerfield") ||
        addr.includes("palm beach") ||
        addr.includes("boca raton") ||
        addr.includes("delray") ||
        addr.includes("boynton") ||
        addr.includes("west palm")
      );
    });

    res.status(200).json({
      success: true,
      message: "Broward and Palm Beach analysis completed successfully",
      result: {
        existingCount: browardPalmBeachBars.length,
        missingCount: browardPalmBeachMissing.length,
        existingBars: browardPalmBeachBars.map((bar) => ({
          id: bar.id,
          name: bar.name,
          address: bar.address,
        })),
        missingBars: browardPalmBeachMissing,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error analyzing Broward/Palm Beach bars:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze Broward/Palm Beach bars",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Confirm restoration of missing Florida kava bars
router.post("/confirm-restore-florida-bars", requireAdmin, async (req, res) => {
  try {
    const { missingBars } = req.body;

    if (
      !missingBars ||
      !Array.isArray(missingBars) ||
      missingBars.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing bars data is required for restoration",
      });
    }

    console.log(
      `Admin confirmed restoration of ${missingBars.length} Florida bars:`,
      {
        user: req.user?.id,
        barCount: missingBars.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Execute the restoration with provided bars data
    const result = await confirmRestoreMissingFloridaBars(missingBars);

    // Log the activity
    await db.insert(userActivityLogs).values({
      userId: req.user?.id,
      activityType: "florida_bars_restored",
      details: {
        restoredBy: req.user?.id,
        restoredCount: result.restored,
        skippedCount: result.skipped,
        errorCount: result.errors,
        timestamp: new Date().toISOString(),
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(200).json({
      success: true,
      message: `Florida bars restoration completed: ${result.restored} restored, ${result.skipped} skipped, ${result.errors} errors`,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error restoring Florida bars:", error);
    res.status(500).json({
      success: false,
      error: "Failed to restore Florida bars",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Restore Broward and Palm Beach Bars endpoint
router.post("/restore-broward-palm-beach", requireAdmin, async (req, res) => {
  try {
    console.log("Admin requested Broward/Palm Beach bar restoration:", {
      user: req.user?.id,
      timestamp: new Date().toISOString(),
    });

    // Define the specific missing Place IDs for Broward and Palm Beach
    const MISSING_PLACE_IDS = [
      "ChIJK7aepRsG2YgRCXHB63USFeA", // Vapor Buy + CBD + Smoke + Kratom + Kava
      "ChIJxwlPNV8H2YgRbGNSQVZDfJ0", // Davie Kava
    ];

    console.log(
      "Targeting restoration of specific bars with Place IDs:",
      MISSING_PLACE_IDS,
    );

    // First create a backup
    console.log("Creating backup of current database state...");
    await backupDatabase("pre-operation");

    // The backup file to use - should be configurable but using a hardcoded recent one for now
    const BACKUP_FILE =
      "./backups/kava_bars_post-operation_2025-03-04T02-03-04.144Z.json";

    // Read from backup
    const backupData = JSON.parse(await fs.readFile(BACKUP_FILE, "utf8"));
    const backupBars = backupData.bars || [];

    // Find the specific bars to restore
    const barsToRestore = backupBars.filter((bar: any) =>
      MISSING_PLACE_IDS.includes(bar.placeId),
    );

    console.log(`Found ${barsToRestore.length} specific bars to restore`);

    // For each bar, check if it exists, and restore if not
    let restored = 0;
    let skipped = 0;
    let errors = 0;
    const restoredBars = [];
    const skippedBars = [];
    const errorBars = [];

    for (const bar of barsToRestore) {
      // Check if already exists
      const existing = await db
        .select({ id: kavaBars.id, name: kavaBars.name })
        .from(kavaBars)
        .where(eq(kavaBars.placeId, bar.placeId));

      if (existing.length > 0) {
        console.log(`Bar already exists: ${bar.name} (ID: ${existing[0].id})`);
        skippedBars.push({
          name: bar.name,
          placeId: bar.placeId,
          existingId: existing[0].id,
        });
        skipped++;
        continue;
      }

      try {
        console.log(`Restoring bar: ${bar.name}`);

        // Prepare location
        let location = null;
        if (bar.location) {
          location =
            typeof bar.location === "string"
              ? bar.location
              : JSON.stringify(bar.location);
        }

        // Convert rating if needed
        const ratingValue =
          typeof bar.rating === "string"
            ? parseFloat(bar.rating)
            : bar.rating || 0;

        // Handle dataCompletenessScore
        const completenessScore =
          typeof bar.dataCompletenessScore === "string"
            ? parseFloat(bar.dataCompletenessScore)
            : bar.dataCompletenessScore || 0;

        // Insert bar with proper value handling
        const insertValues = {
          name: bar.name || "",
          address: bar.address || "",
          placeId: bar.placeId,
          location: location,
          rating: ratingValue,
          businessStatus: bar.businessStatus || "OPERATIONAL",
          verificationStatus: bar.verificationStatus || "pending",
          dataCompletenessScore: completenessScore,
          isVerifiedKavaBar: bar.isVerifiedKavaBar || false,
          verificationNotes: "Restored from March 4 backup via admin API",
          createdAt: new Date(bar.createdAt || new Date()),
          lastVerified: bar.lastVerified ? new Date(bar.lastVerified) : null,
          updatedAt: new Date(),
          phone: bar.phone || null,
          website: bar.website || null,
          hours: bar.hours || null,
          googlePlaceId: bar.googlePlaceId || null,
          ownerId: null, // Do not restore owner relationships
        };

        const result = await db.insert(kavaBars).values(insertValues);

        console.log(`Successfully restored bar: ${bar.name}`);
        restoredBars.push({
          name: bar.name,
          placeId: bar.placeId,
          address: bar.address,
        });
        restored++;
      } catch (restoreError: any) {
        console.error(`Error restoring bar ${bar.name}:`, restoreError);
        errorBars.push({
          name: bar.name,
          placeId: bar.placeId,
          error: restoreError.message || String(restoreError),
        });
        errors++;
      }
    }

    // Create backup after restoration
    console.log("Creating backup after restoration...");
    await backupDatabase("post-operation");

    // Log the activity
    await db.insert(userActivityLogs).values({
      userId: req.user?.id,
      activityType: "broward_palm_beach_bars_restored",
      details: {
        restoredBy: req.user?.id,
        restoredCount: restored,
        skippedCount: skipped,
        errorCount: errors,
        timestamp: new Date().toISOString(),
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Return the response
    res.status(200).json({
      success: true,
      message: `Broward/Palm Beach bars restoration completed: ${restored} restored, ${skipped} skipped, ${errors} errors`,
      result: {
        restored,
        skipped,
        errors,
        restoredBars,
        skippedBars,
        errorBars,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in Broward/Palm Beach bar restoration:", error);
    res.status(500).json({
      success: false,
      error: "Failed to restore Broward/Palm Beach bars",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;
