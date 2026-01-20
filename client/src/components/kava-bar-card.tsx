import { Link } from "wouter";
import { useState } from "react";
import { MapPin } from "lucide-react";
import ShareBar from "./share-bar";
import { format, isBefore, startOfDay } from "date-fns";

interface KavaBarCardProps {
  bar: any;
  distance?: number;
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1617191518003-5c6cfac8e5c4?auto=format&fit=crop&w=1200&q=80";

function isBarOpenNow(hours: any): boolean {
  if (!hours || !Array.isArray(hours)) return false;
  
  const now = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDay = dayNames[now.getDay()];
  const currentTime = now.getHours() * 100 + now.getMinutes();
  
  const todayHours = hours.find((h: string) => h.startsWith(currentDay));
  if (!todayHours) return false;
  
  const timeRange = todayHours.split(": ")[1];
  if (!timeRange || timeRange.toLowerCase() === "closed") return false;
  
  const cleanTimeRange = timeRange.replace(/\s*[\u2013\u2014–-]\s*/g, " - ").trim();
  const [openStr, closeStr] = cleanTimeRange.split(" - ").map((t: string) => t.trim());
  
  if (!openStr || !closeStr) return false;
  
  const parseTime = (time: string): number => {
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
  };
  
  const openTime = parseTime(openStr);
  const closeTime = parseTime(closeStr);
  
  if (openTime === -1 || closeTime === -1) return false;
  
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime < closeTime;
  }
  
  return currentTime >= openTime && currentTime < closeTime;
}

export default function KavaBarCard({ bar, distance }: KavaBarCardProps) {
  const [imageError, setImageError] = useState(false);
  
  if (!bar) return null;

  const rating = Number(bar.rating) || 0;
  const hasRating = rating > 0;
  const displayRating = hasRating ? rating.toFixed(1) : "N/A";

  const rawDateString = bar.grand_opening_date;
  let comingSoonText: string | null = null;

  if (bar.coming_soon) {
    if (rawDateString) {
      const grandOpeningDate = new Date(rawDateString);
      const today = startOfDay(new Date());

      if (!isBefore(grandOpeningDate, today)) {
        comingSoonText = `Coming Soon • ${format(grandOpeningDate, "MMM d")}`;
      } else {
        comingSoonText = null;
      }
    } else {
      comingSoonText = "Coming Soon • TBD";
    }
  }

  const isOpen = isBarOpenNow(bar.hours);
  const heroImage = (!imageError && bar.heroImageUrl) ? bar.heroImageUrl : 
                    (!imageError && bar.googlePhotos?.[0]) ? bar.googlePhotos[0] : 
                    FALLBACK_IMAGE;

  const vibes = bar.vibes || bar.amenities || bar.tags || [];
  const displayVibes = Array.isArray(vibes) ? vibes.slice(0, 2) : [];

  return (
    <div className="bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-lg hover:-translate-y-1 transition-transform duration-200">
      <Link href={`/kava-bars/${bar.id}`} className="block">
        <div 
          className="h-44 w-full bg-cover bg-center relative"
          style={{ backgroundImage: `url('${heroImage}')` }}
        >
          {isOpen && !comingSoonText && (
            <div className="absolute top-3 right-3 bg-green-500/90 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
              OPEN NOW
            </div>
          )}
          {comingSoonText && (
            <div className="absolute top-3 right-3 bg-red-500/90 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
              {comingSoonText}
            </div>
          )}
          {bar.is_sponsored && (
            <div className="absolute top-3 left-3 bg-amber-500/90 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
              SPONSORED
            </div>
          )}
          <img 
            src={heroImage} 
            alt="" 
            className="hidden"
            onError={() => setImageError(true)}
          />
        </div>

        <div className="p-4 pt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-[#f5f5f5] truncate pr-2">
              {bar.name}
            </h3>
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                hasRating 
                  ? "bg-amber-400 text-[#121212]" 
                  : "bg-gray-600 text-gray-300"
              }`}
            >
              {displayRating}
            </div>
          </div>

          {displayVibes.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {displayVibes.map((vibe: string, index: number) => (
                <span 
                  key={index}
                  className="bg-[#333] text-gray-300 text-[0.7rem] px-2.5 py-1 rounded-md uppercase tracking-wider"
                >
                  {vibe}
                </span>
              ))}
            </div>
          )}

          <div className="text-gray-400 text-sm mb-4 leading-relaxed">
            <p className="truncate">{bar.address}</p>
            {bar.phone && (
              <p className="opacity-60">{bar.phone}</p>
            )}
          </div>

          <div className="flex justify-between items-center border-t border-[#333] pt-4">
            <div className="text-gray-400 text-sm flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {distance !== undefined 
                  ? `${distance.toFixed(1)} mi` 
                  : "—"
                }
              </span>
            </div>
            <span className="bg-[#D35400] hover:bg-[#E67E22] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              View Details
            </span>
          </div>
        </div>
      </Link>
      
      <div className="px-4 pb-4">
        <ShareBar bar={bar} />
      </div>
    </div>
  );
}
