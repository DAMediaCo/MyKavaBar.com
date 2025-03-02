import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import type { KavaBar } from "@db/schema";

interface ClaimBarDialogProps {
  bar: KavaBar;
  trigger: React.ReactNode;
}

export default function ClaimBarDialog({ bar, trigger }: ClaimBarDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({
    requesterName: "",
    barName: bar.name,
    phoneNumber: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const handleClaim = async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/kava-bars/${bar.id}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ verificationCode }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Success",
        description: "You are now the owner of this Kava bar!",
      });

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/kava-bars/${bar.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/kava-bars"] });

      setIsOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestSubmit = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to request verification",
      });
      return;
    }

    try {
      setIsRequesting(true);

      const response = await fetch(`/api/verification-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...requestForm,
          barId: bar.id,
          requesterId: user.id, // Add the user's ID to the request
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Success",
        description: "Your verification request has been submitted. We'll review it shortly.",
      });

      setIsOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim This Kava Bar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!showRequestForm ? (
            <>
              <p>
                To claim ownership of this Kava bar, please enter the verification code
                provided to you as the business owner.
              </p>
              <div className="space-y-2">
                <Input
                  placeholder="Enter verification code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Don't have a code?{" "}
                  <button 
                    className="underline" 
                    onClick={() => setShowRequestForm(true)}
                  >
                    Request a verification code
                  </button>
                </p>
              </div>
              <Button 
                className="w-full" 
                onClick={handleClaim}
                disabled={isLoading || !verificationCode}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Claim Ownership"
                )}
              </Button>
            </>
          ) : (
            <>
              <p>
                Please provide your information to request a verification code.
                Our team will review your request and contact you shortly.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Your Name</label>
                  <Input
                    placeholder="Enter your full name"
                    value={requestForm.requesterName}
                    onChange={(e) => setRequestForm(prev => ({
                      ...prev,
                      requesterName: e.target.value
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bar Name</label>
                  <Input
                    value={requestForm.barName}
                    onChange={(e) => setRequestForm(prev => ({
                      ...prev,
                      barName: e.target.value
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input
                    placeholder="Enter your phone number"
                    value={requestForm.phoneNumber}
                    onChange={(e) => setRequestForm(prev => ({
                      ...prev,
                      phoneNumber: e.target.value
                    }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRequestForm(false)}
                >
                  Back
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleRequestSubmit}
                  disabled={isRequesting || !requestForm.requesterName || !requestForm.barName || !requestForm.phoneNumber}
                >
                  {isRequesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}