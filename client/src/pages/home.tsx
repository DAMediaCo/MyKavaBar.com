import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useKavaBars } from "@/hooks/use-kava-bars";
import { useLocation, calculateDistance } from "@/hooks/use-location";
import KavaBarCard, { getCardSize } from "@/components/kava-bar-card";
import { useQuery } from "@tanstack/react-query";

import { Search, Map, List, SlidersHorizontal } from "lucide-react";
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
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
        {/* Unified search bar: search | sort | list/map — all in one pill */}
        <div className="mb-4 flex items-center bg-[#1E1E1E] border border-[#333] rounded-xl h-12 px-3 gap-2 w-full min-w-0">
          {/* Search icon + input */}
          <Search className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <input
            placeholder="Search bars..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-white placeholder:text-gray-500 outline-none text-sm"
          />

          {/* Divider */}
          <div className="w-px h-6 bg-[#444] flex-shrink-0" />

          {/* Sort — native select for reliability across devices */}
          <div className="relative flex-shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400 absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortOption);
                if (e.target.value === "distance" && !coordinates) requestLocation();
              }}
              className="appearance-none bg-transparent text-gray-300 text-xs font-semibold pl-5 pr-1 outline-none cursor-pointer"
            >
              <option value="distance" className="bg-[#1E1E1E]">Nearest</option>
              <option value="rating"   className="bg-[#1E1E1E]">Top Rated</option>
              <option value="name"     className="bg-[#1E1E1E]">A–Z</option>
              {user && <option value="favorite" className="bg-[#1E1E1E]">Favorites</option>}
            </select>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-[#444] flex-shrink-0" />

          {/* List/Map toggle */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "list" ? "bg-[#D35400] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "map" ? "bg-[#D35400] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <Map className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Map</span>
            </button>
          </div>
        </div>

        {/* Mobile: Swipeable featured bars - Full Bleed */}
        {sortedFeaturedBars.length > 0 && (
          <div className="md:hidden mb-6 overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 pb-2 px-4">
              {sortedFeaturedBars.map((bar: any) => (
                <a key={bar.id} href={`/kava-bars/${bar.id}`} className="relative min-w-[75vw] h-40 flex-shrink-0 rounded-xl overflow-hidden block">
                  {/* Full Bleed Image */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url('${bar.heroImageUrl || bar.hero_image_url || bar.latestGalleryPhoto || bar.latest_gallery_photo || '/kava-bar-default-hero.jpg'}')` }}
                  />
                  {/* Featured Tag - Top Left */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className="bg-[#D35400] text-white px-2 py-0.5 rounded-full text-xs font-semibold">⭐ Featured</span>
                  </div>
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  {/* Content - Rating only at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    {bar.rating && (
                      <span className="bg-black/50 text-white px-2 py-0.5 rounded-full text-xs">⭐ {bar.rating}</span>
                    )}
                    <h3 className="text-white font-bold text-lg leading-tight">{bar.name}</h3>
                    <p className="text-gray-300 text-xs mt-1">
                      {bar.address || `${bar.city}, ${bar.state}`}
                      {bar.distance !== Infinity && bar.distance !== null && (
                        <span className="ml-1">• {bar.distance?.toFixed(1)} mi</span>
                      )}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Desktop: Featured Bars - Horizontal Scroll, 2x Size, No Crop */}
        {sortedFeaturedBars.length > 0 && (
          <div className="hidden md:block mb-8">
            <p className="text-[#D35400] text-xs font-bold uppercase tracking-widest mb-3">⭐ Featured</p>
            <div className="relative">
              {/* Left Arrow */}
              <button
                onClick={() => document.getElementById('featured-scroll')?.scrollBy({ left: -400, behavior: 'smooth' })}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full shadow-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              
              {/* Scroll Container */}
              <div id="featured-scroll" className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide px-12">
                {sortedFeaturedBars.map((bar: any) => (
                  <a 
                    key={bar.id} 
                    href={`/kava-bars/${bar.id}`} 
                    className="relative min-w-[calc(50%-12px)] lg:min-w-[calc(33.333%-16px)] h-80 flex-shrink-0 rounded-2xl overflow-hidden block"
                  >
                    {/* Image */}
                    <div 
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url('${bar.heroImageUrl || bar.hero_image_url || bar.latestGalleryPhoto || bar.latest_gallery_photo || '/kava-bar-default-hero.jpg'}')` }}
                    />
                    {/* Featured Tag - Top Left */}
                    <div className="absolute top-4 left-4 z-10">
                      <span className="bg-[#D35400] text-white px-3 py-1 rounded-full text-sm font-semibold">⭐ Featured</span>
                    </div>
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    {/* Content - Rating only at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      {bar.rating && (
                        <span className="bg-black/50 text-white px-2 py-0.5 rounded-full text-xs">⭐ {bar.rating}</span>
                      )}
                      <h3 className="text-white font-bold text-xl mb-1 mt-2">{bar.name}</h3>
                      <p className="text-gray-300 text-sm">
                        {bar.address || `${bar.city}, ${bar.state}`}
                        {bar.distance !== Infinity && bar.distance !== null && (
                          <span className="ml-2">• {bar.distance?.toFixed(1)} mi</span>
                        )}
                      </p>
                    </div>
                  </a>
                ))}
              </div>

              {/* Right Arrow */}
              <button
                onClick={() => document.getElementById('featured-scroll')?.scrollBy({ left: 400, behavior: 'smooth' })}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full shadow-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Bar Grid or Map View */}
        {viewMode === "list" ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ gridAutoFlow: "dense" }}>
            {sortedBars?.slice(0, displayCount).map((bar) => {
              const size = getCardSize(bar);
              return (
                <div
                  key={bar.id}
                  className={size === "small" ? "col-span-1" : "col-span-2"}
                >
                  <KavaBarCard
                    bar={bar}
                    size={size}
                    distance={bar.distance !== Infinity ? bar.distance : undefined}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-[450px] md:h-[600px] rounded-xl overflow-hidden">
            {isLoadingLocation ? (
              <div className="flex items-center justify-center h-full text-gray-400">Loading map...</div>
            ) : (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">Loading map...</div>}>
                <MapView
                  bars={sortedBars || []}
                  userLocation={coordinates ? { lat: coordinates.latitude, lng: coordinates.longitude } : undefined}
                  center={coordinates ? { lat: coordinates.latitude, lng: coordinates.longitude } : undefined}
                  zoom={coordinates ? 10 : 4}
                />
              </Suspense>
            )}
          </div>
        )}

        {/* Load More Button — list view only */}
        {viewMode === "list" && sortedBars && sortedBars.length > displayCount && (
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
