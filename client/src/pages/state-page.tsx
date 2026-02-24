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

export default function StatePage() {
  const { param: stateSlug } = useParams<{ param: string }>();

  const stateCode = SLUG_TO_CODE[stateSlug?.toLowerCase() ?? ""];
  const stateName = stateCode ? STATE_NAMES[stateCode] : stateSlug;

  const { data: bars = [], isLoading: barsLoading } = useQuery({
    queryKey: ["location-bars", stateSlug],
    queryFn: () => fetch(`/api/location/states/${stateSlug}/bars`).then(r => r.json()),
    enabled: !!stateSlug,
  });

  const { data: cities = [], isLoading: citiesLoading } = useQuery({
    queryKey: ["location-cities", stateSlug],
    queryFn: () => fetch(`/api/location/states/${stateSlug}/cities`).then(r => r.json()),
    enabled: !!stateSlug,
  });

  const loading = barsLoading || citiesLoading;

  if (loading) return (
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
            <span className="text-white">Kava Bars in {stateName}</span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="h-6 w-6 text-[#D35400]" />
            Kava Bars in {stateName}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">{bars.length} kava bars found</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* City chips */}
        {cities.length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-semibold text-gray-300 mb-3">Browse by City</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {cities
                .sort((a: any, b: any) => b.bar_count - a.bar_count)
                .map((c: any) => (
                  <Link
                    key={c.city_slug}
                    href={`/kava-bars/${stateSlug}/${c.city_slug}`}
                    className="px-3 py-2 bg-[#1E1E1E] border border-[#333] rounded-lg text-sm text-gray-300 hover:border-[#D35400] hover:text-[#D35400] transition-colors text-center truncate"
                  >
                    {c.city} <span className="text-gray-500">({c.bar_count})</span>
                  </Link>
                ))}
            </div>
          </div>
        )}

        {/* Bar grid */}
        {bars.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No kava bars found in {stateName}.</p>
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
