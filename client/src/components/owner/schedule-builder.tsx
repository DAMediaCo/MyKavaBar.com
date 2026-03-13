import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
export interface ScheduleRow {
  open: string;  // "HH:MM" 24hr internal
  close: string; // "HH:MM" 24hr internal
  days: boolean[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
}

interface ScheduleBuilderProps {
  rows: ScheduleRow[];
  onChange: (rows: ScheduleRow[]) => void;
  label?: string; // "Open" / "Close" or "Start" / "End"
}

// ── Day labels ───────────────────────────────────────────────────────────────
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ── 12-hour time helpers ─────────────────────────────────────────────────────
export function to24(h: string, m: string, period: "AM" | "PM"): string {
  let hour = parseInt(h, 10);
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${m}`;
}

export function to12(time24: string): { h: string; m: string; period: "AM" | "PM" } {
  if (!time24) return { h: "12", m: "00", period: "AM" };
  const [hRaw, mRaw] = time24.split(":");
  let hour = parseInt(hRaw, 10);
  const period: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return { h: String(hour), m: mRaw || "00", period };
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = ["00", "15", "30", "45"];

// ── TimePicker ───────────────────────────────────────────────────────────────
function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { h, m, period } = to12(value);

  const update = (newH: string, newM: string, newPeriod: "AM" | "PM") => {
    onChange(to24(newH, newM, newPeriod));
  };

  const selectClass =
    "bg-[#111112] border border-[#333] text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#D35400] appearance-none cursor-pointer";

  return (
    <div className="flex items-center gap-1">
      <select
        value={h}
        onChange={(e) => update(e.target.value, m, period)}
        className={cn(selectClass, "w-12 text-center")}
      >
        {HOURS.map((hr) => (
          <option key={hr} value={hr}>{hr}</option>
        ))}
      </select>
      <span className="text-gray-500 text-sm">:</span>
      <select
        value={m}
        onChange={(e) => update(h, e.target.value, period)}
        className={cn(selectClass, "w-14 text-center")}
      >
        {MINUTES.map((min) => (
          <option key={min} value={min}>{min}</option>
        ))}
      </select>
      <select
        value={period}
        onChange={(e) => update(h, m, e.target.value as "AM" | "PM")}
        className={cn(selectClass, "w-16 text-center")}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

// ── ScheduleBuilder ──────────────────────────────────────────────────────────
export function ScheduleBuilder({
  rows,
  onChange,
  label = "hours",
}: ScheduleBuilderProps) {
  // Which days are already claimed by other rows (to prevent double-assignment)
  const claimedDays = (excludeIdx: number) =>
    rows.reduce<boolean[]>(
      (acc, row, i) => {
        if (i === excludeIdx) return acc;
        return acc.map((v, d) => v || row.days[d]);
      },
      Array(7).fill(false),
    );

  const addRow = () => {
    onChange([
      ...rows,
      { open: "10:00", close: "22:00", days: Array(7).fill(false) },
    ]);
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, patch: Partial<ScheduleRow>) => {
    onChange(rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const toggleDay = (rowIdx: number, dayIdx: number) => {
    const row = rows[rowIdx];
    const claimed = claimedDays(rowIdx);
    if (claimed[dayIdx]) return; // already used in another row
    const newDays = row.days.map((v, i) => (i === dayIdx ? !v : v));
    updateRow(rowIdx, { days: newDays });
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-sm text-gray-500 italic text-center py-4">
          No schedule set. Click "Add Schedule" to begin.
        </p>
      )}

      {rows.map((row, rowIdx) => {
        const claimed = claimedDays(rowIdx);
        const selectedDays = row.days.filter(Boolean).length;

        return (
          <div
            key={rowIdx}
            className="rounded-xl border border-[#2a2a2b] bg-[#111112] p-4 space-y-4"
          >
            {/* Open / Close times */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-10 flex-shrink-0">Opens</span>
                <TimePicker
                  value={row.open}
                  onChange={(v) => updateRow(rowIdx, { open: v })}
                />
              </div>
              <span className="text-gray-600 hidden sm:block">→</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12 flex-shrink-0">Closes</span>
                <TimePicker
                  value={row.close}
                  onChange={(v) => updateRow(rowIdx, { close: v })}
                />
              </div>
              <button
                onClick={() => removeRow(rowIdx)}
                className="ml-auto text-gray-600 hover:text-red-400 transition-colors p-1 rounded"
                title="Remove this schedule"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Day checkboxes */}
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((day, dayIdx) => {
                const isChecked = row.days[dayIdx];
                const isClaimed = claimed[dayIdx];

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(rowIdx, dayIdx)}
                    disabled={isClaimed}
                    title={isClaimed ? "Already used in another schedule" : day}
                    className={cn(
                      "w-9 h-9 rounded-lg text-xs font-semibold border transition-all",
                      isChecked
                        ? "bg-[#D35400] border-[#D35400] text-white"
                        : isClaimed
                        ? "bg-[#1a1a1b] border-[#222] text-gray-700 cursor-not-allowed"
                        : "bg-[#1a1a1b] border-[#333] text-gray-400 hover:border-[#D35400] hover:text-white"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
              <span className="text-xs text-gray-600 self-center ml-1">
                {selectedDays === 0
                  ? "No days selected"
                  : selectedDays === 7
                  ? "Every day"
                  : `${selectedDays} day${selectedDays > 1 ? "s" : ""}`}
              </span>
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={addRow}
        className="w-full border-dashed border-[#333] bg-transparent text-gray-400 hover:text-white hover:border-[#D35400] transition-colors"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Schedule
      </Button>
    </div>
  );
}
