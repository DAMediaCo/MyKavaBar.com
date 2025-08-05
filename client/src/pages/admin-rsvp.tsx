import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const events = [
  {
    id: 1,
    title: "Live Jazz Night",
    isRecurring: true,
    weekday: "Friday",
    rsvps: { yes: 32, maybe: 12, no: 4 },
  },
  {
    id: 2,
    title: "Karaoke Evening",
    isRecurring: false,
    date: "2025-08-10",
    rsvps: { yes: 18, maybe: 7, no: 2 },
  },
];

export default function EventsPage() {
  return (
    <main className="p-4 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">RSVP Overview</h1>

      {events.map((event) => (
        <Card key={event.id}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>{event.title}</span>
              <Badge variant="outline" className="text-xs">
                {event.isRecurring ? "Recurring" : "Fixed Date"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-between items-center text-sm text-muted-foreground">
            <div>
              {event.isRecurring ? (
                <p>
                  Occurs every <strong>{event.weekday}</strong>
                </p>
              ) : (
                <p>
                  Date:{" "}
                  <strong>{new Date(event.date!).toLocaleDateString()}</strong>
                </p>
              )}
            </div>
            <div className="flex gap-4">
              <span>✅ Yes: {event.rsvps.yes}</span>
              <span>🤔 Maybe: {event.rsvps.maybe}</span>
              <span>❌ No: {event.rsvps.no}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
