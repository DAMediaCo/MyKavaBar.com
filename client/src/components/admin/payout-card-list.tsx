import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PayoutCard } from "./payout-card";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

type UserPayout = {
  id: number;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  totalEarned: number;
  alreadyPaid: number;

  email?: string;
  pending?: number;
};

export const PayoutCardList = () => {
  const [users, setUsers] = useState<UserPayout[]>([]);
  const [loadingIds, setLoadingIds] = useState<number[]>([]);
  const { toast } = useToast();

  // Fetch payout data
  useEffect(() => {
    const fetchPayouts = async () => {
      try {
        const res = await fetch("/api/admin/payouts/eligible", {
          credentials: "include",
        });

        if (!res.ok) throw new Error("Failed to fetch payouts");

        const data = await res.json();

        setUsers(
          data.data.map((u: any) => ({
            ...u,
            totalEarned: Number(u.totalEarned ?? 0),
            alreadyPaid: Number(u.alreadyPaid ?? 0),
            pending: Number(u.pending ?? 0),
          })),
        );
      } catch (error) {
        console.error("Error fetching payouts:", error);
      }
    };

    fetchPayouts();
  }, []);

  // Handle payout button click
  const handlePayout = async (userId: number) => {
    try {
      setLoadingIds((prev) => [...prev, userId]);

      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) throw new Error("Failed to mark payout");
      toast({
        title: "Success",
        description: "Amount paid",
      });
      // Update the user's alreadyPaid value in the state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? { ...user, alreadyPaid: user.alreadyPaid + 50 }
            : user,
        ),
      );
    } catch (error) {
      console.error("Error processing payout:", error);
    } finally {
      setLoadingIds((prev) => prev.filter((id) => id !== userId));
    }
  };

  return (
    <Card className="max-w-6xl mx-auto rounded-2xl shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl">Referral Earnings & Payouts</CardTitle>
        <CardDescription className="text-base">
          Manage user referral payouts and track earnings.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ScrollArea className="max-h-[700px] pr-2">
          <div className="grid grid-cols-1 gap-6">
            {users.length > 0 &&
              users.map((user) => (
                <PayoutCard
                  key={user.id}
                  {...user}
                  onPayout={handlePayout}
                  disabled={loadingIds.includes(user.id)}
                />
              ))}
            {users.length === 0 && (
              <h1 className="text-center text-xl mt-5  mb-3 font-medium">
                No payout list found
              </h1>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
