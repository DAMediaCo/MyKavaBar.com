import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Trophy, Medal, Award, User, MapPin } from "lucide-react";
import { useLocation } from "wouter";

interface LeaderboardEntry {
  userId: number;
  username: string | null;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  totalCheckins: number;
  uniqueBars: number;
  currentStreak: number;
  rank: number | null;
  count?: number; // For monthly scope
}

export default function LeaderboardPage() {
  const [, navigate] = useLocation();
  const [scope, setScope] = useState<"global" | "monthly" | "state" | "city">(
    "global"
  );
  const [location, setLocation] = useState("");

  const {
    data: leaderboardData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["leaderboard", scope, location],
    queryFn: async () => {
      const params = new URLSearchParams({ scope });
      if ((scope === "state" || scope === "city") && location) {
        params.append("location", location);
      }
      const res = await fetch(`/api/passport/leaderboard?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json() as Promise<{
        scope: string;
        location?: string;
        leaderboard: LeaderboardEntry[];
      }>;
    },
  });

  const getMedalIcon = (position: number) => {
    if (position === 1)
      return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (position === 2)
      return <Medal className="h-6 w-6 text-gray-400" />;
    if (position === 3)
      return <Medal className="h-6 w-6 text-amber-600" />;
    return null;
  };

  const getMedalEmoji = (position: number) => {
    if (position === 1) return "🥇";
    if (position === 2) return "🥈";
    if (position === 3) return "🥉";
    return null;
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Top kava bar explorers
          </p>
        </div>
        <Button onClick={() => navigate("/passport")} variant="outline">
          <Award className="h-4 w-4 mr-2" />
          My Passport
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Scope</label>
              <Select
                value={scope}
                onValueChange={(value: any) => setScope(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (All-Time)</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="state">By State</SelectItem>
                  <SelectItem value="city">By City</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(scope === "state" || scope === "city") && (
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={
                      scope === "state" ? "e.g., FL" : "e.g., Miami"
                    }
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {scope === "global" && "Global Rankings"}
            {scope === "monthly" && "This Month's Top Explorers"}
            {scope === "state" && `Top Explorers in ${location || "..."}`}
            {scope === "city" && `Top Explorers in ${location || "..."}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              Failed to load leaderboard
            </div>
          ) : leaderboardData?.leaderboard.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No entries yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboardData?.leaderboard.map((entry, index) => {
                const position = index + 1;
                const medal = getMedalEmoji(position);
                const displayName =
                  entry.username ||
                  `${entry.firstName} ${entry.lastName}`.trim() ||
                  "Anonymous";

                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:shadow-md ${
                      position <= 3 ? "bg-muted/50" : ""
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center w-12 h-12 font-bold text-lg">
                      {medal || position}
                    </div>

                    {/* Avatar */}
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {getInitials(entry.firstName, entry.lastName) || (
                          <User className="h-5 w-5" />
                        )}
                      </AvatarFallback>
                    </Avatar>

                    {/* User Info */}
                    <div className="flex-1">
                      <div className="font-semibold">{displayName}</div>
                      <div className="text-sm text-muted-foreground">
                        {scope === "monthly"
                          ? `${entry.count || 0} unique bars this month`
                          : `${entry.uniqueBars} unique bars`}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-6 text-sm">
                      {scope !== "monthly" && (
                        <>
                          <div className="text-center">
                            <div className="font-bold text-lg">
                              {entry.totalCheckins}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              Check-ins
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-lg">
                              {entry.currentStreak}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              Streak
                            </div>
                          </div>
                        </>
                      )}
                      <div className="text-center">
                        <div className="font-bold text-lg">
                          {scope === "monthly"
                            ? entry.count || 0
                            : entry.uniqueBars}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Unique Bars
                        </div>
                      </div>
                    </div>
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
