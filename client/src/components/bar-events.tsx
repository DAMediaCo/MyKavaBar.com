import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ChevronDown } from "lucide-react";
import { RsvpButton } from "@/components/rsvp-button";
import { format, addDays, isWithinInterval, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { BarEvent } from "@db/schema";
import { EventForm, EventFormValues } from "./event-form";

interface BarEventsProps {
  barId: number;
  ownerId: number | null;
  address: string;
}

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  endTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  isRecurring: z.boolean().default(true),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

function QuickEventForm({
  barId,
  onSuccess,
}: {
  barId: number;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      dayOfWeek: new Date().getDay(),
      startTime: "18:00",
      endTime: "22:00",
      isRecurring: true,
    },
  });

  const createEvent = useMutation({
    mutationFn: async (data: EventFormData) => {
      const res = await fetch(`/api/bars/${barId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/bars/${barId}/events`],
      });
      toast({
        title: "Event Created",
        description: "Your event has been successfully created.",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create event",
      });
    },
  });

  const onSubmit = (data: EventFormData) => {
    createEvent.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Event Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createEvent.isPending}
        >
          {createEvent.isPending ? "Creating..." : "Create Event"}
        </Button>
      </form>
    </Form>
  );
}

export default function BarEvents({ barId, ownerId, address }: BarEventsProps) {
  const { user } = useUser();
  const id = barId;
  const { toast } = useToast();
  const isOwner = user?.id === ownerId;
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery<BarEvent[]>({
    queryKey: [`/api/bars/${barId}/events`],
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormValues) => {
      const response = await fetch(`/api/bars/${id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create event");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      queryClient.invalidateQueries([`/api/bars/${id}/events`]);
      setIsAddEventOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Function to format the day key
  const formatDay = (dayOfWeek: number) => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return days[dayOfWeek] || "";
  };

  // Function to format date strings without timezone issues
  const formatDateString = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-").map((num) => parseInt(num));
      const date = new Date(year, month - 1, day);
      return format(date, "MMM d, yyyy");
    } catch (error) {
      console.error("Error formatting date:", error, dateStr);
      return dateStr || "Invalid date";
    }
  };

  // Get event date display for the square
  const getEventDateDisplay = (event: BarEvent) => {
    if (event.isRecurring) {
      return formatDay(event.dayOfWeek).slice(0, 3).toUpperCase();
    } else {
      if (event.startDate) {
        const [year, month, day] = event.startDate
          .split("-")
          .map((num) => parseInt(num));
        const date = new Date(year, month - 1, day);
        return format(date, "dd MMM").toUpperCase();
      }
      return "NO DATE";
    }
  };

  // Calculate next event date for calendar
  const getNextEventDate = (event: BarEvent): Date => {
    const today = new Date();

    if (event.isRecurring) {
      const targetDay = event.dayOfWeek;
      const todayDay = today.getDay();

      let daysToAdd = targetDay - todayDay;
      if (daysToAdd <= 0) {
        daysToAdd += 7;
      }

      return addDays(today, daysToAdd);
    } else {
      // For non-recurring events, find the next occurrence of dayOfWeek within the date range
      if (event.startDate && event.endDate) {
        const startDate = parseISO(event.startDate);
        const endDate = parseISO(event.endDate);
        const targetDay = event.dayOfWeek;

        // If today is within the range and matches the day of week, return today
        if (
          isWithinInterval(today, { start: startDate, end: endDate }) &&
          today.getDay() === targetDay
        ) {
          return today;
        }

        // Find the next occurrence of the target day within the range
        let currentDate = today > startDate ? today : startDate;

        // Look for the target day within the date range
        while (currentDate <= endDate) {
          if (currentDate.getDay() === targetDay && currentDate >= today) {
            return currentDate;
          }
          currentDate = addDays(currentDate, 1);
        }

        // If no matching day found in future, find the first occurrence from start date
        currentDate = startDate;
        while (currentDate <= endDate) {
          if (currentDate.getDay() === targetDay) {
            return currentDate;
          }
          currentDate = addDays(currentDate, 1);
        }

        // Fallback to start date if no matching day found
        return startDate;
      }

      return today;
    }
  };

  // Handle add to Google Calendar
  const handleAddToGoogleCalendar = (event: BarEvent) => {
    const eventDate = getNextEventDate(event);
    const [hours, minutes] = event.startTime.split(":").map(Number);
    const eventDateTime = new Date(eventDate);
    eventDateTime.setHours(hours, minutes, 0, 0);

    const [endHours, endMinutes] = event.endTime.split(":").map(Number);
    const endDateTime = new Date(eventDate);
    endDateTime.setHours(endHours, endMinutes, 0, 0);

    if (endDateTime <= eventDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    const formatGoogleDate = (date: Date): string => {
      return date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    };

    const startDateFormatted = formatGoogleDate(eventDateTime);
    const endDateFormatted = formatGoogleDate(endDateTime);

    const googleCalendarUrl = new URL("https://www.google.com/calendar/event");
    googleCalendarUrl.searchParams.set("action", "TEMPLATE");
    googleCalendarUrl.searchParams.set("text", event.title);
    googleCalendarUrl.searchParams.set(
      "dates",
      `${startDateFormatted}/${endDateFormatted}`,
    );
    googleCalendarUrl.searchParams.set("details", event.description || "");
    googleCalendarUrl.searchParams.set("location", address);

    window.open(googleCalendarUrl.toString(), "_blank");

    toast({
      title: "Opening Google Calendar",
      description: `${event.title} scheduled for ${format(eventDateTime, "PPP 'at' p")}`,
    });
  };

  // Handle add to Apple Calendar (download .ics file)
  const handleAddToAppleCalendar = (event: BarEvent) => {
    const eventDate = getNextEventDate(event);
    const [hours, minutes] = event.startTime.split(":").map(Number);
    const eventDateTime = new Date(eventDate);
    eventDateTime.setHours(hours, minutes, 0, 0);

    const [endHours, endMinutes] = event.endTime.split(":").map(Number);
    const endDateTime = new Date(eventDate);
    endDateTime.setHours(endHours, endMinutes, 0, 0);

    if (endDateTime <= eventDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    const formatICSDate = (date: Date): string => {
      return date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    };

    const startDateFormatted = formatICSDate(eventDateTime);
    const endDateFormatted = formatICSDate(endDateTime);
    const now = formatICSDate(new Date());

    // Generate a unique UID for the event
    const uid = `${event.id}-${Date.now()}@bar-events.com`;

    // Create .ics file content
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MyKavaBar LLC//MyKavabar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${startDateFormatted}`,
      `DTEND:${endDateFormatted}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || ""}`,
      `LOCATION:${address}`,
      "STATUS:CONFIRMED",
      "SEQUENCE:0",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    // Create and download the .ics file
    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Calendar Event Downloaded",
      description: `${event.title} saved as .ics file for ${format(eventDateTime, "PPP 'at' p")}`,
    });
  };

  // Get event color
  const getEventColor = (index: number) => {
    const colors = [
      "bg-gradient-to-br from-blue-400 to-blue-500",
      "bg-gradient-to-br from-emerald-400 to-emerald-500",
      "bg-gradient-to-br from-purple-400 to-purple-500",
      "bg-gradient-to-br from-amber-400 to-amber-500",
      "bg-gradient-to-br from-rose-400 to-rose-500",
      "bg-gradient-to-br from-indigo-400 to-indigo-500",
      "bg-gradient-to-br from-teal-400 to-teal-500",
      "bg-gradient-to-br from-orange-400 to-orange-500",
    ];
    return colors[index % colors.length];
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded" />
            <div className="h-8 bg-muted rounded" />
            <div className="h-8 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  function handleCreateEvent(data: EventFormValues) {
    createEventMutation.mutate(data, {
      onSuccess: () => {
        setIsAddEventOpen(false);
      },
    });
  }

  const recurringEvents = events?.filter((event) => event.isRecurring) || [];
  const oneTimeEvents = events?.filter((event) => !event.isRecurring) || [];
  const allEvents = [...recurringEvents, ...oneTimeEvents];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Events
          </CardTitle>
          {isOwner && (
            <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddEventOpen(true)}
                  className="w-full sm:w-auto"
                >
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent className="mx-4 max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Event</DialogTitle>
                </DialogHeader>
                <EventForm
                  onSubmit={handleCreateEvent}
                  isSubmitting={createEventMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {allEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events scheduled</p>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {allEvents.map((event, index) => (
              <div
                key={event.id}
                className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg"
              >
                {/* Date/Time Square - Mobile optimized */}
                <div
                  className={`flex-shrink-0 w-full sm:w-20 h-16 sm:h-20 ${getEventColor(index)} rounded-lg flex flex-row sm:flex-col items-center justify-center text-center shadow-lg`}
                >
                  <div className="flex-1 sm:flex-none">
                    <div className="text-sm sm:text-xs font-semibold text-white">
                      {getEventDateDisplay(event)}
                    </div>
                  </div>
                  <div className="flex-1 sm:flex-none sm:mt-1">
                    <div className="text-xs text-white/90">
                      {format(
                        new Date(`1970-01-01T${event.startTime}`),
                        "h:mm a",
                      )}
                    </div>
                    <div className="text-xs text-white/90">
                      {format(
                        new Date(`1970-01-01T${event.endTime}`),
                        "h:mm a",
                      )}
                    </div>
                  </div>
                </div>

                {/* Event Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground break-words">
                        {event.title}
                      </h4>
                      {event.description && (
                        <>
                          <p className="text-sm text-muted-foreground mt-1  whitespace-pre-line line-clamp-3 ">
                            {event.description}
                          </p>

                          {event.description.length > 100 && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <button className="text-black dark:text-white font-medium text-md">
                                  View more
                                </button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Event Description</DialogTitle>
                                </DialogHeader>
                                <div className="whitespace-pre-line text-sm text-muted-foreground mt-2">
                                  {event.description}
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </>
                      )}

                      <p className="text-md text-black dark:text-white font-medium mt-2 break-words">
                        {event.isRecurring
                          ? `Next: ${format(getNextEventDate(event), "MM/dd/yy")}`
                          : `${formatDateString(event.startDate || "")} to ${formatDateString(event.endDate || "")}`}
                      </p>
                    </div>
                    <div className="w-full sm:w-auto sm:flex-shrink-0 sm:mt-0 flex flex-col gap-2">
                      <RsvpButton user={user} event={event} barId={barId} />

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto"
                          >
                            <Calendar className="h-4 w-4 sm:hidden mr-2" />
                            Add to Calendar
                            <ChevronDown className="h-4 w-4 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            onClick={() => handleAddToGoogleCalendar(event)}
                          >
                            <svg
                              className="h-4 w-4 mr-2"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                              />
                              <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                              />
                              <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                              />
                              <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                              />
                            </svg>
                            Google Calendar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleAddToAppleCalendar(event)}
                          >
                            <svg
                              className="h-4 w-4 mr-2"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                            </svg>
                            Apple Calendar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
