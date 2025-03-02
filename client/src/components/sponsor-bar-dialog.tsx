import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { KavaBar } from "@db/schema";
import { queryClient } from "@/lib/queryClient";

interface SponsorBarDialogProps {
  bar: KavaBar;
  trigger: React.ReactNode;
}

export default function SponsorBarDialog({
  bar,
  trigger,
}: SponsorBarDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleSponsorship = async () => {
    try {
      setIsLoading(true);

      // Create payment link
      const response = await fetch(`/api/kava-bars/${bar.id}/sponsor`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const { success } = await response.json();

      if (!success) {
        throw new Error("Failed to sponsor kava bar");
      }

      setIsOpen(false);
      // Invalidate the query
      queryClient.invalidateQueries({ queryKey: [`/api/kava-bars/${bar.id}`] });
      toast({
        title: "Success",
        description: "Kava bar sponsored successfully",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sponsor Your Bar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>
            Get premium placement for your bar! Sponsored listings appear at the
            top of search results, helping you reach more customers.
          </p>
          <div className="rounded-lg border p-4 bg-card">
            <h3 className="font-medium mb-2">Premium Features:</h3>
            <ul className="space-y-2 text-sm">
              <li>• Top placement in search results</li>
              <li>• "Sponsored" badge for increased visibility</li>
              <li>• Priority in map view</li>
              <li>• Monthly subscription - cancel anytime</li>
            </ul>
            <div className="mt-4 text-lg font-bold">$159/month</div>
          </div>
          <Button
            className="w-full"
            onClick={handleSponsorship}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Proceed to Checkout"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
