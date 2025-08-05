import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const fetchReward = async (): Promise<number> => {
  const res = await fetch("/api/admin/referral-reward", {
    credentials: "include", // ✅ to send cookies/session info
  });
  if (!res.ok) throw new Error("Failed to fetch referral reward");
  const data = await res.json();
  return parseFloat(data.reward); // ensure it's treated as number
};

const saveReward = async (reward: number): Promise<boolean> => {
  const res = await fetch("/api/admin/referral-reward", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ reward }),
  });

  if (!res.ok) throw new Error("Failed to update referral reward");
  return true;
};

// ✅ Zod validation schema
const rewardSchema = z.object({
  reward: z.coerce
    .number({ invalid_type_error: "Reward must be a number" })
    .min(0, "Reward must be at least $0.00")
    .max(100, "Reward can't exceed $100.00"),
});

type RewardFormData = z.infer<typeof rewardSchema>;

export const ReferralRewardEditor = () => {
  const { toast } = useToast();

  const form = useForm<RewardFormData>({
    resolver: zodResolver(rewardSchema),
    defaultValues: {
      reward: 3.0,
    },
  });

  useEffect(() => {
    fetchReward().then((r) => {
      form.setValue("reward", r);
    });
  }, [form]);

  async function onSubmit(data: RewardFormData) {
    const success = await saveReward(data.reward);
    if (success) {
      toast({
        title: "Referral reward updated",
        description: `New reward is set to $${data.reward.toFixed(2)}`,
      });
    }
  }

  return (
    <>
      <h1 className="text-xl mb-6 md:text-3xl text-center font-semibold">
        Update the Reward for referrals
      </h1>
      <div className="mb-10 flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border shadow-md dark:border-zinc-700">
          <CardHeader>
            <CardTitle>Referral Reward</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="reward"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reward per referral ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!!form.formState.isSubmitting}
                >
                  Update Reward
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
