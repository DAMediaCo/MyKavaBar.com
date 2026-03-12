import { Link } from "wouter";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";

interface KavaBarCardProps {
  bar: any;
  distance?: number;
}

const FALLBACK_IMAGE = "/kava-bar-default-hero.jpg";

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

  const rating = bar.rating ? Number(bar.rating) : null;
  const displayRating = rating ? rating.toFixed(1) : "N/A";

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
  const hasHappyHours = bar.happyHours && typeof bar.happyHours === 'object' && Object.keys(bar.happyHours).length > 0;
  
  const getHeroImage = () => {
    if (imageError) return FALLBACK_IMAGE;
    if (bar.heroImageUrl) return bar.heroImageUrl;
    if (bar.latestGalleryPhoto) return bar.latestGalleryPhoto;
    if (bar.latest_gallery_photo) return bar.latest_gallery_photo;
    if (bar.hero_image_url) return bar.hero_image_url;
    return FALLBACK_IMAGE;
  };
  const heroImage = getHeroImage();

  const vibes = bar.vibes || bar.amenities || bar.tags || [];
  const displayVibes = Array.isArray(vibes) ? vibes.slice(0, 2) : [];

  return (
    <div className={`bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-lg hover:-translate-y-1 transition-transform duration-200 ${bar.is_sponsored ? 'ring-4 ring-blue-500' : ''}`}>
      <Link href={`/kava-bars/${bar.id}`} className="block">
        <div 
          className="h-36 w-full bg-cover bg-center relative"
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
          
          {hasHappyHours && !comingSoonText && (
            <div className="absolute bottom-3 left-3 bg-purple-600/90 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
              🍹 HAPPY HOUR
            </div>
          )}
          <img 
            src={heroImage} 
            alt="" 
            className="hidden"
            onError={() => setImageError(true)}
          />
        </div>

        <div className="p-3 pt-3">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-lg font-bold text-[#f5f5f5] truncate pr-2">
              {bar.name}
            </h3>
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                rating 
                  ? "bg-amber-400 text-[#121212]" 
                  : "bg-gray-600 text-gray-300"
              }`}
            >
              {displayRating}
            </div>
          </div>

          {displayVibes.length > 0 && (
            <div className="flex gap-1 mb-2 flex-wrap">
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

          <div className="text-gray-400 text-sm mb-2 leading-tight">
            <p className="truncate">{bar.address}</p>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-gray-400 text-sm flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {distance !== undefined 
                  ? `${distance.toFixed(1)} mi` 
                  : "—"
                }
              </span>
            </div>
            <span className="hidden md:inline-block bg-[#D35400] hover:bg-[#E67E22] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              View Details
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
