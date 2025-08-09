import { db } from "../../db/index";
import { payouts, users, kavatenderReferralProfiles } from "../../db/schema";
import { desc, eq, sum } from "drizzle-orm";

// ✅ List all payouts with user details
export async function getAllPayoutsWithUserDetails() {
  const result = await db
    .select({
      payoutId: payouts.id,
      amount: payouts.amount,
      paidAt: payouts.paidAt,
      userId: users.id,
      username: users.username,
      email: users.email,
    })
    .from(payouts)
    .innerJoin(users, eq(payouts.userId, users.id))
    .orderBy(desc(payouts.paidAt));

  return result;
}

// ✅ List users eligible for payout (based on referral profile table)
export async function getUsersEligibleForPayout() {
  // Get all kavatenders with referral profiles
  const referralProfiles = await db
    .select({
      id: kavatenderReferralProfiles.id,
      userId: kavatenderReferralProfiles.userId,
      totalEarnings: kavatenderReferralProfiles.totalEarnings,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneNumber: users.phoneNumber,
      email: users.email,
    })
    .from(kavatenderReferralProfiles)
    .innerJoin(users, eq(kavatenderReferralProfiles.userId, users.id));

  const results = await Promise.all(
    referralProfiles.map(async (profile) => {
      const totalPaid = await db
        .select({ total: sum(payouts.amount).as("paid") })
        .from(payouts)
        .where(eq(payouts.userId, profile.userId))
        .then((r) => parseFloat(r[0]?.total ?? "0"));

      const earnings = parseFloat(profile.totalEarnings?.toString() || "0");
      const pending = earnings - totalPaid;

      if (pending >= 0.01) {
        return {
          id: profile.userId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          totalEarned: earnings,
          phoneNumber: profile.phoneNumber,
          alreadyPaid: totalPaid,
          pending,
        };
      }
    }),
  );

  return results.filter(Boolean);
}

// ✅ Get total paid amount for a single user
export async function getPaidAmount(userId: number): Promise<number> {
  const result = await db
    .select({ total: sum(payouts.amount).as("total") })
    .from(payouts)
    .where(eq(payouts.userId, userId));

  return parseFloat(result[0]?.total ?? "0");
}
