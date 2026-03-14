import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trophy, MapPin, Flame, Star, Award } from "lucide-react";
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
  count?: number;
}

type Scope = "global" | "monthly" | "state" | "city";

const SCOPE_LABELS: Record<Scope, string> = {
  global: "All-Time",
  monthly: "Monthly",
  state: "State",
  city: "City",
};

const PODIUM_COLORS = [
  { ring: "ring-amber-400", glow: "shadow-amber-500/30", bg: "from-amber-500/20", crown: "🥇", label: "text-amber-400" },
  { ring: "ring-gray-400",  glow: "shadow-gray-400/20",  bg: "from-gray-400/15",  crown: "🥈", label: "text-gray-300" },
  { ring: "ring-amber-700", glow: "shadow-amber-700/20", bg: "from-amber-700/15", crown: "🥉", label: "text-amber-600" },
];

function Avatar({ url, initials, size = "md" }: { url?: string | null; initials: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "w-20 h-20 text-2xl" : size === "md" ? "w-12 h-12 text-base" : "w-9 h-9 text-xs";
  if (url) {
    return <img src={url} alt="" className={`${cls} rounded-full object-cover`} />;
  }
  return (
    <div className={`${cls} rounded-full bg-[#2A2A2A] border border-white/10 flex items-center justify-center font-bold text-gray-300`}>
      {initials || "?"}
    </div>
  );
}

function getInitials(first: string, last: string) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();
}

function getDisplayName(entry: LeaderboardEntry) {
  return entry.username || `${entry.firstName} ${entry.lastName}`.trim() || "Anonymous";
}

