// drizzle/seedReferralCodes.ts
import { db } from "../../db/index";
import { kavatenderReferralProfiles, referrals } from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getReferralAmount } from "./referrals";

export const generateReadableCode = (length = 6): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Readable characters
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const generateUniqueReferralCode = async (): Promise<string> => {
  let unique = false;
  let code = "";

  while (!unique) {
    const random = generateReadableCode(6);
    code = `K-${random}`;

    const existing = await db
      .select()
      .from(kavatenderReferralProfiles)
      .where(eq(kavatenderReferralProfiles.referralCode, code));
    if (existing.length === 0) {
      unique = true;
    }
  }
  return code;
};

export const createReferral = async (
  referralCode: string,
  refereeId: number,
) => {
  try {
    // 1. Find the kavatender who owns this referral code
    const referrerProfile = await db
      .select({ userId: kavatenderReferralProfiles.userId })
      .from(kavatenderReferralProfiles)
      .where(eq(kavatenderReferralProfiles.referralCode, referralCode))
      .then((res) => res[0]);

    if (!referrerProfile) {
      throw new Error("Invalid referral code.");
    }

    const referrerId = referrerProfile.userId;

    // 2. Prevent self-referral
    if (referrerId === refereeId) {
      throw new Error("Users cannot refer themselves.");
    }

    // 3. Check if referral already exists
    const existing = await db
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerId, referrerId),
          eq(referrals.refereeId, refereeId),
        ),
      );

    if (existing.length > 0) {
      throw new Error("Referral already exists.");
    }

    // 4. Create the referral
    await db.insert(referrals).values({
      referrerId,
      refereeId,
    });

    // 5. Increment total earnings in the kavatenderReferralProfiles table
    const referAmount = await getReferralAmount(); // returns amount in paise
    await db
      .update(kavatenderReferralProfiles)
      .set({
        totalEarnings: sql`${kavatenderReferralProfiles.totalEarnings} + ${referAmount}`,
      })
      .where(eq(kavatenderReferralProfiles.userId, referrerId));

    console.log(
      `Referral created: Referrer=${referrerId}, Referee=${refereeId}`,
    );
  } catch (error: any) {
    console.error("Error while creating referral:", error.message);
    throw error;
  }
};
