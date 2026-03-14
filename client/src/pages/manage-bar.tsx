import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import KavatendersTable from "@/components/kavatenders-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Edit, Loader2, Plus, Trash2, Clock, CalendarDays,
  Users, BarChart2, Star, Sun, ImageIcon, CheckCircle2, XCircle,
  ChevronRight, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventForm, type EventFormValues } from "@/components/event-form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { EventRsvpTab } from "@/components/owner/events-rsvp-tab";
import { Features } from "@/components/owner/features";
import { HappyHours } from "@/components/owner/happy-hours";
import ComingSoonForm from "@/components/owner/coming-soon-form";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";
import { ScheduleBuilder, type ScheduleRow, to12 } from "@/components/owner/schedule-builder";

const daysOfWeek = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

const isHHMM24 = (time: string) => {
  if (!time) return true;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

/** Convert "HH:MM[:SS]" (24hr) → "h:MM AM/PM" */
const fmt12 = (time?: string | null): string => {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  if (isNaN(h)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${period}`;
};

const hoursFormSchema = z.object({
  hours: z.array(z.object({
    day: z.enum(daysOfWeek),
    open: z.string().refine(isHHMM24, "Must be HH:MM"),
    close: z.string().refine(isHHMM24, "Must be HH:MM"),
  })),
});

type HoursFormValues = z.infer<typeof hoursFormSchema>;

// ── Tab definition ──────────────────────────────────────────────────────────
const TABS = [
  { value: "details",    label: "Details",      icon: Edit },
  { value: "hours",      label: "Hours",        icon: Clock },
  { value: "events",     label: "Events",       icon: CalendarDays },
  { value: "staff",      label: "Staff",        icon: Users },
  { value: "rsvp",       label: "RSVP Stats",   icon: BarChart2 },
  { value: "features",   label: "Features",     icon: Star },
  { value: "happyHours", label: "Happy Hours",  icon: Sun },
];

export default function ManageBar() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  // ── Schedule builder state ───────────────────────────────────────────────
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [isSavingHours, setIsSavingHours] = useState(false);

  // ── Local state ──────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<(EventFormValues & { id: number; photoUrl?: string | null }) | null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [isUploadingHeroImage, setIsUploadingHeroImage] = useState(false);

  // ── Hours form ───────────────────────────────────────────────────────────
  const form = useForm<HoursFormValues>({
    resolver: zodResolver(hoursFormSchema),
    defaultValues: {
      hours: daysOfWeek.map((day) => ({ day, open: "09:00", close: "22:00" })),
    },
  });

  // ── Bar query ────────────────────────────────────────────────────────────
  const { data: bar, isLoading: isLoadingBar, error: barError } = useQuery({
    queryKey: [`/api/kava-bars/${id}`],
    queryFn: async () => {
      const response = await fetch(`/api/kava-bars/${id}`, {
        credentials: "include",
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch bar details");
      }
      const data = await response.json();

      // Parse hours into schedule builder rows
      if (data?.hours) {
        const parse24 = (time: string): string => {
          const match = time.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
          if (!match) return "10:00";
          let [, h, m = "00", period] = match;
          let hour = parseInt(h, 10);
          const min = parseInt(m, 10);
          if (period) {
            period = period.toUpperCase();
            if (period === "PM" && hour !== 12) hour += 12;
            if (period === "AM" && hour === 12) hour = 0;
          }
          return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        };
        const DAYS_LIST = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        const rangeMap: Record<string, boolean[]> = {};
        data.hours.forEach((entry: string) => {
          const [day, timeRange] = entry.split(": ");
          if (!timeRange) return;
          const dayIdx = DAYS_LIST.indexOf(day);
          if (dayIdx === -1) return;
          const clean = timeRange.replace(/\s*[\u2013\u2014\u2013\u2014–-]\s*/g, " - ").trim();
          if (clean.toLowerCase() === "closed") return;
          if (!rangeMap[clean]) rangeMap[clean] = Array(7).fill(false);
          rangeMap[clean][dayIdx] = true;
        });
        const built = Object.entries(rangeMap).map(([range, days]) => {
          const parts = range.split(" - ").map((t: string) => t.trim());
          return { open: parse24(parts[0] || ""), close: parse24(parts[1] || ""), days };
        });
        setScheduleRows(built.length > 0 ? built : [{ open: "10:00", close: "22:00", days: Array(7).fill(false) }]);
      } else {
        setScheduleRows([{ open: "10:00", close: "22:00", days: Array(7).fill(false) }]);
      }
      return data;

    },
    retry: 1,
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: [`/api/bars/${id}/events`],
    queryFn: async () => {
      const r = await fetch(`/api/bars/${id}/events`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch events");
      return r.json();
    },
    enabled: !!bar,
  });

  const { data: kavaTenders = [], isLoading: isLoadingKavatenders } = useQuery({
    queryKey: [`/api/kavatenders/${id}`],
    queryFn: async () => {
      const r = await fetch(`/api/kavatenders/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch kavatenders");
      return r.json();
    },
    enabled: !!bar,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateHoursMutation = useMutation({
    mutationFn: async (data: HoursFormValues) => {
      const r = await fetch(`/api/kava-bars/${id}/hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed to update hours");
      return r.json();
    },
    onSuccess: () => toast({ title: "Hours updated" }),
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const createEventMutation = useMutation({
    mutationFn: async ({ data, photo }: { data: EventFormValues; photo?: File }) => {
      const fd = new FormData();
      fd.append("title", data.title);
      if (data.description) fd.append("description", data.description);
      fd.append("dayOfWeek", String(data.dayOfWeek));
      fd.append("startTime", data.startTime);
      fd.append("endTime", data.endTime);
      fd.append("isRecurring", String(data.isRecurring));
      if (data.startDate) fd.append("startDate", data.startDate);
      if (data.endDate) fd.append("endDate", data.endDate);
      if (photo) fd.append("photo", photo);
      const r = await fetch(`/api/bars/${id}/events`, { method: "POST", body: fd, credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed to create event");
      return r.json();
    },
    onSuccess: (res) => {
      toast({ title: "Event created", description: res.warning });
      queryClient.invalidateQueries({ queryKey: [`/api/bars/${id}/events`] });
      setAddEventOpen(false);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ eventId, data, photo }: { eventId: number; data: EventFormValues; photo?: File }) => {
      const fd = new FormData();
      fd.append("title", data.title);
      if (data.description) fd.append("description", data.description);
      fd.append("dayOfWeek", String(data.dayOfWeek));
      fd.append("startTime", data.startTime);
      fd.append("endTime", data.endTime);
      fd.append("isRecurring", String(data.isRecurring));
      if (data.startDate) fd.append("startDate", data.startDate);
      if (data.endDate) fd.append("endDate", data.endDate);
      if (photo) fd.append("photo", photo);
      const r = await fetch(`/api/bars/${id}/events/${eventId}`, { method: "PUT", body: fd, credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed to update event");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Event updated" });
      queryClient.invalidateQueries({ queryKey: [`/api/bars/${id}/events`] });
      setIsModalOpen(false);
      setSelectedEvent(null);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const r = await fetch(`/api/bars/${id}/events/${eventId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed to delete event");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Event deleted" });
      queryClient.invalidateQueries({ queryKey: [`/api/bars/${id}/events`] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const verifyKavatenderMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/kavatenders/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, barId: id }),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed to verify kavatender");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Kavatender verified!" });
      queryClient.invalidateQueries({ queryKey: [`/api/kavatenders/${id}`] });
      setPhoneNumber("");
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const deleteKavatenderMutation = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch(`/api/kavatenders/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to remove kavatender");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Kavatender removed" });
      queryClient.invalidateQueries({ queryKey: [`/api/kavatenders/${id}`] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  // ── Hero image handlers ──────────────────────────────────────────────────
  const handleHeroImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", variant: "destructive" }); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large (max 10MB)", variant: "destructive" }); return;
    }
    setHeroImageFile(file);
    setHeroImagePreview(URL.createObjectURL(file));
  };

  const uploadHeroImage = async () => {
    if (!heroImageFile) return;
    setIsUploadingHeroImage(true);
    try {
      const fd = new FormData();
      fd.append("heroImage", heroImageFile);
      const r = await fetch(`/api/kava-bars/${id}/hero-image`, { method: "POST", body: fd, credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Upload failed");
      toast({ title: "Hero image uploaded" });
      setHeroImageFile(null);
      setHeroImagePreview(null);
      queryClient.invalidateQueries({ queryKey: [`/api/kava-bars/${id}`] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message });
    } finally { setIsUploadingHeroImage(false); }
  };

  const removeHeroImage = async () => {
    setIsUploadingHeroImage(true);
    try {
      const r = await fetch(`/api/kava-bars/${id}/hero-image`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroImageUrl: "" }), credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to remove hero image");
      toast({ title: "Hero image removed — reverted to default" });
      queryClient.invalidateQueries({ queryKey: [`/api/kava-bars/${id}`] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally { setIsUploadingHeroImage(false); }
  };

  // ── Loading / error states ───────────────────────────────────────────────
  if (isLoadingBar) {
    return (
      <div className="min-h-screen bg-[#111112] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D35400]" />
      </div>
    );
  }

  if (barError || !bar) {
    return (
      <div className="min-h-screen bg-[#111112] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{barError instanceof Error ? barError.message : "Bar not found"}</p>
          <Button variant="outline" onClick={() => navigate("/owner-dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── Status badge ─────────────────────────────────────────────────────────
  const statusBadge = bar.comingSoon
    ? { label: "Coming Soon", className: "bg-blue-900/40 text-blue-400 border-blue-800" }
    : bar.businessStatus === "operational"
    ? { label: "Active", className: "bg-green-900/40 text-green-400 border-green-800" }
    : { label: "Inactive", className: "bg-zinc-800 text-zinc-400 border-zinc-700" };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#111112] text-white">
      {/* ── Page Header ── */}
      <div className="border-b border-[#2a2a2b] bg-[#161617]">
        <div className="container mx-auto px-4 py-4">
          <button
            onClick={() => navigate("/owner-dashboard")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">{bar.name}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{bar.address}</p>
            </div>
            <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border", statusBadge.className)}>
              {statusBadge.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="container mx-auto px-4 py-4 sm:py-6 max-w-3xl">
        <Tabs defaultValue="details">
          {/* Tab Bar — scrollable on mobile */}
          <div className="mb-6 -mx-4 px-4 overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: "touch" }}>
            <TabsList className="inline-flex h-auto bg-[#1E1E1F] border border-[#2a2a2b] rounded-xl p-1 gap-0.5 min-w-max">
              {TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 min-h-[44px]
                    data-[state=active]:bg-[#D35400] data-[state=active]:text-white
                    hover:text-white transition-all whitespace-nowrap"
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden xs:inline">{label}</span>
                  <span className="xs:hidden text-[11px]">{label.split(" ")[0]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ──────────────────────────────────────────────────────────────── */}
          {/* DETAILS TAB */}
          {/* ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="details" className="space-y-5">
            {/* Info card */}
            <div className="rounded-xl border border-[#2a2a2b] bg-[#1a1a1b] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#D35400] uppercase tracking-wider flex items-center gap-2">
                <Edit className="h-4 w-4" /> Bar Info
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Address</p>
                  <p className="text-sm text-gray-200">{bar.address || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Phone</p>
                  <p className="text-sm text-gray-200">{bar.phone || "Not provided"}</p>
                </div>
                {bar.website && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Website</p>
                    <a href={bar.website} target="_blank" rel="noopener noreferrer" className="text-sm text-[#D35400] hover:underline">
                      {bar.website}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Hero image card */}
            <div className="rounded-xl border border-[#2a2a2b] bg-[#1a1a1b] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#D35400] uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Hero Image
              </h2>
              <p className="text-xs text-gray-400">
                Displayed on your bar's listing card. Recommended: 16:9, min 1200×675px, max 10MB.
              </p>

              {/* Preview */}
              <div className="rounded-lg overflow-hidden border border-[#2a2a2b]">
                <img
                  src={heroImagePreview || bar.heroImageUrl || "/kava-bar-default-hero.jpg"}
                  alt={bar.name}
                  className="w-full h-44 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/kava-bar-default-hero.jpg"; }}
                />
                <div className="px-3 py-1.5 bg-[#111112] text-xs text-gray-500 flex items-center justify-between">
                  {heroImagePreview
                    ? <span className="text-amber-400 font-medium">Preview — click Upload to save</span>
                    : bar.heroImageUrl
                    ? <span>Current hero image</span>
                    : <span className="italic">Default stock image</span>}
                </div>
              </div>

              {/* Upload controls */}
              <div className="flex gap-3">
                <input type="file" accept="image/*" onChange={handleHeroImageChange} className="hidden" id="hero-image-upload" disabled={isUploadingHeroImage} />
                <label htmlFor="hero-image-upload" className="flex-1">
                  <Button variant="outline" className="w-full border-[#333] bg-[#1E1E1F] hover:bg-[#2a2a2b]" asChild disabled={isUploadingHeroImage}>
                    <span><ImageIcon className="h-4 w-4 mr-2" />{heroImageFile ? heroImageFile.name : "Choose Image"}</span>
                  </Button>
                </label>
                {heroImageFile && (
                  <Button onClick={uploadHeroImage} disabled={isUploadingHeroImage} className="bg-[#D35400] hover:bg-[#b84800] text-white">
                    {isUploadingHeroImage ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
                  </Button>
                )}
              </div>

              {/* Delete */}
              {bar.heroImageUrl && !heroImagePreview && (
                <div className="flex items-center justify-between rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-red-400">Delete Hero Image</p>
                    <p className="text-xs text-gray-500 mt-0.5">Reverts to the default stock image.</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={removeHeroImage} disabled={isUploadingHeroImage}>
                    {isUploadingHeroImage ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                  </Button>
                </div>
              )}
            </div>

            {/* Coming Soon */}
            <div className="rounded-xl border border-[#2a2a2b] bg-[#1a1a1b] p-5">
              <h2 className="text-sm font-semibold text-[#D35400] uppercase tracking-wider mb-4">Coming Soon Settings</h2>
              <ComingSoonForm bar={bar} />
            </div>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────────────── */}
          {/* HOURS TAB */}
          {/* ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="hours">
            <div className="rounded-xl border border-[#2a2a2b] bg-[#1a1a1b] p-5 space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-[#D35400] uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Hours of Operation
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Set a time range, then check which days it applies to. Add another row for days with different hours.
                </p>
              </div>
              <ScheduleBuilder rows={scheduleRows} onChange={setScheduleRows} />
              <Button
                onClick={async () => {
                  setIsSavingHours(true);
                  try {
                    const DAYS_LIST = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
                    const fmt12 = (t: string) => {
                      const { h, m, period } = to12(t);
                      return `${h}:${m} ${period}`;
                    };
                    const hoursArray: string[] = [];
                    DAYS_LIST.forEach((day, di) => {
                      const row = scheduleRows.find(r => r.days[di]);
                      if (row) hoursArray.push(`${day}: ${fmt12(row.open)} - ${fmt12(row.close)}`);
                      else hoursArray.push(`${day}: Closed`);
                    });
                    const r = await fetch(`/api/kava-bars/${id}/hours`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ hours: hoursArray }),
                      credentials: "include",
                    });
                    if (!r.ok) throw new Error("Failed to save hours");
                    toast({ title: "Hours saved" });
                    queryClient.invalidateQueries({ queryKey: [`/api/kava-bars/${id}`] });
                  } catch (e: any) {
                    toast({ variant: "destructive", title: "Error", description: e.message });
                  } finally {
                    setIsSavingHours(false);
                  }
                }}
                disabled={isSavingHours}
                className="w-full bg-[#D35400] hover:bg-[#b84800] text-white"
              >
                {isSavingHours ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Hours"}
              </Button>
            </div>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────────────── */}
          {/* EVENTS TAB */}
          {/* ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="events">
            <div className="rounded-xl border border-[#2a2a2b] bg-[#1a1a1b] p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-[#D35400] uppercase tracking-wider flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> Events
                </h2>
                <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#D35400] hover:bg-[#b84800] text-white h-8 text-xs px-3">
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Event
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#1a1a1b] border-[#2a2a2b]">
                    <DialogHeader><DialogTitle className="text-white">Add New Event</DialogTitle></DialogHeader>
                    {addEventOpen && (
                      <EventForm
                        key="create-event-form"
                        onSubmit={(data, photo) => createEventMutation.mutate({ data, photo })}
                        isSubmitting={createEventMutation.isPending}
                      />
                    )}
                  </DialogContent>
                </Dialog>
              </div>

              {isLoadingEvents ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#D35400]" /></div>
              ) : events.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No events yet. Add your first event above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((event: any) => (
                    <div key={event.id} className="flex items-center justify-between rounded-lg border border-[#2a2a2b] bg-[#111112] px-4 py-3 hover:border-[#333] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#D35400]/10 border border-[#D35400]/20 flex items-center justify-center flex-shrink-0">
                          <CalendarDays className="h-4 w-4 text-[#D35400]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{event.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {daysOfWeek[event.dayOfWeek]} · {fmt12(event.startTime)} – {fmt12(event.endTime)}
                          </p>
                          {event.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{event.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white" onClick={() => { setSelectedEvent(event); setIsModalOpen(true); }}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-400" onClick={() => deleteEventMutation.mutate(event.id)} disabled={deleteEventMutation.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit event modal */}
            <Dialog open={isModalOpen} onOpenChange={(o) => { setIsModalOpen(o); if (!o) setSelectedEvent(null); }}>
              <DialogContent className="bg-[#1a1a1b] border-[#2a2a2b]">
                <DialogHeader><DialogTitle className="text-white">Edit Event</DialogTitle></DialogHeader>
                {selectedEvent && (
                  <EventForm
                    onSubmit={(data, photo) => updateEventMutation.mutate({ eventId: selectedEvent.id, data, photo })}
                    defaultValues={selectedEvent}
                    existingPhotoUrl={selectedEvent.photoUrl}
                    isSubmitting={updateEventMutation.isPending}
                  />
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────────────── */}
          {/* STAFF TAB */}
          {/* ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="staff" className="space-y-5">
            {/* Add kavatender */}
            <div className="rounded-xl border border-[#2a2a2b] bg-[#1a1a1b] p-5">
              <h2 className="text-sm font-semibold text-[#D35400] uppercase tracking-wider flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4" /> Add Kavatender
              </h2>
              <p className="text-xs text-gray-400 mb-4">Enter the phone number of a registered user to add them as a kavatender for this bar.</p>
              <form onSubmit={(e) => { e.preventDefault(); setIsVerifying(true); verifyKavatenderMutation.mutate(); setIsVerifying(false); }} className="flex gap-3">
                <Input
                  placeholder="Phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="bg-[#111112] border-[#333] text-white placeholder:text-gray-600 flex-1"
                />
                <Button type="submit" disabled={verifyKavatenderMutation.isPending || !phoneNumber} className="bg-[#D35400] hover:bg-[#b84800] text-white">
                  {verifyKavatenderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </form>
            </div>

            {/* Kavatenders list */}
            <div className="rounded-xl border border-[#2a2a2b] bg-[#1a1a1b] p-5">
              <h2 className="text-sm font-semibold text-[#D35400] uppercase tracking-wider flex items-center gap-2 mb-4">
                <Users className="h-4 w-4" /> Current Staff ({kavaTenders.length})
              </h2>
              {isLoadingKavatenders ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#D35400]" /></div>
              ) : kavaTenders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No kavatenders added yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {kavaTenders.map((kt: any) => (
                    <div key={kt.userId} className="flex items-center justify-between rounded-lg border border-[#2a2a2b] bg-[#111112] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#D35400]/10 border border-[#D35400]/20 flex items-center justify-center text-[#D35400] text-xs font-bold">
                          {(kt.name || "K")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{kt.name || "Unknown"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {kt.phoneNumber && <p className="text-xs text-gray-500">{kt.phoneNumber}</p>}
                            {kt.position && <span className="text-xs text-[#D35400] border border-[#D35400]/30 rounded-full px-1.5 py-0.5">{kt.position}</span>}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400 text-xs" onClick={() => deleteKavatenderMutation.mutate(String(kt.userId))} disabled={deleteKavatenderMutation.isPending}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────────────── */}
          {/* RSVP STATS TAB */}
          {/* ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="rsvp">
            <div className="rounded-xl border border-[#2a2a2b] bg-[#1a1a1b] p-5">
              <h2 className="text-sm font-semibold text-[#D35400] uppercase tracking-wider flex items-center gap-2 mb-5">
                <BarChart2 className="h-4 w-4" /> RSVP Stats
              </h2>
              <EventRsvpTab barId={Number(id)} />
            </div>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────────────── */}
          {/* FEATURES TAB */}
          {/* ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="features">
            <div className="rounded-xl border border-[#2a2a2b] bg-[#1a1a1b] p-5">
              <h2 className="text-sm font-semibold text-[#D35400] uppercase tracking-wider flex items-center gap-2 mb-5">
                <Star className="h-4 w-4" /> Bar Features & Amenities
              </h2>
              <Features barId={Number(id)} />
            </div>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────────────── */}
          {/* HAPPY HOURS TAB */}
          {/* ──────────────────────────────────────────────────────────────── */}
          <TabsContent value="happyHours">
            <div className="rounded-xl border border-[#2a2a2b] bg-[#1a1a1b] p-5">
              <h2 className="text-sm font-semibold text-[#D35400] uppercase tracking-wider flex items-center gap-2 mb-5">
                <Sun className="h-4 w-4" /> Happy Hours
              </h2>
              <HappyHours barId={Number(id)} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
