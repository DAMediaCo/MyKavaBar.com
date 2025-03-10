import { useState } from "react";
import { useMap } from "./map-provider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { ClockIcon, CalendarIcon, InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Form schema with validation
export const eventFormSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }).max(100),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }).max(1000),
  eventDate: z.date({
    required_error: "Event date is required",
  }),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Start time must be in 24-hour format (HH:MM)",
  }),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "End time must be in 24-hour format (HH:MM)",
  }),
  eventType: z.string().min(1, { message: "Event type is required" }),
  isFeatured: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.string().optional(),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;

interface BarEventFormProps {
  defaultValues?: Partial<EventFormValues>;
  onSubmit: (data: EventFormValues) => void;
  isSubmitting?: boolean;
  barTimezone?: string | null;
  barLocation?: { lat: number; lng: number } | null;
}

export default function BarEventForm({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  barTimezone,
  barLocation,
}: BarEventFormProps) {
  const [showTimezoneBanner, setShowTimezoneBanner] = useState<boolean>(true);
  const { getTimezone } = useMap();
  const [timezone, setTimezone] = useState<string | null>(barTimezone || "UTC");

  // Initialize event type options
  const eventTypes = [
    "Live Music",
    "Happy Hour",
    "Tasting Event",
    "Workshop",
    "Promotion",
    "Community Gathering",
    "Other",
  ];

  // Initialize form with default values
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      eventDate: new Date(),
      startTime: "18:00",
      endTime: "21:00",
      eventType: "Other",
      isFeatured: false,
      isRecurring: false,
      recurrencePattern: "weekly",
      ...defaultValues,
    },
  });

  // Detect timezone if not provided
  const detectTimezone = async () => {
    if (barLocation) {
      try {
        const detectedTimezone = await getTimezone(barLocation);
        if (detectedTimezone) {
          setTimezone(detectedTimezone);
          console.log("Detected timezone:", detectedTimezone);
        }
      } catch (error) {
        console.error("Failed to detect timezone:", error);
      }
    }
  };

  // Handle form submission
  const handleSubmit = (data: EventFormValues) => {
    onSubmit(data);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {showTimezoneBanner && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Timezone Information</AlertTitle>
          <AlertDescription>
            Events will be stored in the bar's local timezone ({timezone || "UTC"}). 
            Times will be displayed to users in their local timezone.
            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={() => setShowTimezoneBanner(false)}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter event title..." {...field} />
                </FormControl>
                <FormDescription>
                  A clear, catchy title for your event
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe your event..."
                    className="resize-y min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Provide details about what attendees can expect
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="eventDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Event Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an event type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {eventTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    Start Time
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InfoIcon className="h-4 w-4 ml-2 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Use 24-hour format (e.g., 14:30 for 2:30 PM)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="HH:MM"
                        {...field}
                        className="pl-10"
                      />
                      <ClockIcon className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Event start time in {timezone || "local time"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    End Time
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InfoIcon className="h-4 w-4 ml-2 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Use 24-hour format (e.g., 22:00 for 10:00 PM)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="HH:MM"
                        {...field}
                        className="pl-10"
                      />
                      <ClockIcon className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Event end time in {timezone || "local time"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? "Saving..." : "Save Event"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}