import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";

// Zod validation schema — grandOpeningDate is nullable (not optional)
const schema = z
  .object({
    comingSoon: z.boolean(),
    grandOpeningDate: z.date().nullable(),
  })
  .refine((data) => !(data.grandOpeningDate && !data.comingSoon), {
    message: "You must enable Coming Soon if you select a Grand Opening Date",
    path: ["comingSoon"],
  });

type FormData = z.infer<typeof schema>;

interface Props {
  bar: {
    id: number;

    comingSoon?: boolean;
    grandOpeningDate?: string | null; // incoming string or null
  };
}

export default function ComingSoonForm({ bar }: Props) {
  // Convert string date to Date or null
  const initialGrandOpeningDate = bar.grandOpeningDate
    ? new Date(bar.grandOpeningDate)
    : null;
  const toast = useToast();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    defaultValues: {
      comingSoon: bar.comingSoon ?? false,
      grandOpeningDate: initialGrandOpeningDate,
    },
  });

  // Reset form when bar prop changes, using null for no date
  useEffect(() => {
    reset({
      comingSoon: bar.comingSoon ?? false,
      grandOpeningDate: bar.grandOpeningDate
        ? new Date(bar.grandOpeningDate)
        : null,
    });
  }, [bar, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch(`/api/kava-bars/${bar.id}/opening`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comingSoon: data.comingSoon,
          grandOpeningDate: data.grandOpeningDate
            ? data.grandOpeningDate.toISOString()
            : null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update");
      }

      toast.toast({
        title: "Success",
        description: "Bar details updated successfully",
      });
    } catch (error: any) {
      toast.toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Something went wrong",
      });
    }
  };

  const comingSoon = watch("comingSoon");

  return (
    <div className="space-y-4">
      {/* Coming Soon Switch */}
      <Controller
        name="comingSoon"
        control={control}
        render={({ field }) => (
          <div className="flex items-center space-x-3">
            <label
              htmlFor="coming-soon-switch"
              className="select-none font-medium"
            >
              Coming Soon
            </label>
            <Switch
              id="coming-soon-switch"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </div>
        )}
      />
      {errors.comingSoon && (
        <p className="text-red-500 text-sm">{errors.comingSoon.message}</p>
      )}

      {/* Grand Opening Date Picker */}
      <Controller
        control={control}
        name="grandOpeningDate"
        render={({ field }) => (
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" disabled={!comingSoon}>
                  {field.value
                    ? format(field.value, "PPP")
                    : "Select Grand Opening Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Calendar
                  mode="single"
                  selected={field.value ?? undefined}
                  onSelect={(date) => field.onChange(date)}
                  initialFocus
                />
                <Button
                  variant="ghost"
                  className="mt-2 w-full"
                  onClick={() => field.onChange(null)}
                >
                  Remove Date
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        )}
      />
      {errors.grandOpeningDate && (
        <p className="text-red-500 text-sm">
          {errors.grandOpeningDate.message}
        </p>
      )}

      {/* Submit Button */}
      <div>
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit(onSubmit)}
          className="mt-4"
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
