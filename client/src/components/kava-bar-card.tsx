import { Link } from "wouter";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";

interface KavaBarCardProps {
  bar: any;
  distance?: number;
}

const FALLBACK_IMAGE = "/kava-bar-default-hero.jpg";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseTime12(time: string): number {
  const match = time.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
  if (!match) return -1;
  let [, hour, minute = "00", period] = match;
  let h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  if (period) {
    period = period.toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
  }
  return h * 100 + m;
}

function fmt12(raw: string): string {
  // "10:00 PM" → "10 PM", "9:00 AM" → "9 AM", "10:30 PM" → "10:30 PM"
  const match = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return raw;
  const [, h, m, p] = match;
  return m === "00" ? `${h} ${p.toUpperCase()}` : `${h}:${m} ${p.toUpperCase()}`;
}

/** Returns open/closed status + time label for the card footer */
function getHoursStatus(hours: any): { isOpen: boolean; label: string; sub: string } | null {
  // hours can be an array of strings OR an object with weekday_text array
  const weekdayText: string[] = Array.isArray(hours)
    ? hours
    : hours?.weekday_text ?? [];

  if (!weekdayText.length) return null;

  const now = new Date();
  const currentDay = DAY_NAMES[now.getDay()];
  const currentTime = now.getHours() * 100 + now.getMinutes();

  const todayStr = weekdayText.find((h: string) => h.startsWith(currentDay));
  if (!todayStr) return null;

  const timeRange = todayStr.split(": ")[1]?.trim();
  if (!timeRange || timeRange.toLowerCase() === "closed") {
    // Find next open day
    for (let i = 1; i <= 7; i++) {
      const nextDay = DAY_NAMES[(now.getDay() + i) % 7];
      const nextStr = weekdayText.find((h: string) => h.startsWith(nextDay));
      if (!nextStr) continue;
      const nextRange = nextStr.split(": ")[1]?.trim();
      if (!nextRange || nextRange.toLowerCase() === "closed") continue;
      const clean = nextRange.replace(/\s*[\u2013\u2014–-]\s*/g, " - ");
      const openStr = clean.split(" - ")[0]?.trim();
      if (!openStr) continue;
      const label = i === 1 ? "Tomorrow" : nextDay.slice(0, 3);
      return { isOpen: false, label: "Closed", sub: `Opens ${label} ${fmt12(openStr)}` };
    }
    return { isOpen: false, label: "Closed Today", sub: "" };
  }

  const clean = timeRange.replace(/\s*[\u2013\u2014–-]\s*/g, " - ").trim();
  const [openStr, closeStr] = clean.split(" - ").map((t: string) => t.trim());
  if (!openStr || !closeStr) return null;

  const openTime = parseTime12(openStr);
  const closeTime = parseTime12(closeStr);
  if (openTime === -1 || closeTime === -1) return null;

  const crossesMidnight = closeTime < openTime;
  const isOpen = crossesMidnight
    ? currentTime >= openTime || currentTime < closeTime
    : currentTime >= openTime && currentTime < closeTime;

  if (isOpen) {
    return { isOpen: true, label: "Open", sub: `Closes ${fmt12(closeStr)}` };
  } else if (currentTime < openTime) {
    return { isOpen: false, label: "Closed", sub: `Opens ${fmt12(openStr)}` };
  } else {
    // Already closed for today — show tomorrow's open time if available
    for (let i = 1; i <= 7; i++) {
      const nextDay = DAY_NAMES[(now.getDay() + i) % 7];
      const nextStr = weekdayText.find((h: string) => h.startsWith(nextDay));
      if (!nextStr) continue;
      const nextRange = nextStr.split(": ")[1]?.trim();
      if (!nextRange || nextRange.toLowerCase() === "closed") continue;
      const nextClean = nextRange.replace(/\s*[\u2013\u2014–-]\s*/g, " - ");
      const nextOpen = nextClean.split(" - ")[0]?.trim();
      if (!nextOpen) continue;
      const label = i === 1 ? "Tomorrow" : nextDay.slice(0, 3);
      return { isOpen: false, label: "Closed", sub: `Opens ${label} ${fmt12(nextOpen)}` };
    }
    return { isOpen: false, label: "Closed", sub: "" };
  }
}

/** Returns happy hour status for the card footer */
function getHappyHourStatus(happyHours: any): { active: boolean; label: string } | null {
  if (!happyHours || typeof happyHours !== "object") return null;

  const now = new Date();
  const currentDay = DAY_NAMES[now.getDay()];
  const currentTime = now.getHours() * 100 + now.getMinutes();

  const todaySlots: any[] = happyHours[currentDay] ?? [];

  for (const slot of todaySlots) {
    // slot: { start: "4:00", startPeriod: "PM", end: "7:00", endPeriod: "PM" }
    const openStr = `${slot.start} ${slot.startPeriod}`;
    const closeStr = `${slot.end} ${slot.endPeriod}`;
    const openTime = parseTime12(openStr);
    const closeTime = parseTime12(closeStr);
    if (openTime === -1 || closeTime === -1) continue;

    if (currentTime >= openTime && currentTime < closeTime) {
      return { active: true, label: `🍹 Happy Hour til ${fmt12(closeStr)}` };
    }
    if (currentTime < openTime) {
      return { active: false, label: `🍹 HH at ${fmt12(openStr)}` };
    }
  }

  // Check upcoming days (next 6)
  for (let i = 1; i <= 6; i++) {
    const nextDay = DAY_NAMES[(now.getDay() + i) % 7];
    const slots: any[] = happyHours[nextDay] ?? [];
    if (slots.length === 0) continue;
    const slot = slots[0];
    const openStr = `${slot.start} ${slot.startPeriod}`;
    const label = i === 1 ? "Tomorrow" : nextDay.slice(0, 3);
    return { active: false, label: `🍹 HH ${label} ${fmt12(openStr)}` };
  }

  return null;
}

