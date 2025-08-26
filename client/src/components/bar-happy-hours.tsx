"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

// Format slot string
const slotToString = (slot: HappyHourSlot) =>
  `${slot.start} ${slot.startPeriod} - ${slot.end} ${slot.endPeriod}`;

// Format day range as "Sun - Thurs" if consecutive, else "Sun, Tue"
const formatDayRange = (days: string[]) => {
  if (days.length === 1) return days[0].slice(0, 3);

  const indexes = days
    .map((day) => daysOfWeek.indexOf(day))
    .sort((a, b) => a - b);

  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] !== indexes[i - 1] + 1) {
      return indexes.map((i) => daysOfWeek[i].slice(0, 3)).join(", ");
    }
  }

  return `${daysOfWeek[indexes[0]].slice(0, 3)} - ${daysOfWeek[
    indexes[indexes.length - 1]
  ].slice(0, 3)}`;
};

export const BarHappyHours = ({ barId }: { barId: number }) => {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["happyHours", barId],
    queryFn: async (): Promise<HappyHoursResponse> => {
      const res = await fetch(`/api/bar/${barId}/happy-hours`);
      if (!res.ok) throw new Error("Failed to fetch happy hours");
      return res.json();
    },
  });

  const groupedSchedules = useMemo(() => {
    if (!data?.happyHours) return [];

    const map = new Map<string, string[]>();

    daysOfWeek.forEach((day) => {
      const slots = data.happyHours?.[day] ?? [];
      slots.forEach((slot) => {
        if (!slot.start || !slot.end) return;
        const slotStr = slotToString(slot);
        if (!map.has(slotStr)) map.set(slotStr, []);
        map.get(slotStr)!.push(day);
      });
    });

    // Sort days inside each slot group
    return Array.from(map.entries()).map(([slotStr, days]) => {
      const sortedDays = days.sort(
        (a, b) => daysOfWeek.indexOf(a) - daysOfWeek.indexOf(b),
      );
      return { slotStr, days: sortedDays };
    });
  }, [data]);

  if (isLoading) return <div>Loading happy hours...</div>;
  if (error)
    return <div className="text-red-600">Error loading happy hours</div>;
  if (!data || groupedSchedules.length === 0)
    return <div>No happy hours available.</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bar Happy Hours</CardTitle>
      </CardHeader>
      <CardContent>
        {(expanded ? groupedSchedules : groupedSchedules.slice(0, 3)).map(
          ({ days, slotStr }, idx) => (
            <section key={idx} className="mb-6">
              <h3 className="text-lg font-semibold mb-1">
                {formatDayRange(days)}
              </h3>
              <p>{slotStr}</p>
            </section>
          ),
        )}
        {groupedSchedules.length > 3 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show Less" : "View More"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
