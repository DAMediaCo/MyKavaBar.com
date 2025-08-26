import React from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TIME_REGEX = /^(0?[0-9]|1[0-1]):([0-5][0-9])$/;

const happyHourSlotSchema = z
  .object({
    start: z
      .string()
      .optional()
      .refine((val) => !val || TIME_REGEX.test(val), {
        message: "Invalid start time format (hh:mm, 0-11 hours)",
      }),
    startPeriod: z.enum(["AM", "PM"]),
    end: z
      .string()
      .optional()
      .refine((val) => !val || TIME_REGEX.test(val), {
        message: "Invalid end time format (hh:mm, 0-11 hours)",
      }),
    endPeriod: z.enum(["AM", "PM"]),
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

const defaultSlot: HappyHourSlot = {
  start: "",
  startPeriod: "AM",
  end: "",
  endPeriod: "AM",
};

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

async function updateHappyHours(barId: string, values: FormValues) {
  const body = {
    happyHours: Object.fromEntries(
      daysOfWeek.map((day, i) => [
        day,
        values.days[i].filter((slot) => slot.start && slot.end),
      ]),
    ),
  };
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

  const {
    control,
    handleSubmit,
    reset,
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

  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateHappyHours(barId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["happyHours", barId] });
      alert("Happy hours updated successfully");
    },
    onError: () => {
      alert("Failed to update happy hours");
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {daysOfWeek.map((day, dayIndex) => (
          <section key={day}>
            <h3 className="text-lg font-semibold mb-4">{day}</h3>
            <div className="space-y-4">
              {Array(4)
                .fill(null)
                .map((_, slotIndex) => (
                  <div
                    key={`${day}-${slotIndex}`}
                    className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end"
                  >
                    {/* Start time input + error below */}
                    <div className="flex flex-col sm:col-span-2 space-y-1">
                      <Controller
                        name={`days.${dayIndex}.${slotIndex}.start`}
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            placeholder="hh:mm"
                            inputMode="numeric"
                            error={Boolean(
                              errors?.days?.[dayIndex]?.[slotIndex]?.start,
                            )}
                          />
                        )}
                      />
                      {errors?.days?.[dayIndex]?.[slotIndex]?.start && (
                        <p className="text-xs text-red-600">
                          {errors.days[dayIndex][slotIndex].start?.message}
                        </p>
                      )}
                    </div>

                    {/* Start Period select */}
                    <div className="sm:col-span-1">
                      <Controller
                        name={`days.${dayIndex}.${slotIndex}.startPeriod`}
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AM">AM</SelectItem>
                              <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    {/* End time input + error below */}
                    <div className="flex flex-col sm:col-span-2 space-y-1">
                      <Controller
                        name={`days.${dayIndex}.${slotIndex}.end`}
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            placeholder="hh:mm"
                            inputMode="numeric"
                            error={Boolean(
                              errors?.days?.[dayIndex]?.[slotIndex]?.end,
                            )}
                          />
                        )}
                      />
                      {errors?.days?.[dayIndex]?.[slotIndex]?.end && (
                        <p className="text-xs text-red-600">
                          {errors.days[dayIndex][slotIndex].end?.message}
                        </p>
                      )}
                    </div>

                    {/* End Period select */}
                    <div className="sm:col-span-1">
                      <Controller
                        name={`days.${dayIndex}.${slotIndex}.endPeriod`}
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AM">AM</SelectItem>
                              <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
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
