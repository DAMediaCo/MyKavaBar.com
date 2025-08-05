import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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

  return (
    <Button
      size="sm"
      className="w-full sm:w-auto"
      onClick={() => mutate()}
      disabled={isPending || isRsvped}
    >
      {isPending ? "RSVP'ing..." : isRsvped ? "RSVP’d" : "RSVP"}
    </Button>
  );
}
