"use client";
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type HappyHourSlot = {
  start: string;
  startPeriod: "AM" | "PM";
  end: string;
  endPeriod: "AM" | "PM";
};
type HappyHoursResponse = {
  happyHours: Record<string, HappyHourSlot[]>;
};

const slotToString = (slot: HappyHourSlot) =>
  `${slot.start} ${slot.startPeriod} - ${slot.end} ${slot.endPeriod}`;

export const BarHappyHours = ({ barId }: { barId: number }) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["happyHours", barId],
    queryFn: async (): Promise<HappyHoursResponse> => {
      const res = await fetch(`/api/bar/${barId}/happy-hours`);
      if (!res.ok) throw new Error("Failed to fetch happy hours");
      return res.json();
    },
  });

  const today = new Date();
  const todayDay = daysOfWeek[today.getDay()];

  // Preprocess schedules
  const schedules = useMemo(() => {
    if (!data?.happyHours) return {};

    const result: Record<string, string[]> = {};
    daysOfWeek.forEach((day) => {
      const slots = data.happyHours?.[day] ?? [];
      if (slots.length > 0) {
        result[day] = slots.map(slotToString);
      }
    });
    return result;
  }, [data]);

  if (isLoading) return <div>Loading happy hours...</div>;
  if (error)
    return <div className="text-red-600">Error loading happy hours</div>;
  if (!data || Object.keys(schedules).length === 0)
    return <div>No happy hours available.</div>;

  const todaySlots = schedules[todayDay] ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bar Happy Hours</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Show only today's hours */}
        <section className="mb-4">
          <h3 className="text-lg font-semibold mb-1">{todayDay.slice(0, 3)}</h3>
          {todaySlots.length > 0 ? (
            <p>{todaySlots.join(", ")}</p>
          ) : (
            <p>No happy hours today</p>
          )}
        </section>

        {/* Show More button if other days have slots */}
        {Object.keys(schedules).filter((d) => d !== todayDay).length > 0 && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
            >
              View More
            </Button>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base">All Happy Hours</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                {daysOfWeek.map((day) => {
                  const slots = schedules[day] ?? [];
                  if (slots.length === 0) return null;
                  return (
                    <div key={day}>
                      <span className="font-medium">{day.slice(0, 3)}:</span>{" "}
                      <span>{slots.join(", ")}</span>
                    </div>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};
