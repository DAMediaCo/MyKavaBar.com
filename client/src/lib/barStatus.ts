/**
 * barStatus.ts — SHARED UTILITY
 * Works in both React (web browser) and React Native (iOS).
 * Uses only Intl APIs — no platform-specific dependencies.
 *
 * Source of truth: ~/clawd/shared/barStatus.ts
 * Copies:
 *   ~/clawd/mykavabar-mobile/utils/barStatus.ts
 *   ~/clawd/MykavaBar-source/MykavaBar/client/src/lib/barStatus.ts
 */

// State → IANA timezone (primary timezone for each state)
export const STATE_TZ: Record<string, string> = {
  AL: 'America/Chicago',    AK: 'America/Anchorage', AZ: 'America/Phoenix',
  AR: 'America/Chicago',    CA: 'America/Los_Angeles', CO: 'America/Denver',
  CT: 'America/New_York',   DE: 'America/New_York',   FL: 'America/New_York',
  GA: 'America/New_York',   HI: 'Pacific/Honolulu',   ID: 'America/Denver',
  IL: 'America/Chicago',    IN: 'America/Indiana/Indianapolis',
  IA: 'America/Chicago',    KS: 'America/Chicago',    KY: 'America/New_York',
  LA: 'America/Chicago',    ME: 'America/New_York',   MD: 'America/New_York',
  MA: 'America/New_York',   MI: 'America/Detroit',    MN: 'America/Chicago',
  MS: 'America/Chicago',    MO: 'America/Chicago',    MT: 'America/Denver',
  NE: 'America/Chicago',    NV: 'America/Los_Angeles', NH: 'America/New_York',
  NJ: 'America/New_York',   NM: 'America/Denver',     NY: 'America/New_York',
  NC: 'America/New_York',   ND: 'America/Chicago',    OH: 'America/New_York',
  OK: 'America/Chicago',    OR: 'America/Los_Angeles', PA: 'America/New_York',
  RI: 'America/New_York',   SC: 'America/New_York',   SD: 'America/Chicago',
  TN: 'America/Chicago',    TX: 'America/Chicago',    UT: 'America/Denver',
  VT: 'America/New_York',   VA: 'America/New_York',   WA: 'America/Los_Angeles',
  WV: 'America/New_York',   WI: 'America/Chicago',    WY: 'America/Denver',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORANGE = '#D35400';

export function getTz(state?: string | null): string {
  if (!state) return 'America/New_York';
  return STATE_TZ[state.trim().toUpperCase()] || 'America/New_York';
}

/** Get current time parts in a given IANA timezone */
export function nowInTz(tz: string): { dayName: string; totalMins: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric', minute: 'numeric', hour12: false,
    weekday: 'long',
  }).formatToParts(now);
  const dayName = parts.find(p => p.type === 'weekday')?.value || '';
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  return { dayName, totalMins: hour * 60 + minute };
}

/** Parse time string → minutes since midnight.
 *  Handles: "3:00 PM", "12:00 AM", "10:00" (24h), "01:00" (24h) */
export function parseTimeTo24Mins(timeStr: string): number {
  const s = timeStr.trim();
  // AM/PM format: "3:00 PM", "12:00 AM"
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const min = parseInt(ampm[2]);
    const period = ampm[3].toUpperCase();
    if (period === 'AM') { if (h === 12) h = 0; }
    else { if (h !== 12) h += 12; }
    return h * 60 + min;
  }
  // 24h format: "10:00", "01:00", "23:30" — no AM/PM suffix
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    return parseInt(h24[1]) * 60 + parseInt(h24[2]);
  }
  return -1;
}

