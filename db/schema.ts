import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  decimal,
  foreignKey,
  jsonb,
  uuid,
  pgEnum,
  date,
  time,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations, type InferModel } from "drizzle-orm";

// Define user roles enum
export const userRole = pgEnum("user_role", [
  "regular_user",
  "kavatender",
  "bar_owner",
  "admin",
]);

// Define user status enum
export const userStatus = pgEnum("user_status", [
  "active",
  "suspended",
  "banned",
]);

// Define the users table with all fields including self-reference
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  username: text("username").unique().notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  phoneNumber: text("phone_number").unique(),
  isPhoneVerified: boolean("is_phone_verified").default(false).notNull(),
  profilePhotoUrl: text("profile_photo_url"),
  role: userRole("role").default("regular_user").notNull(),
  status: userStatus("status").default("active").notNull(),
  points: integer("points").default(0).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  squareCustomerId: text("square_customer_id"),
  lastLoginAt: timestamp("last_login_at"),
  statusChangedAt: timestamp("status_changed_at"),
  statusChangedBy: integer("status_changed_by").references(() => users.id),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordExpires: timestamp("reset_password_expires"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

// New table for tracking banned phone numbers
export const bannedPhoneNumbers = pgTable("banned_phone_numbers", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").unique().notNull(),
  reason: text("reason"),
  bannedBy: integer("banned_by")
    .references(() => users.id)
    .notNull(),
  bannedAt: timestamp("banned_at").defaultNow().notNull(),
  notes: text("notes"),
});

