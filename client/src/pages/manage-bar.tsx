import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Loader2, UploadCloud, AlertCircle, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { z } from "zod";
import { hoursFormSchema } from "@/lib/validations/hours";
import { EventForm } from "@/components/event-form";
import { BarEvents } from "@/components/bar-events";
import { Separator } from "@/components/ui/separator";
import UploadPhotoForm from "@/components/upload-photo-form";
import AdminVerificationPanel from "@/components/admin/admin-verification-panel";
import BarDetailsForm from "@/components/bar-details-form";
import HoursForm from "@/components/hours-form";
import StaffManagement from "@/components/staff-management";
import OwnerNotificationPreferences from "@/components/owner-notification-preferences";
import PhotoGalleryManagement from "@/components/photo-gallery-management";
import SpecialsForm from "@/components/specials-form";
import { usePrivateQuery } from "@/hooks/use-private-query";

type HoursFormValues = z.infer<typeof hoursFormSchema>;

export default function ManageBar() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoadingBar, setIsLoadingBar] = useState(true);

  // Update the error handling in the fetch query
  const {
    data: bar,
    isLoading: isLoadingBarQuery,
    error: barError,
  } = usePrivateQuery({
    queryKey: [`/api/kava-bars/${id}`],
    queryFn: async () => {
      console.log('Fetching bar details:', id);
      const response = await fetch(`/api/kava-bars/${id}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch bar details' }));
        console.error('Bar details error response:', errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to fetch bar details');
      }

      const data = await response.json();
      console.log('Bar details successfully loaded:', data);
      return data;
    },
    retry: 1,
    enabled: !!id
  });

  const isLoading = isLoadingBarQuery;

  useEffect(() => {
    if (barError) {
      console.error("Error fetching bar details:", barError);
      toast({
        variant: "destructive",
        title: "Error",
        description: barError instanceof Error ? barError.message : "Failed to load bar details",
      });
    }
  }, [barError, toast]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Update the error display component
  if (barError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Bar Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground mb-4">
              {barError instanceof Error ? barError.message : "Failed to load bar details"}
            </p>
            <div className="flex justify-center">
              <Button 
                className="mt-4"
                onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/kava-bars/${id}`] })}
              >
                Retry Loading
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!bar) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-red-500">Bar not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Manage {bar.name}</h1>

      <div className="mb-8">
        <Link href={`/bars/${id}`}>
          <Button variant="outline">View Public Page</Button>
        </Link>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:flex md:flex-wrap md:gap-2">
          <TabsTrigger value="details">Bar Details</TabsTrigger>
          <TabsTrigger value="hours">Operating Hours</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="specials">Daily Specials</TabsTrigger>
          <TabsTrigger value="staff">Staff Management</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {bar.isAdmin && <TabsTrigger value="admin">Admin</TabsTrigger>}
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bar Details</CardTitle>
              <CardDescription>
                Update your bar's basic information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarDetailsForm bar={bar} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operating Hours</CardTitle>
              <CardDescription>
                Set your regular operating hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HoursForm barId={bar.id} existingHours={bar.hoursData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <CardDescription>
                Manage your upcoming events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Upcoming Events</h3>
                <BarEvents barId={bar.id} isEditable={true} />
              </div>
              <Separator className="my-6" />
              <div>
                <h3 className="text-lg font-semibold mb-4">Add New Event</h3>
                <EventForm barId={bar.id} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
              <CardDescription>
                Upload and manage your bar photos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Upload New Photo</h3>
                  <UploadPhotoForm barId={bar.id} />
                </div>
                <Separator className="my-6" />
                <div>
                  <h3 className="text-lg font-semibold mb-4">Photo Gallery</h3>
                  <PhotoGalleryManagement barId={bar.id} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="specials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Specials</CardTitle>
              <CardDescription>
                Manage your weekly specials and promotions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SpecialsForm barId={bar.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Management</CardTitle>
              <CardDescription>
                Manage your kavatenders and staff members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaffManagement barId={bar.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Manage how you'd like to be notified
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OwnerNotificationPreferences />
            </CardContent>
          </Card>
        </TabsContent>

        {bar.isAdmin && (
          <TabsContent value="admin" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Admin Controls</CardTitle>
                <CardDescription>
                  Administrative tools for this bar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminVerificationPanel bar={bar} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}