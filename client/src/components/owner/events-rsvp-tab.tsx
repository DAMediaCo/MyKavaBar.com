import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTimeRange24To12(timeRange: string): string {
  const [start, end] = timeRange.split(" - ");
  const to12 = (t: string) =>
    new Date(`1970-01-01T${t}`).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  return `${to12(start)} - ${to12(end)}`;
}

function formatDateMMDDYYYY(date: Date): string {
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// Parse ISO date string "YYYY-MM-DD" as local date ignoring timezone shifts
function parseDateAsLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function EventRsvpTab({ barId }: { barId: number }) {
  const [tabValue, setTabValue] = useState<"upcoming" | "past">("upcoming");

  const { data, isLoading, error } = useQuery({
    queryKey: ["bar-rsvp-stats", barId],
    queryFn: async () => {
      const res = await fetch(`/api/bar/${barId}/rsvp-stats`);
      if (!res.ok) throw new Error("Failed to fetch RSVP stats");
      return res.json();
    },
  });

  if (isLoading)
    return (
      <Card>
        <CardContent className="p-4 text-center text-muted-foreground">
          Loading RSVP stats...
        </CardContent>
      </Card>
    );

  if (error)
    return (
      <Card>
        <CardContent className="p-4 text-center text-red-500">
          Failed to load RSVP stats.
        </CardContent>
      </Card>
    );

  // Use backend-provided arrays directly
  const pastEvents = data?.data?.past ?? [];
  const upcomingEvents = data?.data?.upcoming ?? [];

  const renderEvents = (events: any[]) =>
    events.map((event) => {
      const { title, isRecurring, schedule, rsvps } = event;
      const activeCount = rsvps?.activeCount ?? 0;
      const inactiveCount = rsvps?.inactiveCount ?? 0;

      const displayDateStr =
        schedule && (schedule.specificDate || schedule.date)
          ? schedule.specificDate || schedule.date
          : "";
      const displayDate = displayDateStr
        ? parseDateAsLocalDate(displayDateStr)
        : null;

      return (
        <Card key={event.eventId}>
          <CardContent className="p-4 space-y-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            {isRecurring && displayDate ? (
              <>
                {daysOfWeek[schedule.dayOfWeek]},{" "}
                {formatTimeRange24To12(schedule.time)} (
                {formatDateMMDDYYYY(displayDate)})
              </>
            ) : displayDate ? (
              <>
                {formatDateMMDDYYYY(displayDate)} (
                {formatTimeRange24To12(schedule.time)})
              </>
            ) : (
              "--"
            )}
            <div className="flex gap-4 pt-2">
              <span className="text-green-600 text-sm">✅ {activeCount}</span>
              <span className="text-gray-500 text-sm">❌ {inactiveCount}</span>
            </div>
          </CardContent>
        </Card>
      );
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event RSVP Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={tabValue}
          onValueChange={(value) => setTabValue(value as "upcoming" | "past")}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <div className="space-y-4 mt-4">
              {upcomingEvents.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  No upcoming events.
                </p>
              ) : (
                renderEvents(upcomingEvents)
              )}
            </div>
          </TabsContent>

          <TabsContent value="past">
            <div className="space-y-4 mt-4">
              {pastEvents.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  No past events.
                </p>
              ) : (
                renderEvents(pastEvents)
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
