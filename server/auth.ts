import { type Express } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import express from "express";
import { Strategy as AppleStrategy } from "passport-apple";
import jwt from "jsonwebtoken";
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
  bannedPhoneNumbers,
  temp,
  user_auth_providers,
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

function parseBool(val: any): boolean {
  // Accepts 1, '1', true, 'true', 'on', 'yes' as true; strict.
  if (
    val === true ||
    val === "true" ||
    val === 1 ||
    val === "1" ||
    val === "on" ||
    val === "yes"
  ) {
    return true;
  }
  if (
    val === false ||
    val === "false" ||
    val === 0 ||
    val === "0" ||
    val === "" ||
    val === null ||
    val === undefined
  ) {
    return false;
  }
  return Boolean(val); // fallback
}

// Initialize Redis session store — fall back to memory store if REDIS_URL not set
let redisStore: any;
if (process.env.REDIS_URL) {
  const redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.connect().catch(console.error);
  redisStore = new RedisStore({ client: redisClient, prefix: "kava-auth:" });
} else {
  // No Redis configured — use default MemoryStore (fine for single-instance fly.io)
  redisStore = undefined;
  console.warn("[auth] REDIS_URL not set — using MemoryStore for sessions");
}
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
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || (() => { throw new Error("SESSION_SECRET env var is required"); })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 90 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
    ...(redisStore ? { store: redisStore } : {}),
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
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

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

        // Block banned users from logging in
        if (user.status === "banned") {
          console.log("Banned user attempted login:", username);
          return done(null, false, { message: "Your account has been banned. Contact support if you believe this is an error." });
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
  // passport.use(
  //   new AppleStrategy(
  //     {
  //       clientID: process.env.APPLE_CLIENT_ID,
  //       teamID: process.env.APPLE_TEAM_ID,
  //       callbackURL: process.env.APPLE_CALLBACK_URL,
  //       keyID: process.env.APPLE_KEY_ID,
  //       privateKeyLocation:
  //         "/home/runner/workspace/server/keys/apple-secret-key.p8",
  //       passReqToCallback: true,
  //     },
  //     function (
  //       req: any,
  //       accessToken: any,
  //       refreshToken: any,
  //       idToken: any,
  //       profile: any,
  //       cb: any,
  //     ) {
  //       console.log("\n\nAccess  Token ", accessToken);
  //       console.log("Refesh toen ", refreshToken);
  //       console.log("ID Token ", idToken);
  //       console.log("Profile ", profile);
  //       // The idToken returned is encoded. You can use the jsonwebtoken library via jwt.decode(idToken)
  //       // to access the properties of the decoded idToken properties which contains the user's
  //       // identity information.
  //       // Here, check if the idToken.sub exists in your database!
  //       // idToken should contains email too if user authorized it but will not contain the name
  //       // `profile` parameter is REQUIRED for the sake of passport implementation
  //       // it should be profile in the future but apple hasn't implemented passing data
  //       // in access token yet https://developer.apple.com/documentation/sign_in_with_apple/tokenresponse
  //       cb(null, idToken);
  //     },
  //   ),
  // );

  passport.use(
    new AppleStrategy(
      {
        clientID: process.env.APPLE_CLIENT_ID!,
        teamID: process.env.APPLE_TEAM_ID!,
        callbackURL: process.env.APPLE_CALLBACK_URL!,
        keyID: process.env.APPLE_KEY_ID!,
        privateKeyLocation:
          "/home/runner/workspace/server/keys/apple-secret-key.p8",
        passReqToCallback: true,
      },
      async (
        req: any,
        accessToken: string,
        refreshToken: string,
        idToken: string,
        profile: any,
        done: any,
      ) => {
        try {
          console.log("\n\nAccess  Token ", accessToken);
          if (req.body.user) {
            console.log("Body user exists", req.body.user);
          } else {
            console.log("Body user does not exist");
          }
          console.log("Refesh toen ", refreshToken);
          console.log("ID Token ", idToken);
          console.log("Profile ", profile);
          // Decode the idToken to extract user info
          const decoded: any = jwt.decode(idToken);

          if (!decoded || !decoded.sub) {
            console.log("Invalid idToken from apple");
            return done(new Error("Invalid idToken from Apple"));
          }
          console.log("Decoded Apple idToken:", decoded);
          const appleUserId = decoded.sub;
          const email = decoded.email;

          if (!email) {
            console.log("No email returned from Apple idToken");
            return done(new Error("No email returned from Apple idToken"));
          }
          // Parse and extract name if provided
          let firstName = "",
            lastName = "";

          if (req.body.user) {
            if (typeof req.body.user === "string") {
              try {
                const parsed = JSON.parse(req.body.user);
                firstName = parsed.name?.firstName || "";
                lastName = parsed.name?.lastName || "";
              } catch {
                // Invalid JSON string, leave firstName and lastName as empty
              }
            } else if (typeof req.body.user === "object") {
              // Already an object
              firstName = req.body.user.name?.firstName || "";
              lastName = req.body.user.name?.lastName || "";
            }
          }
          console.log("First Name:", firstName);
          console.log("Last Name:", lastName);
          console.log("Type of ", req.body.user);
          console.log("\n\nDecoded Apple idToken:", decoded);

          // Check if user exists with this email
          let [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          if (user) {
            if (user.provider !== "apple") {
              return done(null, false, {
                message: `Email registered with ${user.provider}. Please login using that provider.`,
                redirectTo: `/auth?authError=Email registered with ${user.provider}. Please login using that provider.`,
              });
            }
          } else {
            // Create new user
            const [newUser] = await db
              .insert(users)
              .values({
                email,
                // Apple typically does not provide name in token, so optionally fallback to empty
                firstName,
                lastName,
                password: "", // no password for Apple users
                role: "regular_user",
                status: "active",
                isAdmin: false,
                isPhoneVerified: false,
                provider: "apple",
                profilePhotoUrl: null, // Apple does not provide photo
              })
              .returning();

            // Check existing auth provider record
            const existingAuthProvider = await db
              .select()
              .from(user_auth_providers)
              .where(
                and(
                  eq(user_auth_providers.userId, newUser.id),
                  eq(user_auth_providers.provider, "apple"),
                ),
              )
              .limit(1);

            if (existingAuthProvider.length === 0) {
              await db.insert(user_auth_providers).values({
                userId: newUser.id,
                provider: "apple",
                providerAccountId: appleUserId,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }

            user = newUser;
          }

          // Return user without password field
          const { ...userWithoutPassword } = user;
          done(null, userWithoutPassword);
        } catch (error) {
          done(error);
        }
      },
    ),
  );
  // Always use absolute callback URL to match Google Cloud Console configuration
  const googleCallbackURL = "https://mykavabar.com/api/auth/google/callback";
  
  console.log("Google OAuth callbackURL:", googleCallbackURL);
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: googleCallbackURL,
      },
      async (accessToken: string, refreshToken: string, profile: any, done) => {
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
          if (user) {
            if (user.provider !== "google") {
              return done(null, false, {
                message: `Email registered with ${user.provider}. Please login using that provider.`,
                redirectTo: `/auth?authError=Email registered with ${user.provider}. Please login using that provider.`,
              });
            }
          } else {
            // Create a new user for Google login
            const [newUser] = await db
              .insert(users)
              .values({
                email,
                firstName: profile.name?.givenName || "",
                lastName: profile.name?.familyName || "",
                password: "", // no password for Google users
                role: "regular_user",
                status: "active",
                isAdmin: false,
                isPhoneVerified: false,
                provider: "google",
                profilePhotoUrl: profile.photos?.[0]?.value || null,
              })
              .returning();
            const existingAuthProvider = await db
              .select()
              .from(user_auth_providers)
              .where(
                and(
                  eq(user_auth_providers.userId, newUser.id),
                  eq(user_auth_providers.provider, "google"),
                ),
              )
              .limit(1);

            if (existingAuthProvider.length === 0) {
              // Insert new record
              await db.insert(user_auth_providers).values({
                userId: newUser.id,
                provider: "google",
                providerAccountId: profile.id,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
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
    (req, res) => {
      res.redirect("/"); // Or send custom response if API
    },
  );

  app.get("/api/auth/apple", passport.authenticate("apple"));

  app.get(
    "/api/auth/google/callback",
    (req, res, next) => {
      console.log("Google OAuth callback received");
      console.log("Query params:", req.query);
      passport.authenticate("google", (err: any, user: any, info: any) => {
        console.log("Google auth result - Error:", err, "User:", user ? user.id : null, "Info:", info);
        if (err) {
          console.error("Google OAuth error:", err);
          return res.redirect("/auth?authError=" + encodeURIComponent(err.message || "Authentication failed"));
        }
        if (!user) {
          console.log("Google OAuth: No user returned, info:", info);
          const errorMsg = info?.message || "Authentication failed";
          return res.redirect("/auth?authError=" + encodeURIComponent(errorMsg));
        }
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error("Session login error:", loginErr);
            return res.redirect("/auth?authError=" + encodeURIComponent("Session error"));
          }
          console.log("Google OAuth successful, user logged in:", user.id);
          res.redirect("/");
        });
      })(req, res, next);
    },
  );
  app.post(
    "/api/auth/apple/callback",
    passport.authenticate("apple", { failureRedirect: "/auth" }),
    (req, res) => {
      if (req.body.user) {
        console.log("Body user exists", req.body.user);
      } else {
        console.log("Body user does not exist");
      }
      res.redirect("/");
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
    "/api/auth/complete-onboarding/update-username",
    isAuthenticated,
    async (req, res) => {
      try {
        if (!req.user || !req.user.id)
          return res.status(401).json({ error: "Not authenticated" });

        const userId =
          typeof req.user.id === "string"
            ? parseInt(req.user.id, 10)
            : req.user.id;
        const { username, marketingConsent, referralCode } = req.body;
        console.log("Ref code", referralCode);
        if (
          !username ||
          typeof username !== "string" ||
          username.trim().length < 3
        )
          return res
            .status(400)
            .json({ error: "Invalid username or invalid length" });
        if (referralCode) {
          try {
            await createReferral(referralCode, req.user.id);
          } catch (referralError: any) {
            console.warn(
              `Referral warning for user ${req.user.id}: ${referralError.message}`,
            );
            return res.status(400).json({ error: "Invalid referral code" });
            // Optional: Log but don’t block user registration
          }
        }

        const [user] = await db
          .select({ id: users.id, provider: users.provider })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (!user || user.provider === "local") {
          return res
            .status(400)
            .json({ error: "Cannot update username for this provider" });
        }
        const usernameExistsInDb = await usernameExists(username);
        if (usernameExistsInDb)
          return res.status(409).json({ error: "Username already exists" });
        const marketingConsentBool =
          typeof marketingConsent === "string"
            ? marketingConsent.toLowerCase() === "true"
            : Boolean(marketingConsent);

        await db
          .update(users)
          .set({
            username: username.trim(),
            marketingConsent: marketingConsentBool,
          })
          .where(eq(users.id, userId));
        return res.json({ success: true });
      } catch (error: any) {
        console.log("Update username error: ", error);
        res.status(500).json({ error: "Error while updating username" });
      }
    },
  );

  app.put(
    "/api/auth/complete-onboarding/verify-phone",
    isAuthenticated,
    async (req, res) => {
      try {
        if (!req.user || !req.user.id)
          return res.status(401).json({ error: "Not authenticated" });

        if (req.user.isPhoneVerified)
          return res
            .status(400)
            .json({ error: "Phone number already verified" });

        const userId =
          typeof req.user.id === "string"
            ? parseInt(req.user.id, 10)
            : req.user.id;
        const { phoneNumber, code } = req.body;

        if (!phoneNumber && typeof phoneNumber !== "string")
          return res
            .status(400)
            .json({ error: "A valid phone number is required" });
        if (code && typeof code !== "string" && code.length !== 6)
          return res.status(400).json({ error: "Code is not valid" });
        const formattedNumber = formatToE164(phoneNumber);
        if (!formattedNumber.match(/^\+1[2-9]\d{9}$/)) {
          return res.status(400).json({
            success: false,
            error: "Invalid phone number format. Must be a valid US number.",
          });
        }

        const verifyPhoneNumber = await verifyCode(formattedNumber, code);
        if (!verifyPhoneNumber.success)
          return res.status(400).json({ error: "Invalid or expired code" });

        await db
          .update(users)
          .set({
            phoneNumber: phoneNumber,
            isPhoneVerified: true,
          })
          .where(eq(users.id, userId));

        return res.json({ success: true });
      } catch (error: any) {
        console.log("Verify phone error: ", error);
        res.status(500).json({ error: "Error while verifying phone" });
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
        isPhoneVerified: parseBool(req.body.isPhoneVerified),
        marketingConsent: parseBool(req.body.marketingConsent),
        termsAccepted: parseBool(req.body.termsAccepted),
        ageConfirmed: parseBool(req.body.ageConfirmed),
        profilePhotoUrl,
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

      // Block banned phone numbers from re-registering
      const [bannedPhone] = await db
        .select()
        .from(bannedPhoneNumbers)
        .where(eq(bannedPhoneNumbers.phoneNumber, phoneNumber))
        .limit(1);

      if (bannedPhone)
        return res.status(403).json({ error: "This phone number is not eligible to register." });

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

          // Generate JWT for mobile clients
          const jwtSecret = process.env.JWT_SECRET;
          const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            jwtSecret,
            { expiresIn: "90d" },
          );

          // Return the user object along with a success message
          return res.json({
            message: "Login successful",
            token,
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

  // ── Mobile app auth aliases (/api/auth/* → /api/*) ─────────────────────────
  // Build 51 calls /api/auth/login, /api/auth/me, etc.
  // Server has /api/login, /api/user, /api/logout — these aliases bridge the gap.

  app.post("/api/auth/login", (req, res, next) => {
    // Mobile sends { email, password } — normalize to { username, password }
    if (req.body.email && !req.body.username) req.body.username = req.body.email;
    if (!req.body.username || !req.body.password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(400).json({ error: info?.message ?? "Login failed" });
      req.logIn(user, (err) => {
        if (err) return next(err);
        const jwtSecret = process.env.JWT_SECRET!;
        const token = jwt.sign(
          { userId: user.id, email: user.email, role: user.role },
          jwtSecret,
          { expiresIn: "90d" },
        );
        return res.json({
          message: "Login successful",
          token,
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
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        isAdmin: req.user.isAdmin,
        points: req.user.points || 0,
        role: req.user.role,
        phoneNumber: req.user.phoneNumber,
        profilePhotoUrl: req.user.profilePhotoUrl,
      });
    }
    res.status(401).json({ error: "Not authenticated" });
  });

  app.post("/api/auth/register", (req, res, next) => {
    // Normalize fields: mobile sends { email, password, username }
    // Forward to existing /api/register — same body shape
    req.url = "/api/register";
    next("router");
  });
  // ── End mobile auth aliases ─────────────────────────────────────────────────

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
      return res.json({
        user: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          isAdmin: req.user.isAdmin,
          points: req.user.points || 0,
          isPhoneVerified: req.user.isPhoneVerified,
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