export default function KavaBarCard({ bar, distance }: KavaBarCardProps) {
  const [imageError, setImageError] = useState(false);

  if (!bar) return null;

  const rating = bar.rating ? Number(bar.rating) : null;
  const displayRating = rating ? rating.toFixed(1) : "N/A";

  const rawDateString = bar.grand_opening_date;
  let comingSoonText: string | null = null;

  if (bar.coming_soon) {
    if (rawDateString) {
      const grandOpeningDate = new Date(rawDateString);
      const today = startOfDay(new Date());
      comingSoonText = !isBefore(grandOpeningDate, today)
        ? `Coming Soon • ${format(grandOpeningDate, "MMM d")}`
        : null;
    } else {
      comingSoonText = "Coming Soon • TBD";
    }
  }

  const hoursStatus = getHoursStatus(bar.hours);
  // API returns snake_case happy_hours from k.*, try both
  const happyHoursData = bar.happy_hours ?? bar.happyHours ?? null;
  const hhStatus = getHappyHourStatus(happyHoursData);

  const getHeroImage = () => {
    if (imageError) return FALLBACK_IMAGE;
    return bar.heroImageUrl || bar.latestGalleryPhoto || bar.latest_gallery_photo || bar.hero_image_url || FALLBACK_IMAGE;
  };

  const vibes = bar.vibes || bar.amenities || bar.tags || [];
  const displayVibes = Array.isArray(vibes) ? vibes.slice(0, 2) : [];

  return (
    <div className={`bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-lg hover:-translate-y-1 transition-transform duration-200 ${bar.is_sponsored ? "ring-2 ring-[#D35400]" : ""}`}>
      <Link href={`/kava-bars/${bar.id}`} className="block">
        {/* Hero image */}
        <div
          className="h-36 w-full bg-cover bg-center relative"
          style={{ backgroundImage: `url('${getHeroImage()}')` }}
        >
          {/* Open/closed badge top-right */}
          {!comingSoonText && hoursStatus && (
            <div className={`absolute top-3 right-3 text-white text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${hoursStatus.isOpen ? "bg-green-500/90" : "bg-gray-700/90"}`}>
              {hoursStatus.isOpen ? "OPEN" : "CLOSED"}
            </div>
          )}
          {comingSoonText && (
            <div className="absolute top-3 right-3 bg-red-500/90 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
              {comingSoonText}
            </div>
          )}
          <img src={getHeroImage()} alt="" className="hidden" onError={() => setImageError(true)} />
        </div>

        {/* Card body */}
        <div className="p-3">
          {/* Name + rating */}
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-base font-bold text-[#f5f5f5] truncate pr-2">{bar.name}</h3>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${rating ? "bg-amber-400 text-[#121212]" : "bg-gray-600 text-gray-300"}`}>
              {displayRating}
            </div>
          </div>

          {/* Vibes */}
          {displayVibes.length > 0 && (
            <div className="flex gap-1 mb-1.5 flex-wrap">
              {displayVibes.map((vibe: string, i: number) => (
                <span key={i} className="bg-[#333] text-gray-300 text-[0.65rem] px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {vibe}
                </span>
              ))}
            </div>
          )}

          {/* Address + distance */}
          <div className="flex items-center gap-1 text-gray-500 text-xs mb-2.5 truncate">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{bar.address}</span>
            {distance !== undefined && (
              <span className="shrink-0 text-gray-600">• {distance.toFixed(1)} mi</span>
            )}
          </div>

          {/* Footer: hours left | happy hour right */}
          <div className="flex justify-between items-end gap-2 min-h-[32px]">
            {/* Open/closed */}
            {hoursStatus ? (
              <div className="flex flex-col leading-tight">
                <span className={`text-xs font-bold ${hoursStatus.isOpen ? "text-green-400" : "text-gray-400"}`}>
                  {hoursStatus.label}
                </span>
                {hoursStatus.sub && (
                  <span className="text-[0.65rem] text-gray-500">{hoursStatus.sub}</span>
                )}
              </div>
            ) : (
              <div />
            )}

            {/* Happy hour */}
            {hhStatus ? (
              <div className="flex flex-col items-end leading-tight">
                <span className={`text-xs font-bold ${hhStatus.active ? "text-purple-400" : "text-gray-500"}`}>
                  {hhStatus.label}
                </span>
              </div>
            ) : (
              <span className="hidden md:inline-block bg-[#D35400] hover:bg-[#E67E22] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0">
                View Details
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
