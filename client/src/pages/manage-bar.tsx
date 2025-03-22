import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import KavatendersTable from "@/components/kavatenders-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { EventForm, type EventFormValues } from "@/components/event-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Label } from "@/components/ui/label";

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const hoursFormSchema = z.object({
  hours: z.array(
    z.object({
      day: z.enum(daysOfWeek),
      open: z.string(),
      close: z.string(),
    }),
  ),
});

type HoursFormValues = z.infer<typeof hoursFormSchema>;

export default function ManageBar() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<HoursFormValues>({
    resolver: zodResolver(hoursFormSchema),
    defaultValues: {
      hours: daysOfWeek.map((day) => ({
        day,
        open: "09:00",
        close: "22:00",
      })),
    },
  });
  // Update the error handling in the fetch query
  const {
    data: bar,
    isLoading: isLoadingBarQuery,
    error: barError,
  } = useQuery({
    queryKey: [`/api/kava-bars/${id}`],
    queryFn: async () => {
      console.log("Fetching bar details:", id);
      const response = await fetch(`/api/kava-bars/${id}`, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Bar details error response:", errorData);
        throw new Error(
          errorData.error || errorData.details || "Failed to fetch bar details",
        );
      }

      const data = await response.json();
      if (data?.hours) {
        console.log("data hours exist:", data);

        const convertedHours = data.hours
          .map((entry: string, index: number) => {
            if (!entry.includes(":")) {
              console.error(`Skipping invalid entry at index ${index}:`, entry);
              return null;
            }

            const [day, timeRange] = entry.split(": ");

            if (!timeRange) {
              console.error(`Invalid time range at index ${index}:`, entry);
              return null;
            }
            console.log(`Day: ${day}, Time: ${timeRange}`);

            // Normalize different dash types and remove potential hidden characters
            const cleanTimeRange = timeRange
              .replace(/\s*[\u2013\u2014–-]\s*/g, " - ")
              .trim();
            console.log(`Cleaned time range: ${cleanTimeRange}`);

            let [openTime, closeTime] = cleanTimeRange
              .split(" - ")
              .map((t) => t.trim());
            console.log(`Open time: ${openTime}, Close time: ${closeTime}`);

            if (!openTime || !closeTime) {
              console.error(
                `Missing open or close time at index ${index}:`,
                entry,
              );
              return null;
            }

            const to24HourFormat = (time: string) => {
              if (!time) {
                console.error(`Invalid time passed to conversion:`, time);
                return null;
              }

              // Ensure clean extraction of time
              const match = time.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
              if (!match) {
                console.error(`Invalid time format:`, time);
                return null;
              }

              let [, hour, minute = "00", period] = match;
              hour = parseInt(hour, 10);
              minute = parseInt(minute, 10);

              console.log(
                `Extracted - Hour: ${hour}, Minute: ${minute}, Period: ${period}`,
              );

              if (isNaN(hour) || isNaN(minute)) {
                console.error(`Invalid hour/minute format:`, time);
                return null;
              }

              // Convert AM/PM format to 24-hour format
              if (period) {
                period = period.toUpperCase();
                if (period === "PM" && hour !== 12) hour += 12;
                if (period === "AM" && hour === 12) hour = 0;
              }

              // Ensure formatted output
              const formattedHour = hour.toString().padStart(2, "0");
              const formattedMinute = minute.toString().padStart(2, "0");

              const formattedTime = `${formattedHour}:${formattedMinute}`;
              console.log(`Formatted time: ${formattedTime}`);
              return formattedTime;
            };

            return {
              day,
              open: to24HourFormat(openTime),
              close: to24HourFormat(closeTime),
            };
          })
          .filter(Boolean); // Remove null values

        // Reset form with new values
        form.reset({ hours: convertedHours });
      }

      console.log("Successfully fetched bar details:", {
        id: data.id,
        name: data.name,
        owner_id: data.owner_id,
        hasHours: !!data.hours,
        hasLocation: !!data.location,
      });
      return data;
    },
    retry: 1,
    retryDelay: 1000,
    onError: (error: any) => {
      console.error("Query error:", error);
      toast({
        title: "Error Loading Bar",
        description:
          error.message || "Please check your permissions and try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data: any) => {
      console.log("Data was fetched successfully", data);
    },
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: [`/api/bars/${id}/events`],
    queryFn: async () => {
      const response = await fetch(`/api/bars/${id}/events`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch events");
      }

      return response.json();
    },
    enabled: !!bar, // Only fetch events if bar data is available
  });

  const { data: kavaTenders = [], isLoading: isLoadingKavatenders } = useQuery({
    queryKey: [`/api/kavatenders/${id}`],
    queryFn: async () => {
      const response = await fetch(`/api/kavatenders/${id}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch kavatenders");
      }

      return response.json();
    },
    enabled: !!bar,
  });

  const updateHoursMutation = useMutation({
    mutationFn: async (data: HoursFormValues) => {
      const response = await fetch(`/api/kava-bars/${id}/hours`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update hours");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Hours of operation updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormValues) => {
      const response = await fetch(`/api/bars/${id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch(`/api/bars/${id}/events/${eventId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete event");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
      queryClient.invalidateQueries([`/api/bars/${id}/events`]);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const [phoneNumber, setPhoneNumber] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyKavatenderMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/kavatenders/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, barId: id }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to verify kavatender");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Kavatender verified successfully!",
      });
      queryClient.invalidateQueries([`/api/kavatenders/${id}`]);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteKavatenderMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/kavatenders/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to remove kavatender");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Kavatender removed successfully!",
      });
      queryClient.invalidateQueries([`/api/kavatenders/${id}`]);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
  const handleDeleteKavatender = (userId: number) => {
    deleteKavatenderMutation.mutate(userId);
  };
  const handleVerifyKavatender = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    verifyKavatenderMutation.mutate();
    setIsVerifying(false);
  };

  function onSubmit(data: HoursFormValues) {
    updateHoursMutation.mutate(data);
  }

  function handleCreateEvent(data: EventFormValues) {
    createEventMutation.mutate(data);
  }

  const isLoading =
    isLoadingBarQuery || isLoadingEvents || isLoadingKavatenders;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Update the error display component
  if (barError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">
              Error Loading Bar Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground mb-4">
              {barError instanceof Error
                ? barError.message
                : "Failed to load bar details"}
            </p>
            <div className="flex justify-center">
              <Button
                className="mt-4"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: [`/api/kava-bars/${id}`],
                  })
                }
              >
                Retry Loading
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!bar) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-red-500">Bar not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Manage {bar.name}</h1>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <CardTitle>Verify Kavatender</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyKavatender} className="space-y-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 555-5555"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={isVerifying}>
                  {isVerifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Kavatender"
                  )}
                </Button>
              </form>
            </CardContent>
            <CardContent>
              {isLoadingKavatenders ? (
                <h1>Loading...</h1>
              ) : (
                <KavatendersTable
                  kavaTenders={kavaTenders || []}
                  onRemove={handleDeleteKavatender}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Bar Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Address</h3>
                  <p className="text-muted-foreground">{bar.address}</p>
                </div>
                <div>
                  <h3 className="font-medium">Phone</h3>
                  <p className="text-muted-foreground">
                    {bar.phone || "Not provided"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle>Hours of Operation</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  {daysOfWeek.map((day, index) => (
                    <div key={day}>
                      <div className="flex items-center gap-4">
                        <p className="w-24 font-medium">{day}</p>
                        <FormField
                          control={form.control}
                          name={`hours.${index}.open`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Open</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  className="w-32"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`hours.${index}.close`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Close</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  className="w-32"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      {index < daysOfWeek.length - 1 && (
                        <Separator className="my-4" />
                      )}
                    </div>
                  ))}
                  <Button
                    type="submit"
                    disabled={updateHoursMutation.isPending}
                    className="w-full"
                  >
                    {updateHoursMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Hours...
                      </>
                    ) : (
                      "Update Hours"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Event Schedule</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Event
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Event</DialogTitle>
                  </DialogHeader>
                  <EventForm
                    onSubmit={handleCreateEvent}
                    isSubmitting={createEventMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingEvents ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No events scheduled yet
                </p>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => (
                    <Card key={event.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{event.title}</h3>
                            {event.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {event.description}
                              </p>
                            )}
                            <p className="text-sm mt-2">
                              {daysOfWeek[event.dayOfWeek]},{" "}
                              {event.startTime.slice(0, 5)} -{" "}
                              {event.endTime.slice(0, 5)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteEventMutation.mutate(event.id)}
                            disabled={deleteEventMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
