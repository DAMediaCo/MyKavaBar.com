// drizzle/seedReferralCodes.ts
import { db } from "../../db/index"; // your drizzle db connection
import { users, kavatenderReferralProfiles } from "../../db/schema"; // your drizzle schema
import { generateUniqueReferralCode } from "../utils/generate-referralcode";
import { eq } from "drizzle-orm";
// Seed only kavatenders who don’t already have referral profiles
const seedReferralCodes = async () => {
  // 1. Get all kavatenders
  const kavatenders = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(eq(users.role, "kavatender"));

  for (const user of kavatenders) {
    // Check if already seeded
    const existing = await db
      .select()
      .from(kavatenderReferralProfiles)
      .where(eq(kavatenderReferralProfiles.userId, user.id));

    if (existing.length === 0) {
      const referralCode = await generateUniqueReferralCode();

      await db.insert(kavatenderReferralProfiles).values({
        userId: user.id,
        referralCode,
        totalEarnings: 0, // initialize with 0
      });

      console.log(
        `✅ Created referral profile for user ${user.id} with code ${referralCode}`,
      );
    }
  }

  console.log("🎉 Referral profile seeding completed.");
};

seedReferralCodes().catch((e) => {
  console.error("❌ Error while seeding referral codes:", e);
  process.exit(1);
});
