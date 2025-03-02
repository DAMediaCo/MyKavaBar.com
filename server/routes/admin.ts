import { Router } from "express";
import { db } from "@db";
import { users, bannedPhoneNumbers, userActivityLogs, kavaBars } from "@db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/admin";
import { crypto } from "../utils/crypto";

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
    const { latitude, longitude, barId } = req.body;
    
    console.log("Admin requested Google Maps data update:", { 
      latitude, 
      longitude,
      barId,
      user: req.user?.id
    });
    
    // If barId is provided, update that specific bar's coordinates
    // Otherwise, it's just a general request for location update
    if (barId && typeof latitude === 'number' && typeof longitude === 'number') {
      try {
        const barIdNum = parseInt(barId);
        
        // Update the bar's location in the database
        const updatedBar = await db.query.kavaBars.findFirst({
          where: (kavaBars, { eq }) => eq(kavaBars.id, barIdNum)
        });
        
        if (!updatedBar) {
          return res.status(404).json({
            success: false,
            error: "Bar not found"
          });
        }
        
        // Update the bar with the new coordinates
        await db.update(kavaBars)
          .set({
            location: JSON.stringify({ lat: latitude, lng: longitude }),
            updatedAt: new Date()
          })
          .where(eq(kavaBars.id, barIdNum));
          
        return res.status(200).json({
          success: true,
          message: "Bar coordinates updated successfully",
          barId: barIdNum,
          coordinates: {
            latitude,
            longitude
          },
          timestamp: new Date().toISOString()
        });
      } catch (updateError: any) {
        console.error("Error updating bar coordinates:", updateError);
        return res.status(500).json({
          success: false,
          error: "Failed to update bar coordinates",
          details: process.env.NODE_ENV === 'development' ? updateError.message : undefined
        });
      }
    }
    
    // If no specific bar ID was provided, just acknowledge the coordinates
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

export default router;