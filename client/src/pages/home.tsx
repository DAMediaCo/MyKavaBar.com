import { useState, useEffect } from "react";
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
import { Search, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

type SortOption = "favorite" | "rating" | "distance" | "name";

export default function Home() {
  const [search, setSearch] = useState("");
  const { data: kavaBars, isLoading } = useKavaBars();
  const [sortBy, setSortBy] = useState<SortOption>("distance");
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
    const matchesSearch =
      !search ||
      bar.name.toLowerCase().includes(search.toLowerCase()) ||
      bar.address.toLowerCase().includes(search.toLowerCase());

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
    <div className="min-h-screen bg-[#121212]" id="home-content">
      {/* Sticky Search Header */}
      <div className="sticky top-0 z-20 bg-[#121212] pt-4 pb-2 px-4 shadow-md">
        {/* Search Input with GPS Icon */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, city, or state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-12 bg-[#1E1E1E] border-[#333] text-white placeholder:text-gray-500 rounded-xl h-12"
          />
          <button
            onClick={requestLocation}
            disabled={isLoadingLocation}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
              coordinates 
                ? "text-[#D35400] hover:bg-[#333]" 
                : "text-gray-400 hover:text-[#D35400] hover:bg-[#333]"
            } ${isLoadingLocation ? "animate-pulse" : ""}`}
            title={coordinates ? "Location enabled" : "Enable location"}
          >
            <MapPin className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Chips Row */}
        <div className="flex gap-3 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="bg-[#1E1E1E] border border-[#333] rounded-full px-4 py-1 text-sm text-gray-300 h-8 w-auto min-w-[120px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent className="bg-[#1E1E1E] border-[#333]">
              {user && <SelectItem value="favorite">Favorites</SelectItem>}
              <SelectItem value="rating">Rating</SelectItem>
              <SelectItem value="distance" disabled={isLoadingLocation}>
                Distance
              </SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>

          {coordinates && (
            <span className="bg-[#1E1E1E] border border-[#333] rounded-full px-4 py-1 text-sm text-gray-300 flex items-center gap-2 whitespace-nowrap">
              <MapPin className="h-3 w-3 text-[#D35400]" />
              Near you
            </span>
          )}
        </div>
      </div>

      {/* Bar Listings */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedBars?.map((bar) => (
            <KavaBarCard
              key={bar.id}
              bar={bar}
              distance={
                bar.distance !== Infinity ? bar.distance : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
