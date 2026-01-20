import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CustomModal } from "@/components/custom-modal";
import { useLocation } from "wouter";

export function RsvpButton({
  user,
  event,
  barId,
}: {
  user: any;
  event: any;
  barId: number;
}) {
  const [isRsvped, setIsRsvped] = useState(!!event.isRsvped);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/event-rsvp/${event.id}`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Something went wrong");
      }

      return data;
    },
    onSuccess: async (data) => {
      toast({
        title: "RSVP Submitted",
        description: `You've RSVP'd to ${event.title}`,
      });

      setIsRsvped(true);

      await queryClient.invalidateQueries({ queryKey: ["my-rsvps"] });
    },
    onError: (error: any) => {
      toast({
        title: "RSVP Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user) {
    return (
      <CustomModal
        title="Login Required"
        description="Please log in to RSVP to this event."
        confirmButtonText="Log In"
        confirmAction={() => navigate("/auth")}
        trigger={
          <Button size="sm" className="w-full sm:w-auto bg-[#D35400] hover:bg-[#E67E22] text-white">
            RSVP
          </Button>
        }
      />
    );
  }

  if (!user.isPhoneVerified) {
    return (
      <CustomModal
        title="Phone Verification Required"
        description="Please verify your mobile first to RSVP to any event."
        confirmButtonText="Verify Phone"
        confirmAction={() => navigate("/complete-onboarding")}
        trigger={
          <Button size="sm" className="w-full sm:w-auto bg-[#D35400] hover:bg-[#E67E22] text-white">
            RSVP
          </Button>
        }
      />
    );
  }

  return (
    <Button
      size="sm"
      className="w-full sm:w-auto bg-[#D35400] hover:bg-[#E67E22] text-white"
      onClick={() => mutate()}
      disabled={isPending || isRsvped}
    >
      {isPending ? "RSVP'ing..." : isRsvped ? "RSVP'd" : "RSVP"}
    </Button>
  );
}
