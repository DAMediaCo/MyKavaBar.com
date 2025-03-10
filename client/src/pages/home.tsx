import { useState } from "react";
import { useKavaBars } from "@/hooks/use-kava-bars";
import { useLocationContext } from "@/contexts/location-context";
import KavaBarCard from "@/components/kava-bar-card";
import MapProvider from "../components/map-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LocationSelector from "@/components/location-selector";

// Helper function to calculate distance between two coordinates
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  function toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type SortOption = "rating" | "distance" | "name";

export default function Home() {
  const [search, setSearch] = useState("");
  const { data: kavaBars, isLoading } = useKavaBars();
  const [view, setView] = useState<"list" | "map">("list");
  const [sortBy, setSortBy] = useState<SortOption>("distance");
  const location = useLocationContext();
  const { toast } = useToast();

  // No longer auto-request location on page load
  // Location will be user-initiated through the LocationSelector component

  // Log total number of bars received
  console.log('Total kava bars received:', kavaBars?.length);

  // Add detailed debugging for the map view
  console.log('Current view mode:', view);
  
  // Check location format for all bars to debug mapping issues
  const locationStats = {
    total: kavaBars?.length || 0,
    withLocation: 0,
    withValidLocation: 0,
    withoutLocation: 0,
    stringLocations: 0,
    objectLocations: 0
  };
  
  kavaBars?.forEach(bar => {
    if (bar.location) {
      locationStats.withLocation++;
      if (typeof bar.location === 'string') {
        locationStats.stringLocations++;
        try {
          const parsed = JSON.parse(bar.location);
          if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            locationStats.withValidLocation++;
          }
        } catch (e) {
          // Invalid JSON string
        }
      } else if (typeof bar.location === 'object') {
        locationStats.objectLocations++;
        if (bar.location.lat && bar.location.lng) {
          locationStats.withValidLocation++;
        }
      }
    } else {
      locationStats.withoutLocation++;
    }
  });
  
  console.log('Bar location statistics:', locationStats);

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
    if (location.coordinates && location.radius && bar.location?.lat && bar.location?.lng) {
      const distance = calculateDistance(
        location.coordinates.latitude,
        location.coordinates.longitude,
        bar.location.lat,
        bar.location.lng
      );
      return matchesSearch && distance <= location.radius;
    }

    // If no location or missing coordinates, just use search filter
    return matchesSearch;
  });

  // Log filtered results
  console.log('Filtered bars count:', filteredBars?.length);

  const sortedBars = filteredBars?.map(bar => {
    let distance: number | undefined;

    if (location.coordinates && bar.location?.lat && bar.location?.lng) {
      distance = calculateDistance(
        location.coordinates.latitude,
        location.coordinates.longitude,
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
        const ratingA = parseFloat(a.rating.toString()) || 0;
        const ratingB = parseFloat(b.rating.toString()) || 0;
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
    if (value === "distance" && !location.coordinates) {
      location.requestLocation();
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
                  <SelectItem value="distance" disabled={location.isLoading}>
                    Distance {location.isLoading ? "(Loading...)" : !location.coordinates ? "(Enable location)" : ""}
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

          {/* New user-initiated location selector component */}
          <LocationSelector />
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
            {/* If we have bars data, show the map */}
            {sortedBars && sortedBars.length > 0 ? (
              <MapProvider
                zoom={location.coordinates ? 11 : 10}
                height="600px"
                center={location.coordinates ? {
                  lat: location.coordinates.latitude, 
                  lng: location.coordinates.longitude
                } : undefined}
                bars={sortedBars}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-muted/10">
                <div className="text-center p-6">
                  <h3 className="text-lg font-medium">Loading Map Data</h3>
                  <p className="text-muted-foreground mt-2">
                    Please wait while we prepare the map view...
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}