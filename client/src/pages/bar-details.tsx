import { useParams } from "wouter";
import { useKavaBar } from "@/hooks/use-kava-bars";
import { useUser } from "@/hooks/use-user";
import SponsorBarDialog from "@/components/sponsor-bar-dialog";
import ClaimBarDialog from "@/components/claim-bar-dialog";
import ShareBar from "@/components/share-bar";
import BarPhotoGallery from "@/components/bar-photo-gallery";
import BarEvents from "@/components/bar-events";
import ReviewList from "@/components/reviews/review-list";
import ReviewForm from "@/components/reviews/review-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Phone,
  Clock,
  Sparkles,
  User,
  AlertCircle,
  Copy,
} from "lucide-react";
import MapProvider from "@/components/map-provider";
import { useToast } from "@/hooks/use-toast";
import BarStaff from "@/components/bar-staff";
import KavatenderCheckin from "@/components/kavatender-checkin";
import BarOwnershipControls from "@/components/admin/bar-ownership-controls";
import { useQuery } from "@tanstack/react-query";
import CheckInCarousel from "@/components/check-in-carousal";
import { format, parseISO } from "date-fns"; // Updated import

interface Hours {
  weekday_text: string[];
  open_now: boolean;
  periods: Array<{
    close: { day: number; time: string };
    open: { day: number; time: string };
  }>;
  hours_available: boolean;
}

// Update the HoursDisplay component to handle all edge cases
const HoursDisplay = ({
  hours,
  businessStatus,
}: {
  hours: Hours | null;
  businessStatus?: string;
}) => {
  // Add debug logging
  console.log("Hours Display:", {
    hours,
    businessStatus,
    hasWeekdayText: hours?.weekday_text?.length > 0,
  });

  // If business is permanently closed, show that first
  if (businessStatus === "PERMANENTLY_CLOSED") {
    return (
      <div className="flex items-start gap-2">
        <Clock className="h-4 w-4 mt-1 shrink-0" />
        <div className="text-sm text-destructive font-medium">
          Permanently Closed
        </div>
      </div>
    );
  }

  // If hours is null or not available, show not available message
  if (!hours || !hours.weekday_text || hours.weekday_text.length === 0) {
    return (
      <div className="flex items-start gap-2">
        <Clock className="h-4 w-4 mt-1 shrink-0" />
        <div className="text-sm text-muted-foreground">Hours not available</div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <Clock className="h-4 w-4 mt-1 shrink-0" />
      <div className="space-y-1">
        {hours.weekday_text.map((text, index) => (
          <div key={index} className="text-sm text-foreground">
            {text}
          </div>
        ))}
      </div>
    </div>
  );
};

function getApiUrl(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export default function BarDetails() {
  const { id } = useParams();
  const { data: bar, isLoading, error } = useKavaBar(id || "");
  const { user } = useUser();
  const { toast } = useToast();

  const { data: checkIns } = useQuery<any[]>({
    queryKey: [`checkIns/${id}`],
    queryFn: async () => {
      try {
        const response = await fetch(getApiUrl(`/api/bars/${id}/check-ins`), {
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error fetching check-ins:`, errorText);
          throw new Error(errorText);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error fetching check-ins:", error);
        throw error;
      }
    },
  });

  console.log("Checkins : ", checkIns);

  // Add debug logging
  console.log("Bar details:", {
    hasHours: !!bar?.hours,
    hoursData: bar?.hours,
    businessStatus: bar?.businessStatus,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-40 bg-muted rounded" />
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !bar) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          Error Loading Bar Details
        </h2>
        <p className="text-muted-foreground">
          {error ? error.toString() : "Bar not found"}
        </p>
      </div>
    );
  }

  const isOwner = user?.id === bar.ownerId;
  const canClaim = user && !bar.ownerId;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(bar.address);
      toast({
        title: "Address Copied",
        description: "The address has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to Copy",
        description: "Could not copy the address to clipboard.",
      });
    }
  };

  return (
    <div className="space-y-6 p-4" id="bar-details-content">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {bar.name}
            {bar.isSponsored && <Badge variant="secondary">Certified</Badge>}
            {bar.businessStatus === "PERMANENTLY_CLOSED" && (
              <Badge variant="destructive">Permanently Closed</Badge>
            )}
          </h1>
          {user &&
            (user.role === "kavatender" ||
              user.role === "admin" ||
              user.role === "bar_owner") && (
              <div className="mb-4">
                <KavatenderCheckin barId={bar.id} />
              </div>
            )}

          {checkIns && checkIns.length > 0 && (
            <CheckInCarousel checkIns={checkIns} />
          )}
        </div>

        <div className="flex gap-2">
          <ShareBar bar={bar} />
          {canClaim && (
            <ClaimBarDialog
              bar={bar}
              trigger={
                <Button variant="outline" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Claim This Bar
                </Button>
              }
            />
          )}
          {isOwner && !bar.isSponsored && (
            <SponsorBarDialog
              bar={bar}
              trigger={
                <Button className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Get Certified
                </Button>
              }
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column - Public Information */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-2 group">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-1 shrink-0" />
                  <span>{bar.address}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={copyAddress}
                >
                  <Copy className="h-4 w-4" />
                  <span className="sr-only">Copy address</span>
                </Button>
              </div>
              {bar.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{bar.phone}</span>
                </div>
              )}
              <HoursDisplay
                hours={bar.hours}
                businessStatus={bar.businessStatus}
              />
            </CardContent>
          </Card>

          {/* Events section - visible to all users */}
          <BarEvents barId={bar.id} ownerId={bar.ownerId} />

          {/* Reviews section - visible to all users */}
          <Card>
            <CardHeader>
              <CardTitle>Reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {user && <ReviewForm barId={bar.id} />}
              <ReviewList barId={bar.id} />
            </CardContent>
          </Card>
        </div>

        {/* Right column - Authenticated Content */}
        <div className="space-y-6">
          {user?.isAdmin && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Admin Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <BarOwnershipControls bar={bar} />
              </CardContent>
            </Card>
          )}

          {/* Show photo gallery to all users */}
          <BarPhotoGallery bar={bar} />
        </div>
      </div>

      {bar.location && (
        <div className="h-[400px] rounded-lg overflow-hidden border border-border">
          <MapProvider barId={bar.id} zoom={15} height="400px" />
        </div>
      )}
    </div>
  );
}