import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type RsvpedEvent = {
  rsvpId: number;
  eventTitle: string;
  eventDate: string;
  eventDateTime: string;
  barName: string;
  barId: number;
};

export default function MyRsvpsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"future" | "past">("future");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRsvp, setSelectedRsvp] = useState<RsvpedEvent | null>(null);

  const {
    data: rsvps = [],
    isLoading,
    isError,
    error,
  } = useQuery<RsvpedEvent[]>({
    queryKey: ["my-rsvps"],
    queryFn: async () => {
      const res = await fetch("/api/my-rsvps", {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load RSVPs");
      }
      return data.data;
    },
  });

  const unrsvpMutation = useMutation({
    mutationFn: async (rsvpId: number) => {
      const res = await fetch(`/api/event-rsvp/${rsvpId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to un-RSVP");
      }
      return data;
    },
    onSuccess:async () => {
      toast({
        title: "RSVP Cancelled",
        description: `You have un-RSVP’d from "${selectedRsvp?.eventTitle}".`,
      });
      await queryClient.invalidateQueries({ queryKey: ["my-rsvps"] });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDialogOpen(false);
      setSelectedRsvp(null);
    },
  });

  const now = new Date();
  const futureRsvps = rsvps
    .filter((event) => new Date(event.eventDateTime) >= now)
    .sort(
      (a, b) =>
        new Date(a.eventDateTime).getTime() -
        new Date(b.eventDateTime).getTime(),
    );

  const pastRsvps = rsvps
    .filter((event) => new Date(event.eventDateTime) < now)
    .sort(
      (a, b) =>
        new Date(b.eventDateTime).getTime() -
        new Date(a.eventDateTime).getTime(),
    );

  const activeRsvps = tab === "future" ? futureRsvps : pastRsvps;

  const openUnrsvpDialog = (event: RsvpedEvent) => {
    setSelectedRsvp(event);
    setDialogOpen(true);
  };

  const handleUnrsvp = () => {
    if (selectedRsvp) {
      unrsvpMutation.mutate(selectedRsvp.rsvpId);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-6">
      <h1 className="text-3xl font-bold text-center">My RSVPs</h1>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <p className="text-center text-destructive">
          {(error as Error).message}
        </p>
      ) : rsvps.length === 0 ? (
        <div className="text-center text-muted-foreground mt-10">
          <p className="text-lg">You haven’t RSVP’d to any events yet.</p>
        </div>
      ) : (
        <>
          <Tabs
            value={tab}
            onValueChange={(val) => setTab(val as "future" | "past")}
            className="w-full"
          >
            <TabsList className="w-full flex justify-center gap-4 mb-6">
              <TabsTrigger value="future" className="w-32">
                Future RSVPs
              </TabsTrigger>
              <TabsTrigger value="past" className="w-32">
                Past RSVPs
              </TabsTrigger>
            </TabsList>

            <TabsContent value={tab}>
              {activeRsvps.length === 0 ? (
                <div className="text-center text-muted-foreground mt-10">
                  <p className="text-lg">No {tab} RSVPs found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeRsvps.map((event) => (
                    <Card key={event.rsvpId}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                          <div>
                            <h2 className="text-xl font-semibold">
                              {event.eventTitle}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                              {new Date(event.eventDateTime).toLocaleString(
                                "en-US",
                                {
                                  timeZone: "America/New_York",
                                  dateStyle: "full",
                                  timeStyle: "short",
                                },
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Hosted by: {event.barName}
                            </p>
                          </div>
                          {tab === "past" ? (
                            <Button variant="outline" size="sm" disabled>
                              RSVP’d
                            </Button>
                          ) : (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => openUnrsvpDialog(event)}
                              disabled={
                                unrsvpMutation.isPending &&
                                selectedRsvp?.rsvpId === event.rsvpId
                              }
                            >
                              {unrsvpMutation.isPending &&
                              selectedRsvp?.rsvpId === event.rsvpId
                                ? "Cancelling..."
                                : "Un-RSVP"}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel RSVP?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to un-RSVP from{" "}
                <strong>{selectedRsvp?.eventTitle}</strong>?
              </p>
              <DialogFooter className="mt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!unrsvpMutation.isPending) setDialogOpen(false);
                  }}
                  disabled={unrsvpMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleUnrsvp}
                  disabled={unrsvpMutation.isPending}
                >
                  {unrsvpMutation.isPending ? "Cancelling..." : "Yes, Un-RSVP"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
