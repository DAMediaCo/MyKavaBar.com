import * as z from "zod";

export const updateRewardSchema = z.object({
  reward: z.coerce
    .number({ invalid_type_error: "Reward must be a number" })
    .min(0, "Reward must be at least $0.00")
    .max(100, "Reward can't exceed $100.00"),
});
