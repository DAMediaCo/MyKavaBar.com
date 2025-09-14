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
import { ChevronDownIcon } from "@radix-ui/react-icons";

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const happyHourSlotSchema = z
  .object({
    start: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val),
        "Invalid start time (HH:MM 24-hour)",
      ),
    end: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val),
        "Invalid end time (HH:MM 24-hour)",
      ),
  })
  .superRefine((data, ctx) => {
    if ((data.start && !data.end) || (!data.start && data.end)) {
      if (!data.start)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start time required if end time set",
          path: ["start"],
        });
      if (!data.end)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End time required if start time set",
          path: ["end"],
        });
    }
  });

const happyHoursSchema = z.object({
  days: z.array(z.array(happyHourSlotSchema)).length(7),
  _formError: z.string().optional(),
});

type HappyHourSlot = z.infer<typeof happyHourSlotSchema>;
type FormValues = z.infer<typeof happyHoursSchema>;
const defaultSlot: HappyHourSlot = { start: "", end: "" };

function convert12hTo24h(time12: string, period: string): string {
  let [hh, mm] = time12.split(":");
  let hour = parseInt(hh, 10);
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return `${hour.toString().padStart(2, "0")}:${mm}`;
}

function convert24hTo12h(time24: string): {
  hh: string;
  mm: string;
  period: string;
} {
  let [hh, mm] = time24.split(":");
  let hour = parseInt(hh, 10);
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return { hh: hour.toString().padStart(2, "0"), mm, period };
}

async function fetchHappyHours(barId: string): Promise<FormValues> {
  const res = await fetch(`/api/bar/${barId}/happy-hours`);
  if (!res.ok) throw new Error("Failed to fetch happy hours");
  const data = await res.json();
  const days = daysOfWeek.map((day) => {
    const slots = data.happyHours?.[day] ?? [];
    const converted = slots.map((slot: any) => ({
      start: convert12hTo24h(slot.start, slot.startPeriod),
      end: convert12hTo24h(slot.end, slot.endPeriod),
    }));
    return converted.length ? converted : [];
  });
  return { days, _formError: undefined };
}