/** Format minutes-since-midnight → "3:00 PM" */
export function minsTo12h(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Parse hours string "Monday: 9:00 AM – 11:00 PM" → {open, close} in mins */
function parseHoursString(str: string): { open: number; close: number } | null {
  const match = str.match(/:\s*(.+?)\s*[–\-]\s*(.+)/);
  if (!match) return null;
  const openStr = match[1].trim();
  const closeStr = match[2].trim();
  if (openStr.toLowerCase().includes('closed') || closeStr.toLowerCase().includes('closed')) return null;
  const open = parseTimeTo24Mins(openStr);
  let close = parseTimeTo24Mins(closeStr);
  if (open < 0 || close < 0) return null;
  if (close < open) close += 24 * 60; // overnight
  return { open, close };
}

export interface BarOpenStatus {
  isOpen: boolean;
  label: string;
  color: string;         // hex color
  is24h?: boolean;       // true for always-open bars
  closesAt?: string;     // e.g. "11:00 PM" — useful for web tooltip
  opensAt?: string;      // e.g. "3:00 PM"
}

export interface HappyHourStatus {
  isActive: boolean;
  label: string | null;
  color: string;
}

/** Normalize happy hours: handles both `{happyHours:{...}}` and flat `{Friday:[...]}` */
function normalizeHH(raw: any): Record<string, Array<{ start: string; startPeriod: string; end: string; endPeriod: string }>> | null {
  if (!raw) return null;
  if (raw.happyHours) return raw.happyHours;
  if (DAY_NAMES.some(d => raw[d])) return raw;
  return null;
}

export function getOpenStatus(
  hours: string[] | null | undefined,
  state?: string | null
): BarOpenStatus {
  if (!hours || hours.length === 0) {
    return { isOpen: false, label: '', color: 'rgba(255,255,255,0.3)' };
  }
  const tz = getTz(state);
  const { dayName, totalMins } = nowInTz(tz);

  const todayStr = hours.find(h => h.startsWith(dayName));
  if (!todayStr) return { isOpen: false, label: 'Closed today', color: '#ef4444' };

  const parsed = parseHoursString(todayStr);
  if (!parsed) return { isOpen: false, label: 'Closed', color: '#ef4444' };

  const { open, close } = parsed;

  // 24/7 detection: open=00:00, close=23:59 (1439 mins) or 24:00 (1440)
  const is24h = open === 0 && close >= 1439;
  if (is24h) {
    return { isOpen: true, label: '🕐 Open 24 Hours', color: '#22c55e', is24h: true };
  }

  if (totalMins >= open && totalMins < close) {
    const closeMins = close % (24 * 60);
    return { isOpen: true, label: `Open · closes ${minsTo12h(closeMins)}`, color: '#22c55e', closesAt: minsTo12h(closeMins) };
  }

  if (totalMins < open) {
    return { isOpen: false, label: `Opens ${minsTo12h(open)}`, color: '#ef4444', opensAt: minsTo12h(open) };
  }

  // Past closing — check tomorrow
  const tomorrowIdx = (DAY_NAMES.indexOf(dayName) + 1) % 7;
  const tomorrowName = DAY_NAMES[tomorrowIdx];
  const tomorrowStr = hours.find(h => h.startsWith(tomorrowName));
  if (tomorrowStr) {
    const tp = parseHoursString(tomorrowStr);
    if (tp) return { isOpen: false, label: `Opens ${minsTo12h(tp.open)} tomorrow`, color: '#ef4444', opensAt: minsTo12h(tp.open) };
  }

  return { isOpen: false, label: 'Closed', color: '#ef4444' };
}

export function getHappyHourStatus(
  happyHoursRaw: any,
  state?: string | null
): HappyHourStatus {
  const hh = normalizeHH(happyHoursRaw);
  if (!hh) return { isActive: false, label: null, color: ORANGE };

  const tz = getTz(state);
  const { dayName, totalMins } = nowInTz(tz);

  const todayHH = hh[dayName];
  if (!todayHH || todayHH.length === 0) return { isActive: false, label: null, color: ORANGE };

  for (const block of todayHH) {
    const openStr = `${block.start} ${block.startPeriod}`;
    const closeStr = `${block.end} ${block.endPeriod}`;
    let open = parseTimeTo24Mins(openStr);
    let close = parseTimeTo24Mins(closeStr);
    if (open < 0 || close < 0) continue;
    if (close < open) close += 24 * 60;

    if (totalMins >= open && totalMins < close) {
      const closeMins = close % (24 * 60);
      return { isActive: true, label: `🍹 Happy Hour til ${minsTo12h(closeMins)}`, color: ORANGE };
    }
    if (totalMins < open) {
      return { isActive: false, label: `Happy Hour starts ${minsTo12h(open)}`, color: ORANGE };
    }
  }

  // All of today's slots are past — find next upcoming slot (up to 6 days ahead)
  for (let i = 1; i <= 6; i++) {
    const nextIdx = (DAY_NAMES.indexOf(dayName) + i) % 7;
    const nextDay = DAY_NAMES[nextIdx];
    const nextSlots = hh[nextDay];
    if (!nextSlots || nextSlots.length === 0) continue;
    const slot = nextSlots[0];
    const openStr = `${slot.start} ${slot.startPeriod}`;
    const open = parseTimeTo24Mins(openStr);
    if (open < 0) continue;
    const label = i === 1 ? 'tomorrow' : nextDay;
    return { isActive: false, label: `🍹 Happy Hour ${label} ${minsTo12h(open)}`, color: ORANGE };
  }

  return { isActive: false, label: null, color: ORANGE };
}
