import { useEffect, useState, useMemo, useCallback } from "react";
import { useUser } from "@/hooks/use-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Building2, AlertCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { KavaBar } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import NotificationSettings from "@/components/owner/notification-settings";

const PAGE_SIZE = 50;

export default function OwnerDashboard() {
  const { user } = useUser();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [ownedBars, setOwnedBars] = useState<KavaBar[]>([]);
  const [unclaimedBars, setUnclaimedBars] = useState<KavaBar[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    totalOwned: 0,
    totalUnclaimed: 0,
    totalPages: 1,
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchBars = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }

      const response = await fetch(`/api/owner/bars?${params}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to fetch bars");
      }

      const data = await response.json();
      setOwnedBars(data.ownedBars);
      setUnclaimedBars(data.unclaimedBars);
      setPagination({
        totalOwned: data.pagination?.totalOwned || data.ownedBars.length,
        totalUnclaimed: data.pagination?.totalUnclaimed || data.unclaimedBars.length,
        totalPages: data.pagination?.totalPages || 1,
      });
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
  }, [page, debouncedSearch, toast]);

  useEffect(() => {
    fetchBars();
  }, [fetchBars]);

  if (isLoading && page === 1 && !debouncedSearch) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Bar Owner Dashboard</h1>
      {user?.isAdmin && (
        <p className="text-muted-foreground mb-6">
          Admin view — showing all {pagination.totalOwned} bars ({pagination.totalUnclaimed} unclaimed)
        </p>
      )}

      {/* Search Bar */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search bars by name or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {debouncedSearch && !isLoading && (
          <p className="text-sm text-muted-foreground mt-2">
            Found {pagination.totalOwned} bars matching "{debouncedSearch}"
          </p>
        )}
      </div>

      {/* Notification Settings Section */}
      <section className="mb-12">
        <NotificationSettings />
      </section>

      {/* Owned/All Bars Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">
          {user?.isAdmin ? "All Bars" : "Your Bars"}
          <span className="text-muted-foreground text-lg ml-2">({pagination.totalOwned})</span>
        </h2>
        {ownedBars.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <p>{debouncedSearch ? "No bars match your search." : "You haven't claimed any bars yet."}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ownedBars.map((bar) => (
              <Card key={bar.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{bar.name}</span>
                    <div className="flex gap-1 shrink-0">
                      {bar.isSponsored && (
                        <Badge variant="secondary">Sponsored</Badge>
                      )}
                      {(bar as any).ownerId && (
                        <Badge variant="outline" className="text-green-500 border-green-500">Claimed</Badge>
                      )}
                    </div>
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
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">
          Unclaimed Bars
          <span className="text-muted-foreground text-lg ml-2">({pagination.totalUnclaimed})</span>
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {unclaimedBars.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-5 w-5" />
                  <p>{debouncedSearch ? "No unclaimed bars match your search." : "No unclaimed bars available."}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            unclaimedBars.map((bar) => (
              <Card key={bar.id}>
                <CardHeader>
                  <CardTitle className="truncate">{bar.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {bar.address}
                  </p>
                  <Link href={`/kava-bars/${bar.id}`}>
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

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
