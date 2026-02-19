import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { MapPin, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface PassportCheckinButtonProps {
  barId: number;
  barName: string;
}

export function PassportCheckinButton({
  barId,
  barName,
}: PassportCheckinButtonProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const checkinMutation = useMutation({
    mutationFn: async ({
      lat,
      lng,
      notes,
    }: {
      lat: number;
      lng: number;
      notes?: string;
    }) => {
      const response = await fetch("/api/passport/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barId,
          lat,
          lng,
          notes,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Check-in failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Passport stamped! 🛂🎉",
        description: `New stamp: ${barName}! ${data.stats.uniqueBars} unique bars visited.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/passport"] });
      setOpen(false);
      setNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Check-in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCheckin = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to check in at kava bars",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);

    if (!navigator.geolocation) {
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support geolocation",
        variant: "destructive",
      });
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsGettingLocation(false);
        checkinMutation.mutate({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          notes,
        });
      },
      (error) => {
        setIsGettingLocation(false);
        toast({
          title: "Location access denied",
          description:
            "Please allow location access to check in at this bar",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  if (!user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 border-[#333] text-gray-300 hover:bg-[#252525]">
          🛂
          Stamp Your Passport
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stamp Your Passport at {barName}</DialogTitle>
          <DialogDescription>
            Earn a stamp in your Kava Passport! You must be within 200 meters
            of the bar to check in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="notes"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Notes (optional)
            </label>
            <Textarea
              id="notes"
              placeholder="How was your visit? What did you try?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleCheckin}
            disabled={isGettingLocation || checkinMutation.isPending}
            className="w-full"
          >
            {isGettingLocation || checkinMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isGettingLocation ? "Getting location..." : "Checking in..."}
              </>
            ) : (
              <>
                🛂
                Stamp It!
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
