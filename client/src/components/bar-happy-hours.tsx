"use client";
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  const [expanded, setExpanded] = useState(false);
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
  const otherDaysWithSlots = Object.keys(schedules).filter(
    (d) => d !== todayDay,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bar Happy Hours</CardTitle>
      </CardHeader>
      <CardContent>
        {!expanded ? (
          <>
            {todaySlots.length > 0 ? (
              <div className="mb-2 font-semibold">{todayDay}</div>
            ) : (
              <p>No happy hours today</p>
            )}
            <div className="flex flex-wrap gap-2 items-center mb-4">
              {todaySlots.map((slot, idx) => (
                <Badge
                  key={`${todayDay}-${idx}`}
                  variant="secondary"
                  className="cursor-default"
                >
                  {slot}
                </Badge>
              ))}
              {otherDaysWithSlots.length > 0 && (
                <Button
                  onClick={() => setExpanded(true)}
                  variant="outline"
                  size="sm"
                  className="ml-2"
                >
                  View More
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            {daysOfWeek.map((day) => {
              const slots = schedules[day] ?? [];
              if (slots.length === 0) return null;
              return (
                <section key={day} className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">{day}</h3>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot, idx) => (
                      <Badge
                        key={`${day}-expanded-${idx}`}
                        variant="secondary"
                        className="cursor-default"
                      >
                        {slot}
                      </Badge>
                    ))}
                  </div>
                </section>
              );
            })}
            <Button
              onClick={() => setExpanded(false)}
              variant="outline"
              size="sm"
            >
              Show Less
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
