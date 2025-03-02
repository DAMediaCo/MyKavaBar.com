import { useState, useEffect } from "react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Check } from "lucide-react";
import { format } from "date-fns";

interface VerificationRequest {
  id: number;
  barId: number;
  requesterName: string;
  barName: string;
  phoneNumber: string;
  status: string;
  createdAt: string;
  bar: {
    name: string;
    address: string;
  };
}

interface VerificationCodeState {
  [key: number]: string;
}

export default function VerificationRequests() {
  const { user } = useUser();
  const { toast } = useToast();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState<number | null>(null);
  const [verificationCodes, setVerificationCodes] = useState<VerificationCodeState>({});
  const [copiedCode, setCopiedCode] = useState<number | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    try {
      const response = await fetch("/api/admin/verification-requests", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setRequests(data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  const copyToClipboard = async (code: string, requestId: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(requestId);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy code to clipboard",
      });
    }
  };

  async function generateCode(barId: number, requestId: number) {
    try {
      setIsGenerating(requestId);

      // First generate the verification code
      const codeResponse = await fetch(`/api/admin/verification-codes/${barId}`, {
        method: "POST",
        credentials: "include",
      });

      if (!codeResponse.ok) {
        throw new Error(await codeResponse.text());
      }

      const codeData = await codeResponse.json();

      // Then update the request status
      const updateResponse = await fetch(`/api/admin/verification-requests/${requestId}/approve`, {
        method: "POST",
        credentials: "include",
      });

      if (!updateResponse.ok) {
        throw new Error(await updateResponse.text());
      }

      // Store the verification code in component state
      setVerificationCodes(prev => ({
        ...prev,
        [requestId]: codeData.code
      }));

      toast({
        title: "Success",
        description: "Verification code generated and request approved!",
      });

      // Refresh the requests list
      fetchRequests();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsGenerating(null);
    }
  }

  if (!user?.isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">Admin access required.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Verification Requests</h1>

      <div className="space-y-4">
        {requests.map((request) => (
          <Card key={request.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{request.barName}</span>
                <Badge variant={request.status === "approved" ? "secondary" : "default"}>
                  {request.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <div className="text-sm">
                    <span className="font-medium">Requester:</span> {request.requesterName}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Phone:</span> {request.phoneNumber}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Bar Address:</span> {request.bar.address}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Requested on: {format(new Date(request.createdAt), "PP")}
                  </div>
                  {verificationCodes[request.id] && (
                    <div className="mt-4">
                      <div className="text-sm font-medium mb-2">Verification Code:</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-muted rounded font-mono text-sm">
                          {verificationCodes[request.id]}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(verificationCodes[request.id], request.id)}
                        >
                          {copiedCode === request.id ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {request.status === "pending" && (
                  <Button
                    onClick={() => generateCode(request.barId, request.id)}
                    disabled={isGenerating === request.id}
                  >
                    {isGenerating === request.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Code...
                      </>
                    ) : (
                      "Approve & Generate Code"
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {requests.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No verification requests found.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}