/** Liquid glass button */
function GlassButton({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 border
        ${active
          ? "bg-[#D35400]/80 border-[#D35400] text-white shadow-[0_0_12px_rgba(211,84,0,0.4)]"
          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white backdrop-blur-md"
        }`}
    >
      <span className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
      {children}
    </button>
  );
}

/** Top-3 podium bento card */
function PodiumCard({ entry, position }: { entry: LeaderboardEntry; position: 1 | 2 | 3 }) {
  const c = PODIUM_COLORS[position - 1];
  const isFirst = position === 1;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-b ${c.bg} to-[#1E1E1E] border border-white/10 
      ring-1 ${c.ring} shadow-xl ${c.glow} backdrop-blur-sm
      flex flex-col items-center justify-between p-4 gap-3
      ${isFirst ? "pt-6 pb-5" : "pt-4 pb-4"}`}>
      {/* Shimmer */}
      <span className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />

      {/* Crown + rank */}
      <div className="text-3xl leading-none">{c.crown}</div>

      {/* Avatar */}
      <div className={`ring-2 ${c.ring} rounded-full shadow-lg ${c.glow}`}>
        <Avatar url={entry.profilePhotoUrl} initials={getInitials(entry.firstName, entry.lastName)} size={isFirst ? "lg" : "md"} />
      </div>

      {/* Name */}
      <div className="text-center">
        <p className={`font-bold leading-tight ${isFirst ? "text-base" : "text-sm"} text-white line-clamp-1`}>
          {getDisplayName(entry)}
        </p>
        <p className={`text-xs font-semibold mt-0.5 ${c.label}`}>#{position}</p>
      </div>

      {/* Stats row */}
      <div className="w-full flex justify-around text-center mt-1">
        <div>
          <p className="text-white font-bold text-lg leading-none">{entry.uniqueBars}</p>
          <p className="text-gray-500 text-[0.6rem] mt-0.5">bars</p>
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-none">{entry.totalCheckins}</p>
          <p className="text-gray-500 text-[0.6rem] mt-0.5">stamps</p>
        </div>
        {entry.currentStreak > 0 && (
          <div>
            <p className="text-orange-400 font-bold text-lg leading-none flex items-center gap-0.5 justify-center">
              <Flame className="w-3 h-3" />{entry.currentStreak}
            </p>
            <p className="text-gray-500 text-[0.6rem] mt-0.5">streak</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [, navigate] = useLocation();
  const [scope, setScope] = useState<Scope>("global");
  const [location, setLocation] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["leaderboard", scope, location],
    queryFn: async () => {
      const params = new URLSearchParams({ scope });
      if ((scope === "state" || scope === "city") && location) {
        params.append("location", location);
      }
      const res = await fetch(`/api/passport/leaderboard?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json() as Promise<{ scope: string; location?: string; leaderboard: LeaderboardEntry[] }>;
    },
  });

  const entries = data?.leaderboard ?? [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  // Podium order: 2nd | 1st | 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderboardEntry[];
  const podiumPositions = top3[1] ? [2, 1, 3] : top3[0] ? [1] : [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Leaderboard</h1>
            <p className="text-gray-500 text-xs">Top kava bar explorers</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/passport")}
          className="relative overflow-hidden flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white border border-white/20 bg-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-white/15 active:scale-95 transition-all duration-200"
        >
          <span className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
          <Award className="h-4 w-4" />
          My Passport
        </button>
      </div>

      {/* Compact scope + location filter */}
      <div className="flex flex-wrap items-center gap-2">
        {(["global", "monthly", "state", "city"] as Scope[]).map((s) => (
          <GlassButton key={s} active={scope === s} onClick={() => setScope(s)}>
            {SCOPE_LABELS[s]}
          </GlassButton>
        ))}
        {(scope === "state" || scope === "city") && (
          <div className="relative flex items-center">
            <MapPin className="absolute left-2.5 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
            <input
              placeholder={scope === "state" ? "FL" : "Miami"}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-[#D35400] w-32 backdrop-blur-md"
            />
          </div>
        )}
      </div>

      {/* Loading / error */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#D35400]" />
        </div>
      )}
      {error && (
        <div className="text-center py-12 text-red-400">Failed to load leaderboard</div>
      )}

      {!isLoading && !error && entries.length === 0 && (
        <div className="text-center py-16">
          <Trophy className="h-12 w-12 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500">No entries yet</p>
        </div>
      )}

      {/* Podium — top 3 bento */}
      {!isLoading && top3.length > 0 && (
        <div className={`grid gap-3 ${top3.length === 3 ? "grid-cols-3" : top3.length === 2 ? "grid-cols-2" : "grid-cols-1 max-w-xs mx-auto"}`}>
          {podiumOrder.map((entry, i) => (
            <div key={entry.userId} className={podiumPositions[i] === 1 ? "row-span-1 scale-[1.03]" : ""}>
              <PodiumCard entry={entry} position={podiumPositions[i] as 1 | 2 | 3} />
            </div>
          ))}
        </div>
      )}

      {/* Rest of leaderboard */}
      {!isLoading && rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((entry, i) => {
            const position = i + 4;
            const displayName = getDisplayName(entry);
            const statVal = scope === "monthly" ? entry.count ?? 0 : entry.uniqueBars;

            return (
              <div
                key={entry.userId}
                className="relative overflow-hidden flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/8 backdrop-blur-sm hover:bg-white/8 transition-all duration-150"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/3 via-transparent to-transparent pointer-events-none" />

                {/* Rank */}
                <div className="w-7 text-center text-gray-500 font-bold text-sm shrink-0">{position}</div>

                {/* Avatar */}
                <Avatar url={entry.profilePhotoUrl} initials={getInitials(entry.firstName, entry.lastName)} size="sm" />

                {/* Name + sub */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{displayName}</p>
                  <p className="text-gray-500 text-xs">{statVal} bars</p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-right shrink-0">
                  {scope !== "monthly" && (
                    <>
                      <div className="hidden sm:block text-center">
                        <p className="font-bold text-white text-sm">{entry.totalCheckins}</p>
                        <p className="text-gray-600 text-[0.6rem]">stamps</p>
                      </div>
                      {entry.currentStreak > 0 && (
                        <div className="text-center">
                          <p className="font-bold text-orange-400 text-sm flex items-center gap-0.5 justify-center">
                            <Flame className="w-3 h-3" />{entry.currentStreak}
                          </p>
                          <p className="text-gray-600 text-[0.6rem]">streak</p>
                        </div>
                      )}
                    </>
                  )}
                  <div className="text-center">
                    <p className="font-bold text-[#D35400] text-sm">{statVal}</p>
                    <p className="text-gray-600 text-[0.6rem]">bars</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
