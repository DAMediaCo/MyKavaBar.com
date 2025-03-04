import { Router } from "express";
import { db } from "@db";
import { users, bannedPhoneNumbers, userActivityLogs, kavaBars } from "@db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/admin";
import { crypto } from "../utils/crypto";
import { fetchKavaBarsByCoordinates } from "../scripts/fetch-by-coordinates";
import { restoreMissingFloridaBars, confirmRestoreMissingFloridaBars } from "../scripts/restore-missing-florida-bars";
import { backupDatabase } from "../utils/backup-database";
import * as fs from 'fs/promises';

const router = Router();

// Get all users with complete user information
router.get("/users", requireAdmin, async (req, res) => {
  try {
    console.log('Admin users request:', {
      user: req.user ? {
        id: req.user.id,
        username: req.user.username,
        isAdmin: req.user.isAdmin
      } : null,
      session: req.session?.id,
      headers: {
        cookie: req.headers.cookie,
        authorization: req.headers.authorization
      }
    });

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
        points: true,
        isAdmin: true,
        createdAt: true,
        lastLoginAt: true,
        updatedAt: true
      }
    });

    console.log(`Found ${usersList.length} users:`,
      usersList.map(u => ({ id: u.id, username: u.username, isAdmin: u.isAdmin }))
    );

    // Set appropriate headers for CORS and caching
    res.set({
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache'
    });

    res.json(usersList);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      error: "Failed to fetch users",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Check if phone is banned
    if (phoneNumber) {
      const [bannedPhone] = await db
        .select()
        .from(bannedPhoneNumbers)
        .where(eq(bannedPhoneNumbers.phoneNumber, phoneNumber))
        .limit(1);

      if (bannedPhone) {
        return res.status(400).json({ error: "This phone number has been banned" });
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
        status: 'active',
        isPhoneVerified: false
      })
      .returning();

    const newUser = result[0];

    // Log the user creation
    await db.insert(userActivityLogs).values({
      userId: newUser.id,
      activityType: 'user_created',
      details: {
        createdBy: req.user?.id,
        role
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
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
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    // Log the update
    await db.insert(userActivityLogs).values({
      userId,
      activityType: 'user_updated',
      details: {
        updatedBy: req.user?.id,
        oldRole: existingUser.role,
        newRole: role
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
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
      activityType: 'user_deleted',
      details: {
        deletedBy: req.user?.id,
        username: existingUser.username,
        email: existingUser.email,
        role: existingUser.role
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
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

    // Start a transaction to update user status and add phone to banned list
    await db.transaction(async (tx) => {
      // Update user status to banned
      await tx
        .update(users)
        .set({
          status: 'banned',
          statusChangedAt: new Date(),
          statusChangedBy: req.user?.id,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      // If user has a phone number, add it to banned numbers
      if (user.phoneNumber && req.user?.id) {
        await tx.insert(bannedPhoneNumbers).values({
          phoneNumber: user.phoneNumber, // Match the schema field
          reason,
          bannedBy: req.user.id, // Match the schema field
          notes: `User ${user.username} banned`
        });
      }

      // Log the ban
      await tx.insert(userActivityLogs).values({
        userId,
        activityType: 'user_banned',
        details: {
          bannedBy: req.user?.id,
          reason,
          phoneNumber: user.phoneNumber
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    });

    res.json({ message: "User banned successfully" });
  } catch (error: any) {
    console.error("Error banning user:", error);
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
      user: req.user?.id
    });

    if (typeof latitude === 'number' && typeof longitude === 'number') {
      await fetchKavaBarsByCoordinates(latitude, longitude);
    }

    res.status(200).json({
      success: true,
      message: "Google Maps data update request received",
      coordinates: {
        latitude: latitude || null,
        longitude: longitude || null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error in Google Maps update endpoint:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process Google Maps update request",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Restore missing Florida kava bars endpoint
router.post("/restore-florida-bars", requireAdmin, async (req, res) => {
  try {
    console.log("Admin requested Florida bar restoration analysis:", {
      user: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // First phase - analyze missing bars
    const result = await restoreMissingFloridaBars();
    
    res.status(200).json({
      success: true,
      message: "Florida bars analysis completed successfully",
      result: {
        analyzed: result.length,
        missingBars: result // Include the actual missing bars data
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error analyzing Florida bars:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze Florida bars",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Targeted analysis of Broward and Palm Beach counties
router.post("/analyze-broward-palm-beach", requireAdmin, async (req, res) => {
  try {
    console.log("Admin requested Broward/Palm Beach bar analysis:", {
      user: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Get all bars from the database
    const existingBars = await db.select({ 
      id: kavaBars.id, 
      placeId: kavaBars.placeId,
      name: kavaBars.name,
      address: kavaBars.address
    }).from(kavaBars);
    
    // Identify bars in Broward and Palm Beach counties
    const browardPalmBeachBars = existingBars.filter(bar => {
      if (!bar.address) return false;
      
      const addr = bar.address.toLowerCase();
      return addr.includes("broward") || 
             addr.includes("fort lauderdale") || 
             addr.includes("hollywood, fl") ||
             addr.includes("pompano") ||
             addr.includes("deerfield") ||
             addr.includes("palm beach") ||
             addr.includes("boca raton") ||
             addr.includes("delray") || 
             addr.includes("boynton") ||
             addr.includes("west palm");
    });
    
    // Do a specific analysis to find missing bars in these counties
    const result = await restoreMissingFloridaBars();
    
    // Filter missing bars for just Broward and Palm Beach
    const browardPalmBeachMissing = result.filter((bar: any) => {
      if (!bar.address) return false;
      
      const addr = bar.address.toLowerCase();
      return addr.includes("broward") || 
             addr.includes("fort lauderdale") || 
             addr.includes("hollywood, fl") ||
             addr.includes("pompano") ||
             addr.includes("deerfield") ||
             addr.includes("palm beach") ||
             addr.includes("boca raton") ||
             addr.includes("delray") || 
             addr.includes("boynton") ||
             addr.includes("west palm");
    });
    
    res.status(200).json({
      success: true,
      message: "Broward and Palm Beach analysis completed successfully",
      result: {
        existingCount: browardPalmBeachBars.length,
        missingCount: browardPalmBeachMissing.length,
        existingBars: browardPalmBeachBars.map(bar => ({
          id: bar.id,
          name: bar.name,
          address: bar.address
        })),
        missingBars: browardPalmBeachMissing
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error analyzing Broward/Palm Beach bars:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze Broward/Palm Beach bars",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Confirm restoration of missing Florida kava bars
router.post("/confirm-restore-florida-bars", requireAdmin, async (req, res) => {
  try {
    const { missingBars } = req.body;
    
    if (!missingBars || !Array.isArray(missingBars) || missingBars.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Missing bars data is required for restoration"
      });
    }
    
    console.log(`Admin confirmed restoration of ${missingBars.length} Florida bars:`, {
      user: req.user?.id,
      barCount: missingBars.length,
      timestamp: new Date().toISOString()
    });
    
    // Execute the restoration with provided bars data
    const result = await confirmRestoreMissingFloridaBars(missingBars);
    
    // Log the activity
    await db.insert(userActivityLogs).values({
      userId: req.user?.id,
      activityType: 'florida_bars_restored',
      details: {
        restoredBy: req.user?.id,
        restoredCount: result.restored,
        skippedCount: result.skipped,
        errorCount: result.errors,
        timestamp: new Date().toISOString()
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(200).json({
      success: true,
      message: `Florida bars restoration completed: ${result.restored} restored, ${result.skipped} skipped, ${result.errors} errors`,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error restoring Florida bars:", error);
    res.status(500).json({
      success: false,
      error: "Failed to restore Florida bars",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Restore Broward and Palm Beach Bars endpoint
router.post("/restore-broward-palm-beach", requireAdmin, async (req, res) => {
  try {
    console.log("Admin requested Broward/Palm Beach bar restoration:", {
      user: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Define the specific missing Place IDs for Broward and Palm Beach
    const MISSING_PLACE_IDS = [
      'ChIJK7aepRsG2YgRCXHB63USFeA', // Vapor Buy + CBD + Smoke + Kratom + Kava
      'ChIJxwlPNV8H2YgRbGNSQVZDfJ0'  // Davie Kava
    ];
    
    console.log("Targeting restoration of specific bars with Place IDs:", MISSING_PLACE_IDS);
    
    // First create a backup
    console.log("Creating backup of current database state...");
    await backupDatabase("pre-operation");
    
    // The backup file to use - should be configurable but using a hardcoded recent one for now
    const BACKUP_FILE = "./backups/kava_bars_post-operation_2025-03-04T02-03-04.144Z.json";
    
    // Read from backup
    const backupData = JSON.parse(await fs.readFile(BACKUP_FILE, 'utf8'));
    const backupBars = backupData.bars || [];
    
    // Find the specific bars to restore
    const barsToRestore = backupBars.filter((bar: any) => 
      MISSING_PLACE_IDS.includes(bar.placeId)
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
      const existing = await db.select({ id: kavaBars.id, name: kavaBars.name })
        .from(kavaBars)
        .where(eq(kavaBars.placeId, bar.placeId));
      
      if (existing.length > 0) {
        console.log(`Bar already exists: ${bar.name} (ID: ${existing[0].id})`);
        skippedBars.push({
          name: bar.name,
          placeId: bar.placeId,
          existingId: existing[0].id
        });
        skipped++;
        continue;
      }
      
      try {
        console.log(`Restoring bar: ${bar.name}`);
        
        // Prepare location
        let location = null;
        if (bar.location) {
          location = typeof bar.location === 'string' 
            ? bar.location 
            : JSON.stringify(bar.location);
        }
        
        // Convert rating if needed
        const ratingValue = typeof bar.rating === 'string' ? parseFloat(bar.rating) : (bar.rating || 0);
        
        // Handle dataCompletenessScore
        const completenessScore = typeof bar.dataCompletenessScore === 'string' 
          ? parseFloat(bar.dataCompletenessScore) 
          : (bar.dataCompletenessScore || 0);
        
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
          ownerId: null // Do not restore owner relationships
        };
        
        const result = await db.insert(kavaBars).values(insertValues);
        
        console.log(`Successfully restored bar: ${bar.name}`);
        restoredBars.push({
          name: bar.name,
          placeId: bar.placeId,
          address: bar.address
        });
        restored++;
      } catch (restoreError: any) {
        console.error(`Error restoring bar ${bar.name}:`, restoreError);
        errorBars.push({
          name: bar.name,
          placeId: bar.placeId,
          error: restoreError.message || String(restoreError)
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
      activityType: 'broward_palm_beach_bars_restored',
      details: {
        restoredBy: req.user?.id,
        restoredCount: restored,
        skippedCount: skipped,
        errorCount: errors,
        timestamp: new Date().toISOString()
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
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
        errorBars
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error in Broward/Palm Beach bar restoration:", error);
    res.status(500).json({
      success: false,
      error: "Failed to restore Broward/Palm Beach bars",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