function formatHappyHoursForAPI(days: FormValues["days"]) {
  const formatted: Record<string, any[]> = {};
  daysOfWeek.forEach((day, i) => {
    formatted[day] = days[i]
      .filter((s) => s.start && s.end)
      .map((slot) => {
        const { hh, mm, period } = convert24hTo12h(slot.start!);
        const start = `${hh}:${mm}`;
        const { hh: eh, mm: em, period: ePeriod } = convert24hTo12h(slot.end!);
        const end = `${eh}:${em}`;
        return { start, startPeriod: period, end, endPeriod: ePeriod };
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

  // Open current day by default
  const [openDay, setOpenDay] = React.useState(() => new Date().getDay());

  const { data: loadedFormData, isLoading } = useQuery<FormValues, Error>({
    queryKey: ["happyHours", barId],
    queryFn: () => fetchHappyHours(barId),
  });

  // Initialize useForm only when loadedFormData is available
  const formMethods = useForm<FormValues>({
    defaultValues: loadedFormData ?? { days: Array(7).fill([]) },
    resolver: zodResolver(happyHoursSchema),
    mode: "onBlur",
  });
  const { control, handleSubmit, reset, watch, formState } = formMethods;
  const { errors, isSubmitting } = formState;

  React.useEffect(() => {
    if (loadedFormData) {
      reset(loadedFormData);
      setOpenDay(new Date().getDay());
    }
  }, [loadedFormData, reset]);

  React.useEffect(() => {
    if (errors.days && Array.isArray(errors.days)) {
      for (let dayIndex = 0; dayIndex < errors.days.length; dayIndex++) {
        const slots = errors.days[dayIndex];
        if (slots && Array.isArray(slots)) {
          for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
            const slot = slots[slotIndex];
            if (slot?.start || slot?.end) {
              const errorField = document.querySelector<HTMLInputElement>(
                `input[name="days.${dayIndex}.${slotIndex}.${slot.start ? "start" : "end"}"]`,
              );
              if (errorField) {
                errorField.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                errorField.focus();
              }
              return;
            }
          }
        }
      }
    }
  }, [errors]);

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

  const days = watch("days");

  const toggleDayPanel = (index: number) => {
    setOpenDay((prev) => (prev === index ? -1 : index));
  };

  const addSlot = (dayIndex: number) => {
    const daySlots = days[dayIndex] ?? [];
    if (daySlots.length >= 4) return;
    const newSlots = [...daySlots, { ...defaultSlot }];
    const newDays = days.map((slots, idx) =>
      idx === dayIndex ? newSlots : slots,
    );
    reset({ days: newDays });
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    const newSlots = [...(days[dayIndex] ?? [])];
    newSlots.splice(slotIndex, 1);
    const newDays = days.map((slots, idx) =>
      idx === dayIndex ? newSlots : slots,
    );
    reset({ days: newDays });
  };

  if (isLoading || !loadedFormData) return <div>Loading happy hours...</div>;

  return (
    <Card className="p-6 max-w-5xl mx-auto my-8 rounded-lg">
      <h2 className="text-3xl font-bold mb-6 text-center">
        Happy Hours Scheduler
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {daysOfWeek.map((day, dayIndex) => {
          const isOpen = dayIndex === openDay;
          const daySlots = days[dayIndex] ?? [];

          return (
            <Card key={day} className="border rounded-lg overflow-hidden">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`panel-${dayIndex}`}
                onClick={() => toggleDayPanel(dayIndex)}
                className="flex justify-between items-center px-4 py-3 font-semibold cursor-pointer w-full"
              >
                <span>{day}</span>
                <ChevronDownIcon
                  className={`w-5 h-5 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                id={`panel-${dayIndex}`}
                className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  isOpen
                    ? "max-h-[999px] p-4 opacity-100"
                    : "max-h-0 p-0 opacity-0 pointer-events-none"
                }`}
              >
                {daySlots.length === 0 && (
                  <p className="italic text-gray-600">No happy hours yet</p>
                )}
                {daySlots.map((slot, slotIdx) => (
                  <div
                    key={slotIdx}
                    className="flex flex-col md:grid md:grid-cols-3 gap-4 items-center border border-gray-300 rounded-lg p-4"
                  >
                    <div>
                      <label className="block mb-1 text-sm">Start</label>
                      <Controller
                        name={`days.${dayIndex}.${slotIdx}.start`}
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            type="time"
                            className="w-full text-center"
                          />
                        )}
                      />
                      {errors.days?.[dayIndex]?.[slotIdx]?.start && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.days[dayIndex][slotIdx].start?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block mb-1 text-sm">End</label>
                      <Controller
                        name={`days.${dayIndex}.${slotIdx}.end`}
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            type="time"
                            className="w-full text-center"
                          />
                        )}
                      />
                      {errors.days?.[dayIndex]?.[slotIdx]?.end && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.days[dayIndex][slotIdx].end?.message}
                        </p>
                      )}
                    </div>
                    <div className="w-full md:w-auto flex justify-center mt-2 md:mt-0">
                      <Button
                        variant="destructive"
                        size="sm"
                        type="button"
                        onClick={() => removeSlot(dayIndex, slotIdx)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 flex-wrap items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={daySlots.length >= 4}
                    onClick={() => addSlot(dayIndex)}
                  >
                    + Add Happy Hour ({daySlots.length} / 4)
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {mutation.isError && (
          <p className="text-center text-red-600 mt-2">
            Error updating happy hours.
          </p>
        )}
        <Button
          type="submit"
          disabled={mutation.isPending || isSubmitting}
          className="w-full mt-6"
          size="lg"
        >
          {mutation.isPending ? "Saving..." : "Save Happy Hours"}
        </Button>
      </form>
    </Card>
  );
}
