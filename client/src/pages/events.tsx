import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useUser } from "@/hooks/use-user";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RsvpButton } from "@/components/rsvp-button";
import { Calendar, MapPin, Clock, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTimeTo12Hour(time: string): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function getNextOccurrence(dayOfWeek: number): Date {
  const today = new Date();
  const currentDay = today.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  return nextDate;
}

interface Event {
  id: number;
  barId: number;
  barName: string;
  title: string;
  description: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  startDate: string | null;
  endDate: string | null;
  photoUrl: string | null;
  isRsvped?: boolean;
}

export default function EventsPage() {
  const { user } = useUser();

  const { data: eventsData, isLoading } = useQuery<{ events: Event[] }>({
    queryKey: ["/api/events"],
    queryFn: () => fetchApi<{ events: Event[] }>("/api/events"),
  });

  const events = eventsData?.events || [];

  // Sort events by next occurrence
  const sortedEvents = [...events].sort((a, b) => {
    const aDate = a.isRecurring
      ? getNextOccurrence(a.dayOfWeek)
      : parseISO(a.startDate || new Date().toISOString());
    const bDate = b.isRecurring
      ? getNextOccurrence(b.dayOfWeek)
      : parseISO(b.startDate || new Date().toISOString());
    return aDate.getTime() - bDate.getTime();
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] text-gray-200 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="h-12 w-12 text-[#D35400] mx-auto mb-4 animate-pulse" />
          <p className="text-lg">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-gray-200">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-8 w-8 text-[#D35400]" />
            <h1 className="text-3xl font-bold text-white">Upcoming Events</h1>
          </div>
          <p className="text-gray-400">
            Discover events happening at kava bars near you
          </p>
        </div>

        {/* Events List */}
        {sortedEvents.length === 0 ? (
          <Card className="bg-[#1E1E1E] border-[#333] p-8 text-center">
            <Calendar className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              No Upcoming Events
            </h3>
            <p className="text-gray-400">
              Check back soon for new events at kava bars!
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedEvents.map((event) => {
              const nextDate = event.isRecurring
                ? getNextOccurrence(event.dayOfWeek)
                : parseISO(event.startDate || new Date().toISOString());
              const formattedDate = format(nextDate, "MMMM d, yyyy");
              const dayName = daysOfWeek[event.dayOfWeek];

              return (
                <Card
                  key={event.id}
                  className="bg-[#1E1E1E] border-[#333] overflow-hidden hover:border-[#D35400] transition-colors"
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Event Photo */}
                    {event.photoUrl && (
                      <div className="md:w-1/3 h-48 md:h-auto">
                        <img
                          src={event.photoUrl}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Event Details */}
                    <div className={`flex-1 p-6 ${event.photoUrl ? "" : "w-full"}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-2">
                            {event.title}
                          </h3>

                          {/* Bar Name */}
                          <Link href={`/kava-bars/${event.barId}`}>
                            <a className="inline-flex items-center gap-2 text-[#D35400] hover:text-[#E67E22] transition-colors mb-3">
                              <MapPin className="h-4 w-4" />
                              <span className="font-medium">{event.barName}</span>
                              <ChevronRight className="h-4 w-4" />
                            </a>
                          </Link>

                          {/* Date & Time */}
                          <div className="flex flex-col gap-2 mb-3">
                            <div className="flex items-center gap-2 text-gray-300">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {event.isRecurring ? (
                                <span>
                                  Every {dayName} • Next: {formattedDate}
                                </span>
                              ) : (
                                <span>{formattedDate}</span>
                              )}
                              {event.isRecurring && (
                                <Badge variant="outline" className="ml-2 border-[#D35400] text-[#D35400]">
                                  Recurring
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-gray-300">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span>
                                {formatTimeTo12Hour(event.startTime)} - {formatTimeTo12Hour(event.endTime)}
                              </span>
                            </div>
                          </div>

                          {/* Description */}
                          {event.description && (
                            <p className="text-gray-400 text-sm line-clamp-3 mb-4">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* RSVP Button */}
                      <div className="flex gap-2">
                        <RsvpButton
                          user={user}
                          event={{
                            id: event.id,
                            title: event.title,
                            isRsvped: event.isRsvped,
                          }}
                          barId={event.barId}
                        />
                        <Link href={`/kava-bars/${event.barId}`}>
                          <Button
                            variant="outline"
                            className="border-[#333] text-gray-300 hover:bg-[#252525]"
                          >
                            View Bar
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
