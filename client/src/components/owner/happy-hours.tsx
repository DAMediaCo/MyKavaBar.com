"use client";
import React from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Zod validation schema with custom pairing validation
const happyHourSlotSchema = z
  .object({
    start: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val),
        "Invalid start time (HH:MM, 24-hour format)",
      ),
    end: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val),
        "Invalid end time (HH:MM, 24-hour format)",
      ),
  })
  .superRefine((data, ctx) => {
    if ((data.start && !data.end) || (!data.start && data.end)) {
      if (!data.start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start time is required if end time is set",
          path: ["start"],
        });
      }
      if (!data.end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End time is required if start time is set",
          path: ["end"],
        });
      }
    }
  });

const happyHoursSchema = z.object({
  days: z.array(z.array(happyHourSlotSchema)).length(7),
  _formError: z.string().optional(),
});

type HappyHourSlot = z.infer<typeof happyHourSlotSchema>;
type FormValues = z.infer<typeof happyHoursSchema>;

const defaultSlot: HappyHourSlot = { start: "", end: "" };
const defaultValues: FormValues = {
  days: Array(7)
    .fill(null)
    .map(() =>
      Array(4)
        .fill(null)
        .map(() => ({ ...defaultSlot })),
    ),
  _formError: undefined,
};

function convert24hTo12h(time24: string) {
  if (!time24) return { hour: "", minute: "", period: "" };
  const [hourStr, minute] = time24.split(":");
  let hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? "PM" : "AM";
  let hour12 = hour % 12;
  if (hour12 === 0) hour12 = 12;
  return {
    hour: hour12.toString().padStart(2, "0"),
    minute,
    period,
  };
}

async function fetchHappyHours(barId: string): Promise<FormValues> {
  const res = await fetch(`/api/bar/${barId}/happy-hours`);
  if (!res.ok) throw new Error("Failed to fetch happy hours");
  const data = await res.json();
  const days = daysOfWeek.map((day) => {
    const slots = data.happyHours?.[day] ?? [];
    const padded = [...slots];
    while (padded.length < 4) padded.push({ ...defaultSlot });
    return padded.slice(0, 4);
  });
  return { days, _formError: undefined };
}

function formatHappyHoursForAPI(days: FormValues["days"]) {
  const formatted: Record<string, any[]> = {};
  daysOfWeek.forEach((day, i) => {
    const slots = days[i];
    formatted[day] = slots
      .filter((s) => s.start && s.end)
      .map((slot) => {
        const start = convert24hTo12h(slot.start!);
        const end = convert24hTo12h(slot.end!);
        return {
          start: `${start.hour}:${start.minute}`,
          startPeriod: start.period,
          end: `${end.hour}:${end.minute}`,
          endPeriod: end.period,
        };
      });
  });
  return { happyHours: formatted };
}

async function updateHappyHours(barId: string, values: FormValues) {
  const body = formatHappyHoursForAPI(values.days);
  const res = await fetch(`/api/bar/${barId}/happy-hours`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update happy hours");
  return res.json();
}

export function HappyHours({ barId }: { barId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    control,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues,
    resolver: zodResolver(happyHoursSchema),
    mode: "onBlur",
  });

  const { isLoading, data, dataUpdatedAt } = useQuery<FormValues, Error>({
    queryKey: ["happyHours", barId],
    queryFn: () => fetchHappyHours(barId),
  });

  React.useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  // Improved scroll+focus effect on error
  React.useEffect(() => {
    if (errors.days && Array.isArray(errors.days)) {
      outer: for (let dayIndex = 0; dayIndex < errors.days.length; dayIndex++) {
        const slots = errors.days[dayIndex];
        if (slots && Array.isArray(slots)) {
          for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
            const slotErrors = slots[slotIndex];
            if (slotErrors) {
              if (slotErrors.start) {
                // Defer focus+scroll to let React mark inputs with errors
                setTimeout(() => {
                  const fieldName = `days.${dayIndex}.${slotIndex}.start`;
                  setFocus(fieldName);
                  const el = document.querySelector<HTMLInputElement>(
                    `input[name="${fieldName}"]`,
                  );
                  if (el)
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 20);
                break outer;
              }
              if (slotErrors.end) {
                setTimeout(() => {
                  const fieldName = `days.${dayIndex}.${slotIndex}.end`;
                  setFocus(fieldName);
                  const el = document.querySelector<HTMLInputElement>(
                    `input[name="${fieldName}"]`,
                  );
                  if (el)
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 20);
                break outer;
              }
            }
          }
        }
      }
    }
  }, [errors, setFocus]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateHappyHours(barId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["happyHours", barId] });
      toast({
        title: "Success",
        description: "Happy hours updated successfully 🎉",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update happy hours",
      });
    },
  });

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    mutation.mutate(data);
  };

  if (isLoading) return <div>Loading happy hours...</div>;

  return (
    <Card
      key={`happy-hours-form-${dataUpdatedAt ?? 0}`}
      className="p-6 max-w-5xl mx-auto my-8 rounded-lg"
    >
      <h2 className="text-2xl font-bold mb-6 text-center">
        Bar Happy Hours Scheduler
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
        {daysOfWeek.map((day, dayIndex) => (
          <section key={day}>
            <h3 className="text-lg font-semibold mb-4">{day}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {Array(4)
                .fill(null)
                .map((_, slotIndex) => (
                  <div
                    key={`${day}-${slotIndex}`}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 p-4 border rounded-lg"
                  >
                    <div className="flex flex-col space-y-1 items-center">
                      <label
                        className="text-sm font-medium"
                        htmlFor={`start-${dayIndex}-${slotIndex}`}
                      >
                        Start
                      </label>
                      <Controller
                        name={`days.${dayIndex}.${slotIndex}.start`}
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id={`start-${dayIndex}-${slotIndex}`}
                            type="time"
                            className="w-40 text-center"
                          />
                        )}
                      />
                      {errors?.days?.[dayIndex]?.[slotIndex]?.start && (
                        <p className="text-xs text-red-600">
                          {errors.days[dayIndex][slotIndex].start?.message}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col space-y-1 items-center">
                      <label
                        className="text-sm font-medium"
                        htmlFor={`end-${dayIndex}-${slotIndex}`}
                      >
                        End
                      </label>
                      <Controller
                        name={`days.${dayIndex}.${slotIndex}.end`}
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id={`end-${dayIndex}-${slotIndex}`}
                            type="time"
                            className="w-40 text-center"
                          />
                        )}
                      />
                      {errors?.days?.[dayIndex]?.[slotIndex]?.end && (
                        <p className="text-xs text-red-600">
                          {errors.days[dayIndex][slotIndex].end?.message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}
        {mutation.isError && (
          <p className="text-center text-red-600 mt-4">
            Error updating happy hours.
          </p>
        )}
        <Button
          type="submit"
          className="mt-6 w-full"
          disabled={mutation.isPending || isSubmitting}
        >
          {mutation.isPending ? "Saving..." : "Save Happy Hours"}
        </Button>
      </form>
    </Card>
  );
}
