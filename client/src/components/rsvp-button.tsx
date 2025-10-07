import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CustomModal } from "@/components/custom-modal"; // Adjust import as needed
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
        description: `You've RSVP’d to ${event.title}`,
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

  if (!user) return null;
  const onRsvpClick = () => {
    if (!user.isPhoneVerified) {
      // Show modal by clicking trigger button
      setShowModal(true);
      return;
    }
    mutate();
  };

  // Using React state to control modal open is not needed here since CustomModal handles it internally through trigger button

  return (
    <>
      {user.isPhoneVerified ? (
        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => {
            if (user.isPhoneVerified) {
              mutate();
            }
          }}
          disabled={isPending || isRsvped}
        >
          {isPending ? "RSVP'ing..." : isRsvped ? "RSVP’d" : "RSVP"}
        </Button>
      ) : (
        <CustomModal
          title="Phone Verification Required"
          description="Please verify your mobile first to RSVP any event."
          confirmButtonText="Verify phone"
          confirmAction={() => navigate("/complete-onboarding")}
          trigger={
            <Button size="sm" className="w-full sm:w-auto">
              RSVP
            </Button>
          }
        />
      )}
    </>
  );
}
