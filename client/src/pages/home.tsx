import { useState, useEffect } from "react";
import { useKavaBars } from "@/hooks/use-kava-bars";
import { useLocation, calculateDistance } from "@/hooks/use-location";
import KavaBarCard from "@/components/kava-bar-card";
import MapProvider from "@/components/map-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Search, MapPin, List, Crosshair } from "lucide-react";
import SpinningWheel from "@/components/spinning-wheel";
import { useToast } from "@/hooks/use-toast";

type SortOption = "rating" | "distance" | "name";

export default function Home() {
  const [search, setSearch] = useState("");
  const { data: kavaBars, isLoading } = useKavaBars();
  const [view, setView] = useState<"list" | "map">("list");
  const [sortBy, setSortBy] = useState<SortOption>("distance");
  const [radius, setRadius] = useState<number>(500);
  const { coordinates, isLoading: isLoadingLocation, requestLocation } = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const handleLocationRequest = async () => {
      try {
        await requestLocation();
      } catch (error: any) {
        toast({
          title: "Location Error",
          description: "Unable to get your location. Some features may be limited.",
          variant: "destructive",
        });
      }
    };

    handleLocationRequest();
  }, [requestLocation, toast]);

  // Log total number of bars received
  console.log('Total kava bars received:', kavaBars?.length);

  // Log Melbourne area bars for debugging
  const melbourneBars = kavaBars?.filter(bar => 
    bar.address.toLowerCase().includes('melbourne') ||
    bar.address.toLowerCase().includes('palm bay') ||
    bar.address.toLowerCase().includes('satellite beach') ||
    bar.address.toLowerCase().includes('indian harbour') ||
    bar.address.toLowerCase().includes('rockledge') ||
    bar.address.toLowerCase().includes('cocoa') ||
    bar.address.toLowerCase().includes('merritt island')
  );
  console.log('Melbourne area bars found:', melbourneBars?.length);
  melbourneBars?.forEach(bar => {
    console.log(`${bar.name}:`, {
      address: bar.address,
      location: bar.location,
      verificationStatus: bar.verificationStatus
    });
  });

  // Filter bars based on search and location
  const filteredBars = kavaBars?.filter(bar => {
    const matchesSearch =
      !search || // Show all bars when search is empty
      bar.name.toLowerCase().includes(search.toLowerCase()) ||
      bar.address.toLowerCase().includes(search.toLowerCase());

    // In map view, only apply search filter
    if (view === "map") {
      return matchesSearch;
    }

    // For list view, apply distance filter if location is available
    if (coordinates && radius && bar.location?.lat && bar.location?.lng) {
      const distance = calculateDistance(
        coordinates.latitude,
        coordinates.longitude,
        bar.location.lat,
        bar.location.lng
      );
      return matchesSearch && distance <= radius;
    }

    // If no location or missing coordinates, just use search filter
    return matchesSearch;
  });

  // Log filtered results
  console.log('Filtered bars count:', filteredBars?.length);

  const sortedBars = filteredBars?.map(bar => {
    let distance: number | undefined;

    if (coordinates && bar.location?.lat && bar.location?.lng) {
      distance = calculateDistance(
        coordinates.latitude,
        coordinates.longitude,
        bar.location.lat,
        bar.location.lng
      );
    }

    return { ...bar, distance };
  }).sort((a, b) => {
    switch (sortBy) {
      case "distance":
        const distA = a.distance ?? Infinity;
        const distB = b.distance ?? Infinity;
        return distA - distB;
      case "rating":
        const ratingA = a.rating ? parseFloat(a.rating) : 0;
        const ratingB = b.rating ? parseFloat(b.rating) : 0;
        return ratingB - ratingA;
      case "name":
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  // Log sorted results and map markers
  console.log('Sorted bars count:', sortedBars?.length);
  if (view === "map") {
    console.log('Map markers:', sortedBars?.map(bar => ({
      name: bar.name,
      address: bar.address,
      location: bar.location,
      verificationStatus: bar.verificationStatus
    })));
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
    <div className="container mx-auto px-4 py-8" id="home-content">
      <div className="space-y-8">
        <div className="space-y-4">
          {/* SpinningWheel component temporarily removed */}

          <div className="text-center my-3">
            <a href="mailto:info@mykavabar.com" className="text-blue-500 hover:underline">
              Is your Kava Bar missing? Contact at info@mykavabar.com
            </a>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search kava bars..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="distance" disabled={isLoadingLocation}>
                    Distance {isLoadingLocation ? "(Loading...)" : !coordinates ? "(Enable location)" : ""}
                  </SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={view === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setView("list")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "map" ? "default" : "outline"}
                size="icon"
                onClick={() => setView("map")}
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Button
              variant="outline"
              className="gap-2"
              onClick={requestLocation}
              disabled={isLoadingLocation}
            >
              <Crosshair className="h-4 w-4" />
              {isLoadingLocation ? "Getting location..." : coordinates ? "Update location" : "Use my location"}
            </Button>

            {coordinates && (
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Search radius: {radius} miles</span>
                </div>
                <Slider
                  value={[radius]}
                  onValueChange={(value) => setRadius(value[0])}
                  min={1}
                  max={view === "map" ? 3000 : 500} // Larger radius for map view
                  step={view === "map" ? 10 : 5}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>

        {view === "list" ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedBars?.map((bar) => (
                <KavaBarCard
                  key={bar.id}
                  bar={bar}
                  distance={bar.distance !== Infinity ? bar.distance : undefined}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[600px] rounded-lg overflow-hidden">
            <MapProvider
              showAllBars={true}
              zoom={coordinates ? 11 : 10}
              height="600px"
            />
          </div>
        )}
      </div>
    </div>
  );
}