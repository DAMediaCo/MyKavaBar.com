import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Loader2, ImageIcon, X } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState, useRef } from "react";

const eventFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string(),
    endTime: z.string(),
    isRecurring: z.boolean().default(true),
    startDate: z.string().nullable().optional(), // Allow null if needed
    endDate: z.string().nullable().optional(),
  })
  .refine((data) => data.isRecurring || (data.startDate && data.endDate), {
    message:
      "Start Date and End Date are required when the event is not recurring.",
    path: ["startDate"], // Attach the error to startDate (or use `["endDate"]` for endDate)
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;

interface EventFormProps {
  onSubmit: (data: EventFormValues, photo?: File) => void;
  isSubmitting?: boolean;
  defaultValues?: Partial<EventFormValues>;
  existingPhotoUrl?: string | null;
}

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function EventForm({
  onSubmit,
  isSubmitting,
  defaultValues,
  existingPhotoUrl,
}: EventFormProps) {
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      dayOfWeek: defaultValues?.dayOfWeek ?? 0, // Ensure default is 0 (Sunday)
      isRecurring: defaultValues?.isRecurring ?? true,
      ...defaultValues,
    },
  });

  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(existingPhotoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset photo state when existingPhotoUrl changes (switching between events or opening fresh dialog)
  useEffect(() => {
    setSelectedPhoto(null);
    setPhotoPreview(existingPhotoUrl || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [existingPhotoUrl]);

  useEffect(() => {
    console.log("Form error: ", form.formState.errors);
  }, [form.formState.errors]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(existingPhotoUrl || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (data: EventFormValues) => {
    // Create a fixed copy of the data to prevent unexpected mutations
    const formData = { ...data };

    // Log the exact dates as they are in the form
    console.log("Form date values before submission:", {
      startDate: formData.startDate,
      endDate: formData.endDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
      isRecurring: formData.isRecurring,
    });

    // For non-recurring events, ensure dates are preserved exactly as entered
    if (!formData.isRecurring) {
      // Make sure we're working with the raw string values from the date inputs
      // to avoid any automatic timezone conversions
      console.log("Non-recurring event - preserving exact date strings");
    }

    // Submit the data with optional photo
    onSubmit(formData, selectedPhoto || undefined);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Event Photo Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Event Photo (Optional)</label>
          <div className="flex flex-col gap-3">
            {photoPreview ? (
              <div className="relative w-full h-32 rounded-lg overflow-hidden border border-input">
                <img
                  src={photoPreview}
                  alt="Event photo preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-input rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Click to upload photo</span>
                <span className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP (max 10MB)</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="dayOfWeek"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Day of Week</FormLabel>
              <FormControl>
                <select
                  {...field}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                >
                  {daysOfWeek.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
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

        <FormField
          control={form.control}
          name="isRecurring"
          render={({ field }) => (
            <FormItem className="flex items-center space-x-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel>Recurring Event</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        {!form.watch("isRecurring") && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => {
                        // Store the raw date string from the input without any manipulation
                        const rawDateString = e.target.value;
                        field.onChange(rawDateString);
                        console.log(
                          "Start date selected (raw value):",
                          rawDateString,
                        );
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => {
                        // Store the raw date string from the input without any manipulation
                        const rawDateString = e.target.value;
                        field.onChange(rawDateString);
                        console.log(
                          "End date selected (raw value):",
                          rawDateString,
                        );
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full"
          onClick={form.handleSubmit(handleSubmit)}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Event...
            </>
          ) : (
            "Save Event"
          )}
        </Button>
      </form>
    </Form>
  );
}
