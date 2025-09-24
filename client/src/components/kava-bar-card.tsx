import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin } from "lucide-react";
import ShareBar from "./share-bar";
import { format, isBefore, startOfDay } from "date-fns";

interface KavaBarCardProps {
  bar: any;
  distance?: number;
}

export default function KavaBarCard({ bar, distance }: KavaBarCardProps) {
  if (!bar) return null;

  // Format rating display
  const rating = Number(bar.rating) || 0;
  const hasRating = rating > 0;
  const displayRating = hasRating ? rating.toFixed(1) : "Not Yet Rated";

  // Handling grand opening date display
  const rawDateString = bar.grand_opening_date; // e.g. "2025-09-27"
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
  } else {
    // coming_soon is false; explicitly set null to show no text
    comingSoonText = null;
  }

  return (
    <Card className="hover:bg-accent cursor-pointer transition-colors">
      <Link href={`/kava-bars/${bar.id}`} className="block">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-bold">
              {bar.name}
              {bar.is_sponsored && (
                <Badge variant="secondary" className="ml-2">
                  Sponsored
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Star
                className={`h-4 w-4 ${
                  hasRating
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                }`}
              />
              <span
                className={
                  hasRating ? "text-foreground" : "text-muted-foreground"
                }
              >
                {displayRating}
              </span>
            </div>
          </div>
        </CardHeader>

        {/* Use flex-column with justify-between to maintain spacing */}
        <CardContent className="flex flex-col justify-between min-h-[80px]">
          <div>
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
          </div>
        </CardContent>
      </Link>

      {/* Bottom row with ShareBar and Coming Soon badge */}
      <div className="mt-auto flex items-center justify-between pt-3">
        <div className="flex items-center gap-4">
          <ShareBar bar={bar} />
          {comingSoonText && (
            <Badge
              variant="outline"
              className="text-red-400 border-red-400 whitespace-nowrap"
            >
              {comingSoonText}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
