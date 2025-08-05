import { db } from "../../db/index";
import {
  users,
  referrals,
  payouts,
  referralAmount,
  kavatenderReferralProfiles,
} from "../../db/schema";
import { eq, sum } from "drizzle-orm";

// Admin referrals functions
export async function getReferralAmount() {
  const result = await db.select().from(referralAmount).limit(1);
  return result[0]?.reward || 3;
}

// Get total paid amount for a user
export async function getTotalPaid(userId: number) {
  const result = await db
    .select({ total: sum(payouts.amount).as("paid") })
    .from(payouts)
    .where(eq(payouts.userId, userId));

  return result[0]?.total ?? 0;
}

export async function getReferralStatsForAllUsers() {
  const allUsers = await db.select().from(users);
  const results = await Promise.all(
    allUsers.map(async (user) => {
      const paid = await getTotalPaid(user.id);

      const referralEarnings = parseFloat(user.referralEarnings as string);
      const pending = referralEarnings - paid;

      return {
        id: user.id,
        username: user.username,
        referralEarnings,
        paid,
        pending,
      };
    }),
  );

  return results;
}

// Get single user referral payout stats
export async function getReferralStatsForUser(userId: number) {
  const user = await db
    .select({
      id: users.id,
      username: users.username,
      referralEarnings: users.referralEarnings,
    })
    .from(users)
    .where(eq(users.id, userId))
    .then((res) => res[0]);

  if (!user) return null;

  const paid = await getTotalPaid(userId);
  const pending = user.referralEarnings - Number(paid);

  return {
    ...user,
    totalEarned: user.referralEarnings,
    alreadyPaid: paid,
    pending,
  };
}

// Get users eligible for payout
export async function getUsersEligibleForPayout(minAmount = 5000) {
  const all = await getReferralStatsForAllUsers();
  return all.filter((u) => u.pending >= minAmount);
}

export async function getUserReferralDetails(userId: number) {
  // 1. Get the referral profile of the user (e.g., earnings + code)
  const profile = await db
    .select({
      earnings: kavatenderReferralProfiles.totalEarnings,
    })
    .from(kavatenderReferralProfiles)
    .where(eq(kavatenderReferralProfiles.userId, userId))
    .then((res) => res[0]);

  if (!profile) {
    return {
      referrals: [],
      earnings: 0,
    };
  }

  // 2. Fetch referred users (who signed up with this user’s referral code)
  const referred = await db
    .select({
      username: users.username,
      referredAt: referrals.createdAt,
    })
    .from(referrals)
    .innerJoin(users, eq(referrals.refereeId, users.id))
    .where(eq(referrals.referrerId, userId));

  return {
    referrals: referred,
    earnings: parseFloat(profile.earnings).toFixed(2),
  };
}
