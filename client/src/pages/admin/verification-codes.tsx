import { useState, useEffect } from "react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy } from "lucide-react";
import { format } from "date-fns";
import type { KavaBar } from "@db/schema";

interface VerificationCode {
  id: number;
  barId: number;
  code: string;
  isUsed: boolean;
  expiresAt: string;
  createdAt: string;
  bar: {
    name: string;
    address: string;
  } | null;
}

export default function VerificationCodes() {
  const { user } = useUser();
  const { toast } = useToast();
  const [codes, setCodes] = useState<VerificationCode[]>([]);
  const [unclaimedBars, setUnclaimedBars] = useState<KavaBar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingBarId, setGeneratingBarId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      console.log("Fetching verification codes and unclaimed bars...");
      const [codesResponse, barsResponse] = await Promise.all([
        fetch("/api/admin/verification-codes", {
          credentials: "include",
        }),
        fetch("/api/owner/bars", {
          credentials: "include",
        }),
      ]);

      if (!codesResponse.ok || !barsResponse.ok) {
        throw new Error("Failed to fetch data");
      }

      const codesData = await codesResponse.json();
      const barsData = await barsResponse.json();

      console.log("Unclaimed bars:", barsData.unclaimedBars);
      setCodes(codesData);
      setUnclaimedBars(barsData.unclaimedBars || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function generateCode(barId: number) {
    try {
      setIsGenerating(true);
      setGeneratingBarId(barId);
      const response = await fetch(`/api/admin/verification-codes/${barId}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate code");
      }

      const data = await response.json();

      toast({
        title: "Success",
        description: "Verification code generated!",
      });

      // Refresh the data
      fetchData();
    } catch (error: any) {
      console.error("Error generating code:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate verification code",
      });
    } finally {
      setIsGenerating(false);
      setGeneratingBarId(null);
    }
  }

  async function copyCodeToClipboard(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "Copied!",
        description: "Verification code copied to clipboard",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy code to clipboard",
      });
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
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-3xl font-bold">Verification Codes</h1>

      {/* Generate New Codes Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Generate New Code</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {unclaimedBars && unclaimedBars.length > 0 ? (
            unclaimedBars.map((bar) => (
              <Card key={bar.id}>
                <CardHeader>
                  <CardTitle className="text-base">{bar.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {bar.address}
                  </p>
                  <Button
                    onClick={() => generateCode(bar.id)}
                    disabled={isGenerating && generatingBarId === bar.id}
                    className="w-full"
                  >
                    {isGenerating && generatingBarId === bar.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate Code"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">
                  No unclaimed bars available for code generation.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Existing Codes Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Existing Codes</h2>
        <div className="space-y-4">
          {codes.length > 0 ? (
            codes.map((code) => (
              <Card key={code.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{code.bar?.name || "Bar Unavailable"}</span>
                    <Badge variant={code.isUsed ? "secondary" : "default"}>
                      {code.isUsed ? "Used" : "Active"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {code.bar?.address || "Address not available"}
                    </p>
                    <div className="relative">
                      <div className="font-mono bg-muted p-2 rounded">
                        {code.code}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={() => copyCodeToClipboard(code.code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Expires: {format(new Date(code.expiresAt), "PP")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">No verification codes found.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}