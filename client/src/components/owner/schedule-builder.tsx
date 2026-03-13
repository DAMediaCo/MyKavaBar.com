import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ScheduleRow {
  open: string;   // "HH:MM" 24hr
  close: string;  // "HH:MM" 24hr
  days: boolean[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
}

interface ScheduleBuilderProps {
  rows: ScheduleRow[];
  onChange: (rows: ScheduleRow[]) => void;
  label?: string;
}

// ── Day labels ────────────────────────────────────────────────────────────────
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ── Time helpers ──────────────────────────────────────────────────────────────
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

// ── TimePicker ────────────────────────────────────────────────────────────────
// Stacks compactly and is touch-friendly on mobile
function TimePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const { h, m, period } = to12(value);
  const update = (newH: string, newM: string, newPeriod: "AM" | "PM") =>
    onChange(to24(newH, newM, newPeriod));

  const sel = "bg-[#0d0d0e] border border-[#333] text-white rounded-lg text-sm focus:outline-none focus:border-[#D35400] cursor-pointer min-h-[44px] px-2";

  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <div className="flex items-center gap-1">
        {/* Hour */}
        <select
          value={h}
          onChange={(e) => update(e.target.value, m, period)}
          className={cn(sel, "w-full text-center")}
        >
          {HOURS.map((hr) => (
            <option key={hr} value={hr}>{hr}</option>
          ))}
        </select>
        <span className="text-gray-600 text-base flex-shrink-0">:</span>
        {/* Minute */}
        <select
          value={m}
          onChange={(e) => update(h, e.target.value, period)}
          className={cn(sel, "w-full text-center")}
        >
          {MINUTES.map((min) => (
            <option key={min} value={min}>{min}</option>
          ))}
        </select>
        {/* AM/PM */}
        <select
          value={period}
          onChange={(e) => update(h, m, e.target.value as "AM" | "PM")}
          className={cn(sel, "w-full text-center")}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

// ── ScheduleBuilder ───────────────────────────────────────────────────────────
export function ScheduleBuilder({ rows, onChange }: ScheduleBuilderProps) {
  const claimedDays = (excludeIdx: number) =>
    rows.reduce<boolean[]>((acc, row, i) => {
      if (i === excludeIdx) return acc;
      return acc.map((v, d) => v || row.days[d]);
    }, Array(7).fill(false));

  const addRow = () =>
    onChange([...rows, { open: "10:00", close: "22:00", days: Array(7).fill(false) }]);

  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx));

  const updateRow = (idx: number, patch: Partial<ScheduleRow>) =>
    onChange(rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const toggleDay = (rowIdx: number, dayIdx: number) => {
    const claimed = claimedDays(rowIdx);
    if (claimed[dayIdx]) return;
    const newDays = rows[rowIdx].days.map((v, i) => (i === dayIdx ? !v : v));
    updateRow(rowIdx, { days: newDays });
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-sm text-gray-500 italic text-center py-6">
          No schedule set. Tap "Add Schedule" to begin.
        </p>
      )}

      {rows.map((row, rowIdx) => {
        const claimed = claimedDays(rowIdx);
        const selectedDays = row.days.filter(Boolean).length;

        return (
          <div
            key={rowIdx}
            className="rounded-xl border border-[#2a2a2b] bg-[#111112] overflow-hidden"
          >
            {/* Row header with delete */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="text-xs text-[#D35400] font-semibold uppercase tracking-wide">
                Schedule {rowIdx + 1}
              </span>
              <button
                onClick={() => removeRow(rowIdx)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Time pickers — side by side, each takes half width */}
            <div className="flex gap-3 px-4 pb-4">
              <TimePicker
                label="Opens"
                value={row.open}
                onChange={(v) => updateRow(rowIdx, { open: v })}
              />
              <div className="flex items-end pb-2 text-gray-600 flex-shrink-0 text-lg">→</div>
              <TimePicker
                label="Closes"
                value={row.close}
                onChange={(v) => updateRow(rowIdx, { close: v })}
              />
            </div>

            {/* Divider */}
            <div className="h-px bg-[#1e1e1f] mx-4" />

            {/* Day pills */}
            <div className="px-4 py-4">
              <p className="text-xs text-gray-500 mb-3">Days</p>
              <div className="flex gap-2 flex-wrap">
                {DAY_LABELS.map((day, dayIdx) => {
                  const isChecked = row.days[dayIdx];
                  const isClaimed = claimed[dayIdx];
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(rowIdx, dayIdx)}
                      disabled={isClaimed}
                      className={cn(
                        "w-10 h-10 rounded-xl text-xs font-bold border transition-all select-none",
                        isChecked
                          ? "bg-[#D35400] border-[#D35400] text-white shadow-md"
                          : isClaimed
                          ? "bg-[#1a1a1b] border-[#1e1e1f] text-gray-700 cursor-not-allowed opacity-40"
                          : "bg-[#1a1a1b] border-[#333] text-gray-400 active:scale-95"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {selectedDays === 0 ? "No days selected" : selectedDays === 7 ? "Every day" : `${selectedDays} day${selectedDays > 1 ? "s" : ""} selected`}
              </p>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRow}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#333] py-4 text-sm text-gray-500 hover:text-white hover:border-[#D35400] transition-colors active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Add Schedule
      </button>
    </div>
  );
}
