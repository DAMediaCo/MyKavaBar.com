import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin } from "lucide-react";
import type { KavaBar } from "@db/schema";
import ShareBar from "./share-bar";

interface KavaBarCardProps {
  bar: KavaBar;
  distance?: number;
}

export default function KavaBarCard({ bar, distance }: KavaBarCardProps) {
  if (!bar) return null;

  // Log bar data for debugging
  console.log(`Rendering bar ${bar.name}:`, {
    rating: bar.rating,
    ratingType: typeof bar.rating,
    address: bar.address,
    placeId: bar.placeId
  });

  // Format rating display
  const rating = Number(bar.rating) || 0;
  const hasRating = rating > 0;
  const displayRating = hasRating ? rating.toFixed(1) : 'Not Yet Rated';

  return (
    <Card className="hover:bg-accent cursor-pointer transition-colors">
      <Link href={`/kava-bars/${bar.id}`} className="block">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-bold">
              {bar.name}
              {bar.isSponsored && (
                <Badge variant="secondary" className="ml-2">
                  Sponsored
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Star 
                className={`h-4 w-4 ${
                  hasRating 
                    ? 'fill-yellow-400 text-yellow-400' 
                    : 'text-muted-foreground'
                }`} 
              />
              <span className={hasRating ? 'text-foreground' : 'text-muted-foreground'}>
                {displayRating}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{bar.address}</p>
          {bar.phone && (
            <p className="text-sm text-muted-foreground mt-1">{bar.phone}</p>
          )}
          {distance !== undefined && (
            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{distance.toFixed(1)} miles away</span>
            </div>
          )}
        </CardContent>
      </Link>
      <div className="mt-4">
        <ShareBar bar={bar} />
      </div>
    </Card>
  );
}