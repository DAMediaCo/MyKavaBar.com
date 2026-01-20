import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useKavaBar } from "@/hooks/use-kava-bars";
import { useUser } from "@/hooks/use-user";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RsvpButton } from "@/components/rsvp-button";
import ShareBar from "@/components/share-bar";
import ClaimBarDialog from "@/components/claim-bar-dialog";
import SponsorBarDialog from "@/components/sponsor-bar-dialog";
import ReviewList from "@/components/reviews/review-list";
import ReviewForm from "@/components/reviews/review-form";
import { CustomModal } from "@/components/custom-modal";
import KavatenderCheckin from "@/components/kavatender-checkin";
import BarOwnershipControls from "@/components/admin/bar-ownership-controls";
import CheckInCarousel from "@/components/check-in-carousal";
import { FavoriteBarDesktop, FavoriteBarMobile } from "@/components/favorite-bar";
import {
  MapPin,
  Phone,
  Clock,
  Sparkles,
  User,
  AlertCircle,
  Copy,
  Star,
  Calendar,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Images,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getApiUrl(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function generateGoogleCalendarLink(event: any, barAddress: string) {
  const startDate = event.startDate ? parseISO(event.startDate) : new Date();
  const dateStr = format(startDate, "yyyyMMdd");
  const startTime = event.startTime?.replace(":", "") + "00";
  const endTime = event.endTime?.replace(":", "") + "00";
  
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${dateStr}T${startTime}/${dateStr}T${endTime}`,
    location: barAddress,
    details: event.description || "",
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function BarDetails() {
  const { id } = useParams();
  const { data: bar, isLoading, error } = useKavaBar(id || "");
  const { user } = useUser();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [showAllHappyHours, setShowAllHappyHours] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  
  const { data: checkIns } = useQuery<any[]>({
    queryKey: [`checkIns/${id}`],
    queryFn: async () => {
      const response = await fetch(getApiUrl(`/api/bars/${id}/check-ins`), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  const { data: eventsData } = useQuery<any[]>({
    queryKey: [`/api/bars/${id}/events`],
    queryFn: async () => {
      const response = await fetch(getApiUrl(`/api/bars/${id}/events`));
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  const { data: happyHoursData } = useQuery<{ happyHours: Record<string, any[]> }>({
    queryKey: ["happyHours", id],
    queryFn: async () => {
      const res = await fetch(`/api/bar/${id}/happy-hours`);
      if (!res.ok) throw new Error("Failed to fetch happy hours");
      return res.json();
    },
  });

  const { data: galleryPhotos } = useQuery<any[]>({
    queryKey: [`/api/bars/${id}/photos`],
    queryFn: async () => {
      const response = await fetch(getApiUrl(`/api/bars/${id}/photos`));
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: barFeaturesData } = useQuery<any[]>({
    queryKey: [`/api/bar/${id}/features`],
    queryFn: async () => {
      const response = await fetch(`/api/bar/${id}/features`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const todayDay = daysOfWeek[new Date().getDay()];
  
  const happyHourSchedules = useMemo(() => {
    if (!happyHoursData?.happyHours) return {};
    const result: Record<string, string[]> = {};
    daysOfWeek.forEach((day) => {
      const slots = happyHoursData.happyHours?.[day] ?? [];
      if (slots.length > 0) {
        result[day] = slots.map((s: any) => `${s.start} ${s.startPeriod} - ${s.end} ${s.endPeriod}`);
      }
    });
    return result;
  }, [happyHoursData]);

  const upcomingEvents = useMemo(() => {
    if (!eventsData) return [];
    return eventsData.filter((e: any) => {
      if (!e.startDate) return true;
      return new Date(e.startDate) >= new Date();
    }).slice(0, showAllEvents ? 10 : 1);
  }, [eventsData, showAllEvents]);

  const features: string[] = useMemo(() => {
    if (barFeaturesData) {
      const master = barFeaturesData.masterFeatures || [];
      const custom = barFeaturesData.customFeatures || [];
      const allFeatures = [...master, ...custom];
      if (allFeatures.length > 0) {
        return allFeatures.map((f: any) => f.name || f.featureName || f);
      }
    }
    return bar?.features || [];
  }, [barFeaturesData, bar?.features]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] animate-pulse">
        <div className="h-[45vh] bg-[#1E1E1E]" />
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
          <div className="h-8 bg-[#1E1E1E] rounded w-1/3" />
          <div className="h-40 bg-[#1E1E1E] rounded" />
        </div>
      </div>
    );
  }

  if (error || !bar) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Bar Details</h2>
          <p className="text-gray-400">{error ? error.toString() : "Bar not found"}</p>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === bar.ownerId;
  const canClaim = user && !bar.ownerId;
  const isOpen = bar.hours?.open_now;
  
  const heroImage = bar.heroImageUrl || 
    (galleryPhotos && galleryPhotos.length > 0 ? galleryPhotos[0].url : null) ||
    "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1200";

  const displayFeatures = showAllFeatures ? features : features.slice(0, 5);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(bar.address);
      toast({ title: "Address Copied", description: "The address has been copied to your clipboard." });
    } catch {
      toast({ variant: "destructive", title: "Failed to Copy", description: "Could not copy the address." });
    }
  };

  return (
    <div className="min-h-screen bg-[#121212]">
      {/* Hero Section */}
      <div className="relative h-[45vh] min-h-[400px] w-full">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              {isOpen && (
                <span className="bg-green-500 text-black font-bold uppercase text-xs px-3 py-1 rounded-full">
                  Open Now
                </span>
              )}
              {bar.isSponsored && (
                <Badge className="bg-[#D35400] text-white">Certified</Badge>
              )}
              {bar.businessStatus === "PERMANENTLY_CLOSED" && (
                <Badge variant="destructive">Permanently Closed</Badge>
              )}
            </div>
            
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">{bar.name}</h1>
            
            <div className="flex items-center gap-2 text-gray-300">
              <MapPin className="h-4 w-4 text-[#D35400]" />
              <span>{bar.address}</span>
            </div>
            
            {bar.rating && (
              <div className="flex items-center gap-2 mt-2">
                <Star className="h-5 w-5 text-[#F1C40F] fill-[#F1C40F]" />
                <span className="text-white font-bold">{bar.rating}</span>
                <span className="text-gray-400">rating</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Action Bar */}
        <div className="flex flex-wrap gap-3 mb-8">
          <ShareBar bar={bar} />
          <FavoriteBarDesktop barId={Number(id)} />
          <FavoriteBarMobile barId={Number(id)} />
          
          {canClaim && (
            <ClaimBarDialog
              bar={bar}
              trigger={
                <Button variant="outline" className="gap-2 border-[#333] text-gray-300 hover:bg-[#252525]">
                  <User className="h-4 w-4" />
                  Claim This Bar
                </Button>
              }
            />
          )}
          
          {isOwner && !bar.isSponsored && (
            <SponsorBarDialog
              bar={bar}
              trigger={
                <Button className="gap-2 bg-[#D35400] hover:bg-[#E67E22] text-white font-bold rounded-xl shadow-lg">
                  <Sparkles className="h-4 w-4" />
                  Get Certified
                </Button>
              }
            />
          )}
          
          {user && bar.isBarStaff && (user.role === "kavatender" || user.role === "admin" || user.role === "bar_owner") && (
            <KavatenderCheckin barId={bar.id} />
          )}
        </div>

        {checkIns && checkIns.length > 0 && (
          <div className="mb-8">
            <CheckInCarousel checkIns={checkIns} />
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
          {/* Left Column - Main Content */}
          <div className="space-y-8">
            {/* Gallery */}
            {galleryPhotos && galleryPhotos.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-bold text-xl border-l-4 border-[#D35400] pl-3">
                    Gallery
                  </h2>
                  {galleryPhotos.length > 5 && (
                    <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
                      <DialogTrigger asChild>
                        <button className="text-[#D35400] hover:text-[#E67E22] font-medium flex items-center gap-1">
                          <Images className="h-4 w-4" />
                          View All ({galleryPhotos.length})
                        </button>
                      </DialogTrigger>
                      <DialogContent className="w-[95vw] max-w-2xl bg-[#121212] border-[#333] p-0 max-h-[85vh] overflow-hidden">
                        <DialogHeader className="p-3 border-b border-[#333]">
                          <DialogTitle className="text-white text-base">Photo Gallery</DialogTitle>
                        </DialogHeader>
                        <div className="relative">
                          <div className="h-[50vh] md:h-[55vh] bg-black flex items-center justify-center">
                            <img
                              src={galleryPhotos[selectedPhotoIndex]?.url}
                              alt={`Photo ${selectedPhotoIndex + 1}`}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          {galleryPhotos.length > 1 && (
                            <>
                              <button
                                onClick={() => setSelectedPhotoIndex((prev) => (prev === 0 ? galleryPhotos.length - 1 : prev - 1))}
                                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full"
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => setSelectedPhotoIndex((prev) => (prev === galleryPhotos.length - 1 ? 0 : prev + 1))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </button>
                            </>
                          )}
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                            {selectedPhotoIndex + 1} / {galleryPhotos.length}
                          </div>
                        </div>
                        <div className="hidden md:block p-3 border-t border-[#333]">
                          <div className="flex gap-1.5 overflow-x-auto">
                            {galleryPhotos.map((photo: any, index: number) => (
                              <button
                                key={photo.id || index}
                                onClick={() => setSelectedPhotoIndex(index)}
                                className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-colors ${
                                  index === selectedPhotoIndex ? "border-[#D35400]" : "border-transparent hover:border-[#333]"
                                }`}
                              >
                                <img
                                  src={photo.url}
                                  alt={`Thumbnail ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 h-64 md:h-80">
                  {galleryPhotos.slice(0, 5).map((photo: any, index: number) => (
                    <button
                      key={photo.id || index}
                      onClick={() => {
                        setSelectedPhotoIndex(index);
                        setGalleryOpen(true);
                      }}
                      className={`relative rounded-lg overflow-hidden cursor-pointer ${
                        index === 0 ? "col-span-2 row-span-2" : ""
                      }`}
                    >
                      <img
                        src={photo.url}
                        alt={`Gallery ${index + 1}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                      {index === 4 && galleryPhotos.length > 5 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">+{galleryPhotos.length - 5}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Features */}
            {features.length > 0 && (
              <section>
                <h2 className="text-white font-bold text-xl mb-4 border-l-4 border-[#D35400] pl-3">
                  Features & Amenities
                </h2>
                <div className="flex flex-wrap gap-2">
                  {displayFeatures.map((feature, index) => (
                    <span
                      key={index}
                      className="bg-[#1E1E1E] border border-[#333] text-gray-300 px-4 py-2 rounded-lg"
                    >
                      {feature}
                    </span>
                  ))}
                  {features.length > 5 && (
                    <button
                      onClick={() => setShowAllFeatures(!showAllFeatures)}
                      className="text-[#D35400] hover:text-[#E67E22] font-medium flex items-center gap-1"
                    >
                      {showAllFeatures ? (
                        <>View Less <ChevronUp className="h-4 w-4" /></>
                      ) : (
                        <>View More ({features.length - 5}) <ChevronDown className="h-4 w-4" /></>
                      )}
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Happy Hours */}
            {Object.keys(happyHourSchedules).length > 0 && (
              <section>
                <h2 className="text-white font-bold text-xl mb-4 border-l-4 border-[#D35400] pl-3">
                  Happy Hours
                </h2>
                <div className="space-y-3">
                  {!showAllHappyHours ? (
                    <div className="bg-[#1E1E1E] p-4 rounded-xl border-l-2 border-[#D35400]/50">
                      <div className="font-semibold text-white mb-2">{todayDay}</div>
                      {happyHourSchedules[todayDay] ? (
                        <div className="flex flex-wrap gap-2">
                          {happyHourSchedules[todayDay].map((slot, idx) => (
                            <Badge key={idx} variant="secondary" className="bg-[#252525] text-gray-300">
                              {slot}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400">No happy hours today</p>
                      )}
                      <button
                        onClick={() => setShowAllHappyHours(true)}
                        className="text-[#D35400] hover:text-[#E67E22] font-medium flex items-center gap-1 mt-3"
                      >
                        View Full Week <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {daysOfWeek.map((day) => {
                        const slots = happyHourSchedules[day];
                        if (!slots) return null;
                        return (
                          <div key={day} className="bg-[#1E1E1E] p-4 rounded-xl border-l-2 border-[#D35400]/50">
                            <div className="font-semibold text-white mb-2">{day}</div>
                            <div className="flex flex-wrap gap-2">
                              {slots.map((slot, idx) => (
                                <Badge key={idx} variant="secondary" className="bg-[#252525] text-gray-300">
                                  {slot}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => setShowAllHappyHours(false)}
                        className="text-[#D35400] hover:text-[#E67E22] font-medium flex items-center gap-1"
                      >
                        Show Less <ChevronUp className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}

            {/* Events */}
            {upcomingEvents.length > 0 && (
              <section>
                <h2 className="text-white font-bold text-xl mb-4 border-l-4 border-[#D35400] pl-3">
                  Upcoming Events
                </h2>
                <div className="space-y-4">
                  {upcomingEvents.map((event: any) => (
                    <div key={event.id} className="bg-[#1E1E1E] p-5 rounded-xl border border-[#333]">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-white font-semibold text-lg">{event.title}</h3>
                          <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {event.startDate ? format(parseISO(event.startDate), "EEEE, MMM d") : daysOfWeek[event.dayOfWeek]}
                            </span>
                            <span>•</span>
                            <span>{event.startTime} - {event.endTime}</span>
                          </div>
                        </div>
                      </div>
                      {event.description && (
                        <p className="text-gray-400 text-sm mb-4">{event.description}</p>
                      )}
                      <div className="flex gap-3">
                        <RsvpButton user={user} event={event} barId={Number(id)} />
                        <a
                          href={generateGoogleCalendarLink(event, bar.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 border border-[#333] text-gray-300 rounded-lg hover:bg-[#252525] transition-colors"
                        >
                          <CalendarPlus className="h-4 w-4" />
                          Add to Calendar
                        </a>
                      </div>
                    </div>
                  ))}
                  {eventsData && eventsData.length > 1 && (
                    <button
                      onClick={() => setShowAllEvents(!showAllEvents)}
                      className="text-[#D35400] hover:text-[#E67E22] font-medium flex items-center gap-1"
                    >
                      {showAllEvents ? (
                        <>Show Less <ChevronUp className="h-4 w-4" /></>
                      ) : (
                        <>View All Events ({eventsData.length}) <ChevronDown className="h-4 w-4" /></>
                      )}
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Reviews */}
            <section>
              <h2 className="text-white font-bold text-xl mb-4 border-l-4 border-[#D35400] pl-3">
                Reviews
              </h2>
              <div className="bg-[#1E1E1E] p-5 rounded-xl border border-[#333]">
                {user && (
                  user.isPhoneVerified ? (
                    <div className="mb-6">
                      <ReviewForm barId={bar.id} />
                    </div>
                  ) : (
                    <CustomModal
                      title="Phone Verification Required"
                      description="Phone verification is required to post reviews."
                      confirmButtonText="Complete onboarding"
                      confirmAction={() => navigate("/complete-onboarding")}
                      trigger={
                        <Button className="mb-6 bg-[#D35400] hover:bg-[#E67E22] text-white font-bold rounded-xl">
                          Write a Review
                        </Button>
                      }
                    />
                  )
                )}
                <ReviewList barId={bar.id} />
              </div>
            </section>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            <div className="sticky top-6 space-y-6">
              {/* Contact Card */}
              <div className="bg-[#1E1E1E] p-5 rounded-xl border border-[#333]">
                <h3 className="text-white font-bold text-lg mb-4">Contact & Hours</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3 group">
                    <MapPin className="h-5 w-5 text-[#D35400] mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-gray-300">{bar.address}</p>
                      <button
                        onClick={copyAddress}
                        className="text-[#D35400] text-sm flex items-center gap-1 mt-1 hover:text-[#E67E22]"
                      >
                        <Copy className="h-3 w-3" /> Copy Address
                      </button>
                    </div>
                  </div>

                  {bar.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-[#D35400] shrink-0" />
                      <a href={`tel:${bar.phone}`} className="text-gray-300 hover:text-white">
                        {bar.phone}
                      </a>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-[#D35400] mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      {bar.hours?.weekday_text?.map((text: string, index: number) => (
                        <p key={index} className="text-gray-300 text-sm">{text}</p>
                      )) || <p className="text-gray-400">Hours not available</p>}
                    </div>
                  </div>
                </div>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(bar.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-[#D35400] hover:bg-[#E67E22] text-white font-bold py-3 rounded-xl shadow-lg transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Get Directions
                </a>
              </div>

              {/* Admin Controls */}
              {user?.isAdmin && (
                <div className="bg-[#1E1E1E] p-5 rounded-xl border border-[#333]">
                  <h3 className="text-white font-bold text-lg mb-4">Admin Controls</h3>
                  <BarOwnershipControls bar={bar} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
