import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-user";
import moment from "moment-timezone";

type CheckIn = {
  id: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

export default function KavatenderCheckin({ barId }: { barId: number }) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [endTime, setEndTime] = useState("");

  const { data: currentCheckIn } = useQuery<CheckIn>({
    queryKey: ["checkIn", barId, user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/bars/${barId}/check-in/${user?.id}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled:
      !!user?.id &&
      (user?.role === "kavatender" ||
        user?.role === "admin" ||
        user?.role === "bar_owner"),
  });

  console.log("Current checkins ", currentCheckIn);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/bars/${barId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endTime }),
      });
      if (!response.ok) {
        throw new Error("Failed to check in");
      }
      console.log("Endtime: ", endTime);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkIn", barId, user?.id] });
      queryClient.invalidateQueries({ queryKey: [`checkIns/${barId}`] });
      toast({ title: "Checked in successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to check in. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (
    !user ||
    (user.role !== "kavatender" &&
      user.role !== "admin" &&
      user.role !== "bar_owner")
  ) {
    return null;
  }

  if (currentCheckIn?.isActive) {
    return (
      <div className="bg-secondary p-4 rounded-lg">
        <p className="font-medium">Currently checked in</p>
        <p className="text-sm text-muted-foreground">
          Until{" "}
          {format(
            moment.tz(currentCheckIn.endTime, "America/New_York").toDate(),
            "h:mm a",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="endTime" className="text-sm font-medium">
          Shift End Time
        </label>
        <Input
          id="endTime"
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          min={new Date().toISOString().slice(0, 16)}
        />
      </div>
      <Button
        onClick={() => checkInMutation.mutate()}
        disabled={!endTime || checkInMutation.isPending}
      >
        Check In
      </Button>
    </div>
  );
}