// New table for user activity logs
export const userActivityLogs = pgTable("user_activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  activityType: text("activity_type").notNull(),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const phoneVerificationCodes = pgTable("phone_verification_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  phoneNumber: text("phone_number").notNull(),
  verificationId: text("verification_id").notNull(),
  type: text("type").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  token: uuid("token").defaultRandom().notNull(),
  phoneVerificationId: integer("phone_verification_id").references(
    () => phoneVerificationCodes.id,
    { onDelete: "set null" },
  ),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const kavaBars = pgTable("kava_bars", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  hours: jsonb("hours"),
  placeId: text("place_id").unique(),
  rating: decimal("rating", { precision: 3, scale: 2 })
    .default("0.00")
    .notNull(),
  location: jsonb("location"),
  ownerId: integer("owner_id").references(() => users.id),
  isSponsored: boolean("is_sponsored").default(false),
  virtualTourUrl: text("virtual_tour_url"),
  googlePhotos: jsonb("google_photos").default("[]"),
  lastVerified: timestamp("last_verified"),
  verificationStatus: text("verification_status"),
  businessStatus: text("business_status"),
  dataCompletenessScore: decimal("data_completeness_score", {
    precision: 3,
    scale: 2,
  }).default("0.00"),
  isVerifiedKavaBar: boolean("is_verified_kava_bar").default(false),
  verificationNotes: text("verification_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// New table for user favorites
export const userFavorites = pgTable("favourite_bars", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  barId: integer("bar_id")
    .references(() => kavaBars.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// // New table for FCM tokens
// export const fcmTokens = pgTable("fcm_tokens", {
//   id: serial("id").primaryKey(),
//   userId: integer("user_id")
//     .references(() => users.id, { onDelete: "cascade" })
//     .notNull(),
//   token: text("token").notNull(),
//   device: text("device"),
//   createdAt: timestamp("created_at").defaultNow().notNull(),
//   updatedAt: timestamp("updated_at"),
// });

export const verificationRequests = pgTable("verification_requests", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id")
    .references(() => kavaBars.id, { onDelete: "cascade" })
    .notNull(),
  requesterId: integer("requester_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  requesterName: text("requester_name").notNull(),
  barName: text("bar_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const verificationCodes = pgTable("verification_codes", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id")
    .references(() => kavaBars.id, { onDelete: "cascade" })
    .notNull(),
  code: text("code").notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sponsoredListings = pgTable("sponsored_listings", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id").references(() => kavaBars.id, {
    onDelete: "cascade",
  }),
  squarePaymentId: text("square_payment_id").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  barId: integer("bar_id").references(() => kavaBars.id, {
    onDelete: "cascade",
  }),
  rating: integer("rating").notNull(),
  content: text("content").notNull(),
  upvotes: integer("upvotes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const upvotes = pgTable("upvotes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  reviewId: integer("review_id").references(() => reviews.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const crowdDensityLevel = pgEnum("crowd_density_level", [
  "low",
  "medium",
  "high",
  "very_high",
]);

export const crowdDensity = pgTable("crowd_density", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id")
    .references(() => kavaBars.id, { onDelete: "cascade" })
    .notNull(),
  level: crowdDensityLevel("level").notNull(),
  count: integer("count"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  reportedBy: integer("reported_by").references(() => users.id),
  note: text("note"),
});

export const kavaBarPhotos = pgTable("kava_bar_photos", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id")
    .references(() => kavaBars.id, { onDelete: "cascade" })
    .notNull(),
  url: text("url").notNull(),
  caption: text("caption"),
  isPrimary: boolean("is_primary").default(false).notNull(),
  uploadedById: integer("uploaded_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const barEvents = pgTable("bar_events", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id")
    .references(() => kavaBars.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  isRecurring: boolean("is_recurring").default(true).notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

// Add new table for bar staff (kavatenders)
export const barStaff = pgTable("bar_staff", {
  id: serial("id").primaryKey(),
  barId: integer("bar_id")
    .references(() => kavaBars.id, { onDelete: "cascade" })
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  hireDate: timestamp("hire_date").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  position: text("position").default("kavatender").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

// Create check-ins table for Kavatenders
export const checkIns = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  barStaffId: integer("bar_staff_id")
    .references(() => barStaff.id, { onDelete: "cascade" })
    .notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const kavatenders = pgTable("kavatenders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  barId: integer("bar_id").references(() => kavaBars.id),
  phoneNumber: text("phone_number").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  status: text("status").default("pending"),
});

export const temp = pgTable("temp", {
  id: serial("id").primaryKey(),
  temp1: text("temp1").notNull(),
  temp2: text("temp2").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Add notification type enum
export const notificationType = pgEnum("notification_type", [
  "review",
  "photo",
]);

// Add notification preferences table
export const barOwnerNotificationPreferences = pgTable(
  "bar_owner_notification_preferences",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    reviewNotifications: boolean("review_notifications")
      .default(true)
      .notNull(),
    photoNotifications: boolean("photo_notifications").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at"),
  },
);

// Add notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  barId: integer("bar_id")
    .references(() => kavaBars.id, { onDelete: "cascade" })
    .notNull(),
  type: notificationType("type").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  relatedItemId: integer("related_item_id"), // ID of the review or photo
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add barOwnerNotifications table after the notifications table
export const barOwnerNotifications = pgTable("bar_owner_notifications", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  barId: integer("bar_id")
    .references(() => kavaBars.id, { onDelete: "cascade" })
    .notNull(),
  type: notificationType("type").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userRelations = relations(users, ({ many }) => ({
  reviews: many(reviews),
  upvotes: many(upvotes),
  ownedBars: many(kavaBars),
  worksAt: many(barStaff),
  passwordResetTokens: many(passwordResetTokens),
  phoneVerificationCodes: many(phoneVerificationCodes),
  activityLogs: many(userActivityLogs),
  bannedNumbers: many(bannedPhoneNumbers, { relationName: "banned_by_user" }),
  notifications: many(notifications),
  notificationPreferences: many(barOwnerNotificationPreferences),
  favorites: many(userFavorites),
}));

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(users, {
    fields: [userFavorites.userId],
    references: [users.id],
  }),
  bar: one(kavaBars, {
    fields: [userFavorites.barId],
    references: [kavaBars.id],
  }),
}));

// export const fcmTokensRelations = relations(fcmTokens, ({ one }) => ({
//   user: one(users, {
//     fields: [fcmTokens.userId],
//     references: [users.id],
//   }),
// }));

export const kavaBarRelations = relations(kavaBars, ({ many, one }) => ({
  reviews: many(reviews),
  owner: one(users, {
    fields: [kavaBars.ownerId],
    references: [users.id],
  }),
  staff: many(barStaff),
  sponsoredListings: many(sponsoredListings),
  verificationCodes: many(verificationCodes),
  crowdDensity: many(crowdDensity),
  photos: many(kavaBarPhotos),
  events: many(barEvents),
}));

export const passwordResetTokenRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
    phoneVerification: one(phoneVerificationCodes, {
      fields: [passwordResetTokens.phoneVerificationId],
      references: [phoneVerificationCodes.id],
    }),
  }),
);

export const phoneVerificationCodeRelations = relations(
  phoneVerificationCodes,
  ({ one }) => ({
    user: one(users, {
      fields: [phoneVerificationCodes.userId],
      references: [users.id],
    }),
  }),
);

export const reviewRelations = relations(reviews, ({ one, many }) => ({
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  bar: one(kavaBars, {
    fields: [reviews.barId],
    references: [kavaBars.id],
  }),
  upvotes: many(upvotes),
}));

export const sponsoredListingRelations = relations(
  sponsoredListings,
  ({ one }) => ({
    bar: one(kavaBars, {
      fields: [sponsoredListings.barId],
      references: [kavaBars.id],
    }),
  }),
);

export const verificationCodeRelations = relations(
  verificationCodes,
  ({ one }) => ({
    bar: one(kavaBars, {
      fields: [verificationCodes.barId],
      references: [kavaBars.id],
    }),
  }),
);

export const verificationRequestRelations = relations(
  verificationRequests,
  ({ one }) => ({
    bar: one(kavaBars, {
      fields: [verificationRequests.barId],
      references: [kavaBars.id],
    }),
    requester: one(users, {
      fields: [verificationRequests.requesterId],
      references: [users.id],
    }),
  }),
);

export const kavaBarPhotoRelations = relations(kavaBarPhotos, ({ one }) => ({
  bar: one(kavaBars, {
    fields: [kavaBarPhotos.barId],
    references: [kavaBars.id],
  }),
  uploadedBy: one(users, {
    fields: [kavaBarPhotos.uploadedById],
    references: [users.id],
  }),
}));

export const barEventRelations = relations(barEvents, ({ one }) => ({
  bar: one(kavaBars, {
    fields: [barEvents.barId],
    references: [kavaBars.id],
  }),
  creator: one(users, {
    fields: [barEvents.createdBy],
    references: [users.id],
  }),
}));

export const barStaffRelations = relations(barStaff, ({ one, many }) => ({
  bar: one(kavaBars, {
    fields: [barStaff.barId],
    references: [kavaBars.id],
  }),
  user: one(users, {
    fields: [barStaff.userId],
    references: [users.id],
  }),
  checkIns: many(checkIns),
}));

export const barOwnerNotificationPreferenceRelations = relations(
  barOwnerNotificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [barOwnerNotificationPreferences.userId],
      references: [users.id],
    }),
  }),
);

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  bar: one(kavaBars, {
    fields: [notifications.barId],
    references: [kavaBars.id],
  }),
}));

