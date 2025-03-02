import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bell, Image, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface NotificationPreferences {
  id: number;
  userId: number;
  reviewNotifications: boolean;
  photoNotifications: boolean;
  updatedAt: string;
}

export default function NotificationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['/api/owner/notification-preferences'],
    queryFn: async () => {
      const response = await fetch('/api/owner/notification-preferences', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notification preferences');
      }

      return response.json();
    }
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: Partial<NotificationPreferences>) => {
      const response = await fetch('/api/owner/notification-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPreferences),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/owner/notification-preferences'], data);
      toast({
        title: "Settings Updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleReviews = (checked: boolean) => {
    updatePreferencesMutation.mutate({ reviewNotifications: checked });
  };

  const handleTogglePhotos = (checked: boolean) => {
    updatePreferencesMutation.mutate({ photoNotifications: checked });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded" />
            <div className="h-8 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="review-notifications">Review Notifications</Label>
          </div>
          <Switch
            id="review-notifications"
            checked={preferences?.reviewNotifications ?? false}
            onCheckedChange={handleToggleReviews}
            disabled={updatePreferencesMutation.isPending}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="photo-notifications">Photo Upload Notifications</Label>
          </div>
          <Switch
            id="photo-notifications"
            checked={preferences?.photoNotifications ?? false}
            onCheckedChange={handleTogglePhotos}
            disabled={updatePreferencesMutation.isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}