import { useEffect, useState, useMemo } from "react";
import { useUser } from "@/hooks/use-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Building2, AlertCircle, Search } from "lucide-react";
import type { KavaBar } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import NotificationSettings from "@/components/owner/notification-settings";

export default function OwnerDashboard() {
  const { user } = useUser();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [ownedBars, setOwnedBars] = useState<KavaBar[]>([]);
  const [unclaimedBars, setUnclaimedBars] = useState<KavaBar[]>([]);
  const [search, setSearch] = useState("");

  const filteredOwnedBars = useMemo(() => {
    if (!search.trim()) return ownedBars;
    const searchLower = search.toLowerCase();
    return ownedBars.filter(
      (bar) =>
        bar.name.toLowerCase().includes(searchLower) ||
        bar.address.toLowerCase().includes(searchLower)
    );
  }, [ownedBars, search]);

  const filteredUnclaimedBars = useMemo(() => {
    if (!search.trim()) return unclaimedBars;
    const searchLower = search.toLowerCase();
    return unclaimedBars.filter(
      (bar) =>
        bar.name.toLowerCase().includes(searchLower) ||
        bar.address.toLowerCase().includes(searchLower)
    );
  }, [unclaimedBars, search]);

  useEffect(() => {
    async function fetchBars() {
      try {
        console.log('Fetching bars for user:', {
          userId: user?.id,
          role: user?.role
        });

        const response = await fetch("/api/owner/bars", {
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error response from owner/bars:', errorData);
          throw new Error(errorData.error || errorData.details || 'Failed to fetch bars');
        }

        const data = await response.json();
        console.log('Successfully fetched bars:', {
          ownedBarsCount: data.ownedBars.length,
          unclaimedBarsCount: data.unclaimedBars.length
        });

        setOwnedBars(data.ownedBars);
        setUnclaimedBars(data.unclaimedBars);
      } catch (error: any) {
        console.error("Error fetching bars:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to load your bars. Please try again.",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchBars();
  }, [toast, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Bar Owner Dashboard</h1>

      {/* Search Bar - useful for admins with many bars */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search bars by name or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        {search && (
          <p className="text-sm text-muted-foreground mt-2">
            Found {filteredOwnedBars.length + filteredUnclaimedBars.length} bars matching "{search}"
          </p>
        )}
      </div>

      {/* Notification Settings Section */}
      <section className="mb-12">
        <NotificationSettings />
      </section>

      {/* Owned Bars Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Your Bars</h2>
        {filteredOwnedBars.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <p>{search ? "No bars match your search." : "You haven't claimed any bars yet."}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredOwnedBars.map((bar) => (
              <Card key={bar.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{bar.name}</span>
                    {bar.isSponsored && (
                      <Badge variant="secondary">Sponsored</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {bar.address}
                  </p>
                  <Link href={`/manage-bar/${bar.id}`}>
                    <Button className="w-full">Manage Bar</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Unclaimed Bars Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Unclaimed Bars</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredUnclaimedBars.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-5 w-5" />
                  <p>{search ? "No unclaimed bars match your search." : "No unclaimed bars available."}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredUnclaimedBars.map((bar) => (
              <Card key={bar.id}>
                <CardHeader>
                  <CardTitle>{bar.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {bar.address}
                  </p>
                  <Link href={`/bars/${bar.id}`}>
                    <Button variant="outline" className="w-full">
                      Claim Ownership
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}