// Add relations for barOwnerNotifications
export const barOwnerNotificationRelations = relations(
  barOwnerNotifications,
  ({ one }) => ({
    owner: one(users, {
      fields: [barOwnerNotifications.ownerId],
      references: [users.id],
    }),
    bar: one(kavaBars, {
      fields: [barOwnerNotifications.barId],
      references: [kavaBars.id],
    }),
  }),
);

export type User = InferModel<typeof users>;
export type InsertUser = typeof users.$inferInsert;
export type KavaBar = typeof kavaBars.$inferSelect & {
  reviews?: Array<
    typeof reviews.$inferSelect & {
      user: typeof users.$inferSelect;
    }
  >;
  location?: {
    lat: number;
    lng: number;
  };
  googlePhotos?: Array<{
    photoReference: string;
    width: number;
    height: number;
  }>;
};
export type InsertKavaBar = typeof kavaBars.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;
export type SponsoredListing = typeof sponsoredListings.$inferSelect;
export type InsertSponsoredListing = typeof sponsoredListings.$inferInsert;
export type VerificationCode = typeof verificationCodes.$inferSelect;
export type InsertVerificationCode = typeof verificationCodes.$inferInsert;
export type VerificationRequest = typeof verificationRequests.$inferSelect;
export type InsertVerificationRequest =
  typeof verificationRequests.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type CrowdDensity = typeof crowdDensity.$inferSelect;
