import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addDays, isWithinInterval, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
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

  // Handle add to calendar
  const handleAddToCalendar = (event: BarEvent) => {
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

  // Get event color
  const getEventColor = (event: BarEvent, index: number) => {
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
        <div className="flex justify-between items-center">
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
                >
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent>
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
      <CardContent>
        {allEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events scheduled</p>
        ) : (
          <div className="space-y-4">
            {allEvents.map((event, index) => (
              <div
                key={event.id}
                className="flex items-start gap-4 p-4 border rounded-lg"
              >
                {/* Date/Time Square */}
                <div
                  className={`flex-shrink-0 w-20 h-20 ${getEventColor(event, index)} rounded-lg flex flex-col items-center justify-center text-center shadow-lg`}
                >
                  <div className="text-xs font-semibold text-white">
                    {getEventDateDisplay(event)}
                  </div>
                  <div className="text-xs text-white/90 mt-1">
                    {format(
                      new Date(`1970-01-01T${event.startTime}`),
                      "h:mm a",
                    )}
                  </div>
                  <div className="text-xs text-white/90">
                    {format(new Date(`1970-01-01T${event.endTime}`), "h:mm a")}
                  </div>
                </div>

                {/* Event Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-foreground">
                        {event.title}
                      </h4>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {event.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {event.isRecurring
                          ? `Every ${formatDay(event.dayOfWeek)}`
                          : `${formatDateString(event.startDate || "")} to ${formatDateString(event.endDate || "")}`}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddToCalendar(event)}
                      className="flex-shrink-0"
                    >
                      Add to Calendar
                    </Button>
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
