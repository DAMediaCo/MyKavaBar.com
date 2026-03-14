import { Link } from "wouter";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { getOpenStatus, getHappyHourStatus } from "@/lib/barStatus";

export type CardSize = "small" | "wide" | "hero";

interface KavaBarCardProps {
  bar: any;
  distance?: number;
  size?: CardSize;
}

const FALLBACK_IMAGE = "/kava-bar-default-hero.jpg";

function stateFromAddress(address?: string): string | null {
  if (!address) return null;
  const m = address.match(/,\s*([A-Z]{2})\s*\d{5}/);
  return m ? m[1] : null;
}

function toWeekdayText(hours: any): string[] | null {
  if (!hours) return null;
  if (Array.isArray(hours)) return hours;
  if (Array.isArray(hours.weekday_text)) return hours.weekday_text;
  return null;
}

/** Seeded random (stable per bar id) */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

/** Assign a bento size. Featured/sponsored bars get boosted odds for larger sizes. */
export function getCardSize(bar: any): CardSize {
  const r = seededRandom(bar.id ?? 0);
  if (bar.is_featured || bar.is_sponsored) {
    if (r < 0.35) return "hero";
    if (r < 0.70) return "wide";
    return "small";
  }
  if (r < 0.07) return "hero";
  if (r < 0.22) return "wide";
  return "small";
}

export default function KavaBarCard({ bar, distance, size = "small" }: KavaBarCardProps) {
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

  const state = stateFromAddress(bar.address);
  const weekdayText = toWeekdayText(bar.hours);
  const openStatus = getOpenStatus(weekdayText, state);
  const happyHoursRaw = bar.happy_hours ?? bar.happyHours ?? null;
  const hhStatus = getHappyHourStatus(happyHoursRaw, state);

  const getHeroImage = () => {
    if (imageError) return FALLBACK_IMAGE;
    return bar.heroImageUrl || bar.latestGalleryPhoto || bar.latest_gallery_photo || bar.hero_image_url || FALLBACK_IMAGE;
  };

  const vibes = bar.vibes || bar.amenities || bar.tags || [];
  const displayVibes = Array.isArray(vibes) ? vibes.slice(0, size === "hero" ? 4 : 2) : [];

  // Image height by size
  const imgHeight = size === "hero" ? "h-52" : size === "wide" ? "h-40" : "h-36";

  return (
    <div className={`group h-full bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-lg hover:-translate-y-1 transition-transform duration-200 ${bar.is_sponsored ? "ring-2 ring-[#D35400]" : ""}`}>
      <Link href={`/kava-bars/${bar.id}`} className="flex flex-col h-full">
        {/* Hero image — object-cover ensures any aspect ratio fills the box cleanly */}
        <div className={`${imgHeight} w-full relative flex-shrink-0 overflow-hidden bg-[#111]`}>
          <img
            src={getHeroImage()}
            alt={bar.name}
            className="w-full h-full object-cover object-[center_30%] transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
          {/* Always-on gradient — unifies look across all image styles/ratios */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

          {!comingSoonText && weekdayText && weekdayText.length > 0 && (
            <div className={`absolute top-3 right-3 text-white text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${openStatus.isOpen ? "bg-green-500/90" : "bg-gray-700/90"}`}>
              {openStatus.isOpen ? "OPEN" : "CLOSED"}
            </div>
          )}
          {comingSoonText && (
            <div className="absolute top-3 right-3 bg-red-500/90 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
              {comingSoonText}
            </div>
          )}
          {(bar.is_featured || bar.is_sponsored) && (
            <div className="absolute top-3 left-3 bg-[#D35400]/90 text-white text-[0.6rem] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm uppercase tracking-wider">
              Featured
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-3 flex flex-col flex-1">
          {/* Name + rating */}
          <div className="flex justify-between items-start mb-1 gap-2">
            <h3 className={`font-bold text-[#f5f5f5] leading-tight ${size === "hero" ? "text-lg" : "text-base"} line-clamp-2`}>
              {bar.name}
            </h3>
            <div className={`rounded-full flex items-center justify-center font-bold shrink-0 ${size === "hero" ? "w-9 h-9 text-sm" : "w-8 h-8 text-xs"} ${rating ? "bg-amber-400 text-[#121212]" : "bg-gray-600 text-gray-300"}`}>
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
          <div className="flex items-center gap-1 text-gray-500 text-xs mb-2.5 min-w-0">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{bar.address}</span>
            {distance !== undefined && (
              <span className="shrink-0 text-gray-600 ml-1">• {distance.toFixed(1)} mi</span>
            )}
          </div>

          {/* Footer: hours left | happy hour right */}
          <div className="mt-auto flex justify-between items-end gap-2">
            {weekdayText && weekdayText.length > 0 ? (
              <div className="flex flex-col leading-tight">
                <span className={`text-xs font-bold ${openStatus.isOpen ? "text-green-400" : "text-gray-400"}`}>
                  {openStatus.isOpen ? "Open" : "Closed"}
                </span>
                {openStatus.label && (
                  <span className="text-[0.65rem] text-gray-500">
                    {openStatus.label.replace(/^Open · /i, "").replace(/^Opens /i, "Opens ")}
                  </span>
                )}
              </div>
            ) : (
              <div />
            )}

            {hhStatus.label && (
              <div className="flex flex-col items-end leading-tight">
                <span className={`text-xs font-bold ${hhStatus.isActive ? "text-purple-400" : "text-gray-500"}`}>
                  {hhStatus.label}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
