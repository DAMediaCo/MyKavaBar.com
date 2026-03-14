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
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

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

  const [, navigate] = useLocation();

  const buttonClass = `
    relative overflow-hidden
    flex items-center gap-2.5 px-5 py-2.5
    rounded-2xl font-semibold text-sm
    text-white
    border border-white/20
    bg-white/10 backdrop-blur-md
    shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_24px_rgba(0,0,0,0.4)]
    hover:bg-white/15 hover:border-white/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_32px_rgba(0,0,0,0.5)]
    active:scale-95
    transition-all duration-200
    cursor-pointer
  `.trim().replace(/\s+/g, ' ');

  if (!user) {
    return (
      <button className={buttonClass} onClick={() => navigate("/auth")}>
        {/* Glass shimmer layer */}
        <span className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
        <span className="text-lg">🛂</span>
        <span>Stamp Your Passport</span>
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={buttonClass}>
          <span className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
          <span className="text-lg">🛂</span>
          <span>Stamp Your Passport</span>
        </button>
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
            className="w-full bg-[#D35400] hover:bg-[#E67E22] text-white font-bold rounded-xl py-6 text-base"
          >
            {isGettingLocation || checkinMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isGettingLocation ? "Getting location..." : "Checking in..."}
              </>
            ) : (
              <>🛂 Stamp It!</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
