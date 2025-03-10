import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { BarEvent } from "@db/schema";

interface BarEventsProps {
  barId: number;
  ownerId: number | null;
}

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  isRecurring: z.boolean().default(true),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

function QuickEventForm({ barId, onSuccess }: { barId: number; onSuccess: () => void }) {
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
      queryClient.invalidateQueries({ queryKey: [`/api/bars/${barId}/events`] });
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

        <Button type="submit" className="w-full" disabled={createEvent.isPending}>
          {createEvent.isPending ? "Creating..." : "Create Event"}
        </Button>
      </form>
    </Form>
  );
}

export default function BarEvents({ barId, ownerId }: BarEventsProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const isOwner = user?.id === ownerId;
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);

  const { data: events, isLoading } = useQuery<BarEvent[]>({
    queryKey: [`/api/bars/${barId}/events`],
    queryFn: async () => {
      const response = await fetch(`/api/bars/${barId}/events`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      return response.json();
    },
  });

  // Function to format the day key
  const formatDay = (dayOfWeek: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || '';
  };
  
  // Function to format date strings without timezone issues
  const formatDateString = (dateStr: string) => {
    try {
      // Parse the date string parts directly to avoid timezone shifts
      const [year, month, day] = dateStr.split('-').map(num => parseInt(num));
      const date = new Date(year, month - 1, day);
      return format(date, 'MMM d, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error, dateStr);
      return dateStr || 'Invalid date';
    }
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

  const recurringEvents = events?.filter(event => event.isRecurring) || [];
  const oneTimeEvents = events?.filter(event => !event.isRecurring) || [];

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
                <Button variant="outline" size="sm">
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Event</DialogTitle>
                </DialogHeader>
                <QuickEventForm 
                  barId={barId} 
                  onSuccess={() => setIsAddEventOpen(false)} 
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {recurringEvents.length === 0 && oneTimeEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events scheduled</p>
        ) : (
          <div className="space-y-6">
            {recurringEvents.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Weekly Events</h3>
                {recurringEvents.map(event => (
                  <div key={event.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{event.title}</h4>
                      <Badge variant="secondary">
                        {formatDay(event.dayOfWeek)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(`1970-01-01T${event.startTime}`), 'h:mm a')} - 
                      {format(new Date(`1970-01-01T${event.endTime}`), 'h:mm a')}
                    </div>
                    {event.description && (
                      <p className="text-sm">{event.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {oneTimeEvents.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Special Events</h3>
                {oneTimeEvents.map(event => {
                  //This change directly uses the date string to avoid timezone issues.
                  return (
                    <div key={event.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{event.title}</h4>
                        <Badge variant="secondary">
                          {event.startDate ? formatDateString(event.startDate) : 'No date'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(`1970-01-01T${event.startTime}`), 'h:mm a')} - 
                        {format(new Date(`1970-01-01T${event.endTime}`), 'h:mm a')}
                      </div>
                      {event.description && (
                        <p className="text-sm">{event.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}