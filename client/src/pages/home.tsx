import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useKavaBars } from "@/hooks/use-kava-bars";
import { useLocation, calculateDistance } from "@/hooks/use-location";
import KavaBarCard from "@/components/kava-bar-card";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, MapPin, Map, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

const MapView = lazy(() => import("@/components/map-view"));

type SortOption = "favorite" | "rating" | "distance" | "name";

export default function Home() {
  const [search, setSearch] = useState("");
  const [displayCount, setDisplayCount] = useState(48);
  const { data: kavaBars, isLoading } = useKavaBars();
  const [sortBy, setSortBy] = useState<SortOption>("distance");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [radius] = useState<number>(5000);
  const { user } = useUser();
  const {
    coordinates,
    isLoading: isLoadingLocation,
    requestLocation,
  } = useLocation();

  const { toast } = useToast();

  useEffect(() => {
    const handleLocationRequest = async () => {
      try {
        await requestLocation();
      } catch (error: any) {
        toast({
          title: "Location Error",
          description:
            "Unable to get your location. Some features may be limited.",
          variant: "destructive",
        });
      }
    };

    handleLocationRequest();
  }, [requestLocation, toast]);

  const { data: favoriteBars, isLoading: isLoadingFavorites } = useQuery({
    queryKey: ["favoriteBars"],
    queryFn: async () => {
      const res = await fetch(`/api/favorite-kava-bars`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch favorite bars");
      return res.json();
    },
    enabled: sortBy === "favorite",
  });

  const { data: featuredBars } = useQuery({
    queryKey: ['featuredBars'],
    queryFn: async () => {
      const res = await fetch('/api/kava-bars/featured');
      if (!res.ok) throw new Error('Failed to fetch featured bars');
      return res.json();
    }
  });

  // Sort featured bars by distance from user
  const sortedFeaturedBars = useMemo(() => {
    if (!featuredBars || featuredBars.length === 0) return [];
    if (!coordinates) return featuredBars; // No location, use as-is
    
    return featuredBars
      .map((bar: any) => {
        if (!bar.location?.lat || !bar.location?.lng) return { ...bar, distance: Infinity };
        const dist = calculateDistance(
          coordinates.latitude,
          coordinates.longitude,
          bar.location.lat,
          bar.location.lng
        );
        return { ...bar, distance: dist };
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [featuredBars, coordinates]);

  const featuredBar = sortedFeaturedBars?.[0];

  const melbourneBars = kavaBars?.filter(
    (bar) =>
      bar.address.toLowerCase().includes("melbourne") ||
      bar.address.toLowerCase().includes("palm bay") ||
      bar.address.toLowerCase().includes("satellite beach") ||
      bar.address.toLowerCase().includes("indian harbour") ||
      bar.address.toLowerCase().includes("rockledge") ||
      bar.address.toLowerCase().includes("cocoa") ||
      bar.address.toLowerCase().includes("merritt island"),
  );

  const filteredBars = kavaBars?.filter((bar) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      bar.name.toLowerCase().includes(q) ||
      bar.address.toLowerCase().includes(q) ||
      (bar.city && bar.city.toLowerCase().includes(q)) ||
      (bar.state && bar.state.toLowerCase().includes(q));

    if (coordinates && radius && bar.location?.lat && bar.location?.lng) {
      const distance = calculateDistance(
        coordinates.latitude,
        coordinates.longitude,
        bar.location.lat,
        bar.location.lng,
      );
      return matchesSearch && distance <= radius;
    }

    return matchesSearch;
  });

  let sortedBars = filteredBars
    ?.map((bar) => {
      let distance: number | undefined;

      if (coordinates && bar.location?.lat && bar.location?.lng) {
        distance = calculateDistance(
          coordinates.latitude,
          coordinates.longitude,
          bar.location.lat,
          bar.location.lng,
        );
      }

      return { ...bar, distance };
    })

    .sort((a, b) => {
      switch (sortBy) {
        case "distance":
          return (a.distance ?? Infinity) - (b.distance ?? Infinity);
        case "rating":
          return (b.rating ?? 0) - (a.rating ?? 0);
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

  if (sortBy === "favorite" && favoriteBars) {
    sortedBars = favoriteBars;
  }

  const handleSortChange = (value: string) => {
    setSortBy(value as SortOption);
    if (value === "distance" && !coordinates) {
      requestLocation();
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 animate-pulse">
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-40 bg-muted rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1A1C]" id="home-content">
      <div className="container mx-auto px-4 py-6">
        {/* Simple Search Bar */}
        <div className="mb-6">
          <Input
            placeholder="Search bars..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1E1E1E] border-[#333] text-white placeholder:text-gray-500 rounded-xl h-12"
          />
        </div>

        {/* Mobile: Swipeable featured bars */}
        {sortedFeaturedBars.length > 0 && (
          <div className="md:hidden mb-6 overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 pb-2">
              {sortedFeaturedBars.map((bar: any) => (
                <a
                  key={bar.id}
                  href={`/kava-bars/${bar.id}`}
                  className="min-w-[280px] bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-xl overflow-hidden relative flex-shrink-0"
                >
                  <div className="absolute top-2 left-2 bg-[#D35400] text-white px-2 py-0.5 rounded-full text-xs font-semibold z-10">
                    Featured
                  </div>
                  <img 
                    src={bar.heroImageUrl || '/placeholder.jpg'} 
                    alt={bar.name}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <h3 className="text-white font-bold text-lg">{bar.name}</h3>
                    <p className="text-gray-300 text-xs">{bar.city}, {bar.state}</p>
                    {bar.distance && bar.distance !== Infinity && (
                      <p className="text-gray-400 text-xs mt-1">{bar.distance.toFixed(1)} mi away</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Desktop: Featured Bar - Large Hero Card */}
        {featuredBar && (
          <div className="hidden md:block mb-8">
            <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-2xl overflow-hidden relative">
              <div className="absolute top-4 left-4 bg-[#D35400] text-white px-3 py-1 rounded-full text-sm font-semibold">
                Featured
              </div>
              <img 
                src={featuredBar.heroImageUrl || '/placeholder.jpg'} 
                alt={featuredBar.name}
                className="w-full h-64 object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <h2 className="text-white font-bold text-2xl">{featuredBar.name}</h2>
                <p className="text-gray-300 text-sm">{featuredBar.address}</p>
              </div>
            </div>
            
            {/* Desktop: See All Featured Bars button */}
            {sortedFeaturedBars.length > 1 && (
              <div className="hidden md:flex justify-center mt-4">
                <button
                  onClick={() => {/* TODO: navigate to featured bars page */}}
                  className="bg-[#D35400] hover:bg-[#E67E22] text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  See All Featured Bars
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bar Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedBars?.slice(0, displayCount).flatMap((bar, index) => {
            const cards = [];
            // Add the regular bar
            cards.push(
              <KavaBarCard
                key={bar.id}
                bar={bar}
                distance={bar.distance !== Infinity ? bar.distance : undefined}
              />
            );
            
            // Every 9th position, insert next featured bar (skip the first one already shown at top)
            if ((index + 1) % 9 === 0 && sortedFeaturedBars.length > 0) {
              const featuredIndex = Math.floor((index + 1) / 9);
              const nextFeatured = sortedFeaturedBars[featuredIndex];
              if (nextFeatured) {
                cards.push(
                  <div key={`featured-${nextFeatured.id}`} className="relative">
                    <div className="absolute top-3 left-3 bg-[#D35400] text-white px-3 py-1 rounded-full text-sm font-semibold z-10 shadow-md">
                      ⭐ Featured
                    </div>
                    <KavaBarCard
                      bar={nextFeatured}
                      distance={nextFeatured.distance !== Infinity ? nextFeatured.distance : undefined}
                    />
                  </div>
                );
              }
            }
            
            return cards;
          })}
        </div>

        {/* Load More Button */}
        {sortedBars && sortedBars.length > displayCount && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setDisplayCount(prev => prev + 48)}
              className="bg-[#D35400] hover:bg-[#E67E22] text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Show more bars ({sortedBars.length - displayCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
