import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { MapPin, ChevronRight, Loader2 } from "lucide-react";
import KavaBarCard from "@/components/kava-bar-card";

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",
  KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",
  MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",
  MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
  NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",
  OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"
};

const SLUG_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([code, name]) => [name.toLowerCase().replace(/\s+/g, "-"), code])
);

export default function CityPage() {
  const { param: stateSlug, citySlug } = useParams<{ param: string; citySlug: string }>();

  const stateCode = SLUG_TO_CODE[stateSlug?.toLowerCase() ?? ""];
  const stateName = stateCode ? STATE_NAMES[stateCode] : stateSlug;
  const cityDisplay = (citySlug ?? "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const { data: bars = [], isLoading } = useQuery({
    queryKey: ["location-city-bars", stateSlug, citySlug],
    queryFn: () => fetch(`/api/location/states/${stateSlug}/cities/${citySlug}/bars`).then(r => r.json()),
    enabled: !!stateSlug && !!citySlug,
  });

  if (isLoading) return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center">
      <Loader2 className="animate-spin h-8 w-8 text-[#D35400]" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Header */}
      <div className="bg-[#1A1A1A] border-b border-[#333] px-4 py-4">
        <div className="container mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-3">
            <Link href="/" className="hover:text-[#D35400] transition-colors">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/kava-bars/${stateSlug}`} className="hover:text-[#D35400] transition-colors">
              {stateName}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-white">{cityDisplay}</span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="h-6 w-6 text-[#D35400]" />
            Kava Bars in {cityDisplay}, {stateName}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">{bars.length} kava bars found</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {bars.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No kava bars found in {cityDisplay}.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bars.map((bar: any) => (
              <KavaBarCard key={bar.id} bar={bar} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