export type InsertCrowdDensity = typeof crowdDensity.$inferInsert;
export type KavaBarPhoto = typeof kavaBarPhotos.$inferSelect;
export type InsertKavaBarPhoto = typeof kavaBarPhotos.$inferInsert;
export type BarEvent = typeof barEvents.$inferSelect;
export type InsertBarEvent = typeof barEvents.$inferInsert;
export type PhoneVerificationCode = typeof phoneVerificationCodes.$inferSelect;
export type InsertPhoneVerificationCode =
  typeof phoneVerificationCodes.$inferInsert;
export type BannedPhoneNumber = typeof bannedPhoneNumbers.$inferSelect;
export type InsertBannedPhoneNumber = typeof bannedPhoneNumbers.$inferInsert;
export type UserActivityLog = typeof userActivityLogs.$inferSelect;
export type InsertUserActivityLog = typeof userActivityLogs.$inferInsert;
export type BarStaff = typeof barStaff.$inferSelect;
export type InsertBarStaff = typeof barStaff.$inferInsert;
export type CheckIn = typeof checkIns.$inferSelect;
export type InsertCheckIn = typeof checkIns.$inferInsert;
export type Kavatender = typeof kavatenders.$inferSelect;
export type InsertKavatender = typeof kavatenders.$inferInsert;
export type BarOwnerNotificationPreference =
  typeof barOwnerNotificationPreferences.$inferSelect;
export type InsertBarOwnerNotificationPreference =
  typeof barOwnerNotificationPreferences.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
// Add types for barOwnerNotifications
export type BarOwnerNotification = typeof barOwnerNotifications.$inferSelect;
export type InsertBarOwnerNotification =
  typeof barOwnerNotifications.$inferInsert;

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertKavaBarSchema = createInsertSchema(kavaBars);
export const insertReviewSchema = createInsertSchema(reviews);
export const insertVerificationCodeSchema =
  createInsertSchema(verificationCodes);
export const selectVerificationCodeSchema =
  createSelectSchema(verificationCodes);
export const insertVerificationRequestSchema =
  createInsertSchema(verificationRequests);
export const selectVerificationRequestSchema =
  createSelectSchema(verificationRequests);
export const insertPasswordResetTokenSchema =
  createInsertSchema(passwordResetTokens);
export const selectPasswordResetTokenSchema =
  createSelectSchema(passwordResetTokens);
export const insertCrowdDensitySchema = createInsertSchema(crowdDensity);
export const selectCrowdDensitySchema = createSelectSchema(crowdDensity);
export const insertKavaBarPhotoSchema = createInsertSchema(kavaBarPhotos);
export const selectKavaBarPhotoSchema = createSelectSchema(kavaBarPhotos);
export const insertBarEventSchema = createInsertSchema(barEvents);
export const selectBarEventSchema = createSelectSchema(barEvents);
export const insertPhoneVerificationCodeSchema = createInsertSchema(
  phoneVerificationCodes,
);
export const selectPhoneVerificationCodeSchema = createSelectSchema(
  phoneVerificationCodes,
);
export const insertBannedPhoneNumberSchema =
  createInsertSchema(bannedPhoneNumbers);
export const selectBannedPhoneNumberSchema =
  createSelectSchema(bannedPhoneNumbers);
export const insertUserActivityLogSchema = createInsertSchema(userActivityLogs);
export const selectUserActivityLogSchema = createSelectSchema(userActivityLogs);
export const insertBarStaffSchema = createInsertSchema(barStaff);
export const selectBarStaffSchema = createSelectSchema(barStaff);
export const insertKavatenderSchema = createInsertSchema(kavatenders);
export const selectKavatenderSchema = createSelectSchema(kavatenders);
export const insertBarOwnerNotificationPreferenceSchema = createInsertSchema(
  barOwnerNotificationPreferences,
);
export const selectBarOwnerNotificationPreferenceSchema = createSelectSchema(
  barOwnerNotificationPreferences,
);
export const insertNotificationSchema = createInsertSchema(notifications);
export const selectNotificationSchema = createSelectSchema(notifications);
// Add schemas for barOwnerNotifications (after existing schemas)
export const insertBarOwnerNotificationSchema = createInsertSchema(
  barOwnerNotifications,
);
export const selectBarOwnerNotificationSchema = createSelectSchema(
  barOwnerNotifications,
);
