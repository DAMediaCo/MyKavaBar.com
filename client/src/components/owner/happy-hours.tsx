import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ScheduleBuilder, type ScheduleRow, to12 } from "./schedule-builder";

const DAYS_LIST = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ── API helpers ───────────────────────────────────────────────────────────────
function fmt12(t: string): string {
  const { h, m, period } = to12(t);
  return `${h}:${m} ${period}`;
}

function parse24(time: string): string {
  const match = time.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
  if (!match) return "12:00";
  let [, h, m = "00", period] = match;
  let hour = parseInt(h, 10);
  if (period) {
    period = period.toUpperCase();
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
  }
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function fetchHappyHours(barId: number): Promise<ScheduleRow[]> {
  const res = await fetch(`/api/bar/${barId}/happy-hours`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  if (!data?.happyHours) return [];

  // Convert per-day map → schedule rows (group identical time ranges)
  const rangeMap: Record<string, boolean[]> = {};
  DAYS_LIST.forEach((day, di) => {
    const slots: any[] = data.happyHours[day] ?? [];
    slots.forEach((slot: any) => {
      // normalize to 24hr key
      const openH = slot.startPeriod
        ? parse24(`${slot.start} ${slot.startPeriod}`)
        : parse24(slot.start);
      const closeH = slot.endPeriod
        ? parse24(`${slot.end} ${slot.endPeriod}`)
        : parse24(slot.end);
      const key = `${openH}|${closeH}`;
      if (!rangeMap[key]) rangeMap[key] = Array(7).fill(false);
      rangeMap[key][di] = true;
    });
  });

  return Object.entries(rangeMap).map(([key, days]) => {
    const [open, close] = key.split("|");
    return { open, close, days };
  });
}

async function saveHappyHours(barId: number, rows: ScheduleRow[]) {
  // Convert rows → per-day map
  const happyHours: Record<string, any[]> = {};
  DAYS_LIST.forEach((day) => { happyHours[day] = []; });

  rows.forEach((row) => {
    const { h: sh, m: sm, period: sp } = to12(row.open);
    const { h: eh, m: em, period: ep } = to12(row.close);
    row.days.forEach((active, di) => {
      if (!active) return;
      happyHours[DAYS_LIST[di]].push({
        start: `${sh}:${sm}`,
        startPeriod: sp,
        end: `${eh}:${em}`,
        endPeriod: ep,
      });
    });
  });

  const res = await fetch(`/api/bar/${barId}/happy-hours`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ happyHours }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to save happy hours");
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────
export function HappyHours({ barId }: { barId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rows, setRows] = useState<ScheduleRow[]>([]);

  const { isLoading } = useQuery({
    queryKey: ["happyHours", barId],
    queryFn: () => fetchHappyHours(barId),
    onSuccess: (data: ScheduleRow[]) => {
      setRows(data.length > 0 ? data : []);
    },
  });

  const mutation = useMutation({
    mutationFn: () => saveHappyHours(barId, rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["happyHours", barId] });
      toast({ title: "Happy hours saved 🎉" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-[#D35400]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-400">
        Set your happy hour time range and check which days it runs. Add another row for different days with different times.
      </p>
      <ScheduleBuilder rows={rows} onChange={setRows} label="happy hours" />
      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full bg-[#D35400] hover:bg-[#b84800] text-white"
      >
        {mutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Happy Hours"}
      </Button>
    </div>
  );
}
