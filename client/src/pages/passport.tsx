import { useEffect, useState } from "react";
import { useUser } from "@/hooks/use-user";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Calendar, Award, Trophy, Flame } from "lucide-react";
import { format } from "date-fns";

interface Stamp {
  id: number;
  barId: number;
  checkedInAt: Date;
  notes: string | null;
  barName: string;
  barAddress: string;
  barLocation: { lat: number; lng: number } | null;
}

interface PassportStats {
  userId: number;
  totalCheckins: number;
  uniqueBars: number;
  currentStreak: number;
  longestStreak: number;
  rank: number | null;
  lastCheckinAt: Date | null;
}

interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earnedAt: Date | null;
}

export default function PassportPage() {
  const { user, isLoading: userLoading } = useUser();
  const [, navigate] = useLocation();
  const [selectedBarId, setSelectedBarId] = useState<number | null>(null);

  useEffect(() => {
    if (!userLoading && !user) {
      navigate("/auth");
    }
  }, [user, userLoading, navigate]);

  const {
    data: passportData,
    isLoading: passportLoading,
    error,
  } = useQuery({
    queryKey: ["passport", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/passport/${user.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch passport");
      return res.json() as Promise<{
        stats: PassportStats;
        stamps: Stamp[];
      }>;
    },
    enabled: !!user?.id,
  });

  const { data: badgesData } = useQuery({
    queryKey: ["badges", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/passport/badges/${user.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch badges");
      return res.json() as Promise<{ badges: Badge[] }>;
    },
    enabled: !!user?.id,
  });

  if (userLoading || passportLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Failed to load passport</p>
      </div>
    );
  }

  const stats = passportData?.stats;
  const stamps = passportData?.stamps || [];
  const badges = badgesData?.badges || [];

  // Group stamps by bar
  const stampsByBar = stamps.reduce((acc, stamp) => {
    if (!acc[stamp.barId]) {
      acc[stamp.barId] = [];
    }
    acc[stamp.barId].push(stamp);
    return acc;
  }, {} as Record<number, Stamp[]>);

  const uniqueBarStamps = Object.values(stampsByBar).map(
    (barStamps) => barStamps[0]
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Kava Passport</h1>
        <Button onClick={() => navigate("/leaderboard")} variant="outline">
          <Trophy className="h-4 w-4 mr-2" />
          Leaderboard
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Check-ins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCheckins || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique Bars
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueBars || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Flame className="h-4 w-4 text-orange-500" />
              Current Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.currentStreak || 0} days
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Global Rank
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.rank ? `#${stats.rank}` : "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Badges Section */}
      {badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Badges Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="border rounded-lg p-4 text-center hover:shadow-md transition-shadow"
                >
                  <div className="text-4xl mb-2">{badge.emoji}</div>
                  <div className="font-semibold text-sm">{badge.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {badge.description}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stamps Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Your Stamps ({uniqueBarStamps.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {uniqueBarStamps.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No stamps yet!</p>
              <p className="text-sm">
                Visit a kava bar and check in to earn your first stamp
              </p>
              <Button
                className="mt-4"
                onClick={() => navigate("/")}
                variant="outline"
              >
                Find Bars Near You
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uniqueBarStamps.map((stamp) => {
                const barStamps = stampsByBar[stamp.barId];
                const visitCount = barStamps.length;
                const city = stamp.barAddress.split(",").slice(-2, -1)[0]?.trim();

                return (
                  <div
                    key={stamp.barId}
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedBarId === stamp.barId
                        ? "ring-2 ring-primary"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedBarId(
                        selectedBarId === stamp.barId ? null : stamp.barId
                      )
                    }
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg leading-tight">
                          {stamp.barName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {city}
                        </p>
                      </div>
                      <div className="text-3xl">🥥</div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(stamp.checkedInAt), "MMM d, yyyy")}
                    </div>

                    {visitCount > 1 && (
                      <div className="text-xs font-medium text-primary">
                        {visitCount} visits
                      </div>
                    )}

                    {selectedBarId === stamp.barId && barStamps.length > 1 && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <p className="text-xs font-medium">Visit History:</p>
                        {barStamps.map((visit, idx) => (
                          <div
                            key={visit.id}
                            className="text-xs text-muted-foreground"
                          >
                            {idx + 1}.{" "}
                            {format(
                              new Date(visit.checkedInAt),
                              "MMM d, yyyy 'at' h:mm a"
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
