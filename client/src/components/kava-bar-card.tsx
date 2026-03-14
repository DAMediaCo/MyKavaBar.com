import { Link } from "wouter";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { getOpenStatus, getHappyHourStatus } from "@/lib/barStatus";

interface KavaBarCardProps {
  bar: any;
  distance?: number;
}

const FALLBACK_IMAGE = "/kava-bar-default-hero.jpg";

/** Extract 2-letter state code from address string e.g. "123 Main St, Tampa, FL 33601" */
function stateFromAddress(address?: string): string | null {
  if (!address) return null;
  const m = address.match(/,\s*([A-Z]{2})\s*\d{5}/);
  return m ? m[1] : null;
}

/** Normalise hours from API into string[] for barStatus.ts */
function toWeekdayText(hours: any): string[] | null {
  if (!hours) return null;
  if (Array.isArray(hours)) return hours;
  if (Array.isArray(hours.weekday_text)) return hours.weekday_text;
  return null;
}

export default function KavaBarCard({ bar, distance }: KavaBarCardProps) {
  const [imageError, setImageError] = useState(false);

  if (!bar) return null;

  const rating = bar.rating ? Number(bar.rating) : null;
  const displayRating = rating ? rating.toFixed(1) : "N/A";

  // Coming soon logic
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

  // Use barStatus.ts — timezone-aware, cross-midnight-safe
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
  const displayVibes = Array.isArray(vibes) ? vibes.slice(0, 2) : [];

  return (
    <div className={`bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-lg hover:-translate-y-1 transition-transform duration-200 ${bar.is_sponsored ? "ring-2 ring-[#D35400]" : ""}`}>
      <Link href={`/kava-bars/${bar.id}`} className="block">
        {/* Hero image */}
        <div
          className="h-36 w-full bg-cover bg-center relative"
          style={{ backgroundImage: `url('${getHeroImage()}')` }}
        >
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
            {weekdayText && weekdayText.length > 0 ? (
              <div className="flex flex-col leading-tight">
                <span className={`text-xs font-bold ${openStatus.isOpen ? "text-green-400" : "text-gray-400"}`}>
                  {openStatus.isOpen ? "Open" : "Closed"}
                </span>
                {openStatus.label && (
                  <span className="text-[0.65rem] text-gray-500">{openStatus.label.replace(/^Open · /i, "").replace(/^Opens /i, "Opens ")}</span>
                )}
              </div>
            ) : (
              <div />
            )}

            {/* Happy hour */}
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
