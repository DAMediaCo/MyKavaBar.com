import { DateTime } from "luxon";
import { addDays } from "date-fns";

// Eastern Time Zone string (DST-aware)
const EASTERN_ZONE = "America/New_York";

/**
 * Converts a UTC ISO string or Date to Eastern Time (EDT/EST)
 */
export function utcToEastern(input: string | Date): DateTime {
  return DateTime.fromISO(
    typeof input === "string" ? input : input.toISOString(),
    { zone: "utc" },
  ).setZone(EASTERN_ZONE);
}
export function convertEstToUtcDateTime(date: Date, time: string): Date {
  const [hh, mm, ss] = time.split(":").map(Number);
  const local = DateTime.fromObject(
    {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: hh,
      minute: mm,
      second: ss || 0,
    },
    { zone: "America/New_York" },
  );

  return local.toUTC().toJSDate();
}
/**
 * Converts Eastern Time (input ISO string or Date) to UTC DateTime
 * Automatically handles whether it's EST or EDT
 */
export function easternToUtc(input: string | Date): DateTime {
  return DateTime.fromISO(
    typeof input === "string" ? input : input.toISOString(),
    { zone: EASTERN_ZONE },
  ).toUTC();
}

/**
 * Formats a UTC or local ISO string as Eastern Time
 */
export function formatAsEastern(input: string | Date, format = "ff"): string {
  return utcToEastern(input).toFormat(format); // "Aug 1, 2025, 7:00 PM EDT"
}

/**
 * Formats a UTC or local ISO string as UTC
 */
export function formatAsUtc(input: string | Date, format = "ff"): string {
  return DateTime.fromISO(
    typeof input === "string" ? input : input.toISOString(),
    { zone: "utc" },
  ).toFormat(format); // "Aug 1, 2025, 11:00 PM UTC"
}

// Converts EST/EDT to UTC
export function fromEasternToUTC({
  date,
  time,
}: {
  date: Date;
  time: string;
}): Date {
  const [hh, mm, ss] = time.split(":").map(Number);
  const dt = DateTime.fromObject(
    {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: hh,
      minute: mm,
      second: ss || 0,
    },
    { zone: "America/New_York" },
  );
  return dt.toUTC().toJSDate();
}

// Converts UTC date back to EST/EDT
export function fromUTCToEastern(date: Date): DateTime {
  return DateTime.fromJSDate(date).setZone("America/New_York");
}

/**
 * @param dayOfWeek 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
export function getNextOccurrence(dayOfWeek: number): Date {
  const today = new Date();
  const todayDow = today.getDay();
  const diff = (dayOfWeek - todayDow + 7) % 7 || 7;
  return addDays(today, diff);
}
