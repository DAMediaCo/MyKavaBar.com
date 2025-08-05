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

// Returns the next occurrence (Date object) of a given day of the week and time string ("HH:MM:SS")
function getNextOccurrence(dayOfWeek: number, time: string): Date {
  const [hour, minute, second] = time.split(":").map(Number);
  const now = new Date();
  const result = new Date(now);

  result.setHours(hour, minute, second, 0);

  const currentDay = now.getDay();
  const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
  if (daysToAdd === 0 && result <= now) {
    result.setDate(result.getDate() + 7);
  } else {
    result.setDate(result.getDate() + daysToAdd);
  }

  return result;
}

export function EventRsvpTab({ barId }: { barId: number }) {
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

  const now = new Date();
  const events = data?.data ?? [];

  const futureEvents = events.filter((e: any) => {
    const schedule = e.schedule;
    if (schedule.type === "recurring") {
      const next = getNextOccurrence(
        schedule.dayOfWeek,
        schedule.time.split(" - ")[0],
      );
      e.displayDate = next;
      return next >= now;
    } else {
      const date = new Date(
        `${schedule.date}T${schedule.time.split(" - ")[0]}`,
      );
      e.displayDate = date;
      return date >= now;
    }
  });

  const pastEvents = events.filter((e: any) => {
    const schedule = e.schedule;
    if (schedule.type === "recurring") {
      const next = getNextOccurrence(
        schedule.dayOfWeek,
        schedule.time.split(" - ")[0],
      );
      e.displayDate = next;
      return next < now;
    } else {
      const date = new Date(
        `${schedule.date}T${schedule.time.split(" - ")[0]}`,
      );
      e.displayDate = date;
      return date < now;
    }
  });

  const renderEvents = (events: any[]) =>
    events.map((event) => {
      const { title, isRecurring, schedule, rsvps, displayDate } = event;
      const activeCount = rsvps?.activeCount ?? 0;
      const inactiveCount = rsvps?.inactiveCount ?? 0;

      return (
        <Card key={event.eventId}>
          <CardContent className="p-4 space-y-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            {isRecurring
              ? `${daysOfWeek[schedule.dayOfWeek]}, ${formatTimeRange24To12(schedule.time)} (${displayDate.toLocaleDateString()})`
              : `${new Date(
                  `${schedule.date}T${schedule.time.split(" - ")[0]}`,
                ).toLocaleString([], {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })} (${formatTimeRange24To12(schedule.time)})`}

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
        <Tabs defaultValue="future" className="w-full">
          <TabsList>
            <TabsTrigger value="future">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="future">
            <div className="space-y-4 mt-4">
              {futureEvents.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  No upcoming events.
                </p>
              ) : (
                renderEvents(futureEvents)
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
