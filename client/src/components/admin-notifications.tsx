import { useEffect, useState } from "react";
import { useUser } from "@/hooks/use-user";
import { Bell } from "lucide-react";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { VerificationRequest } from "@db/schema";

export default function AdminNotifications() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pending verification requests
  const { data: notifications = [] } = useQuery<VerificationRequest[]>({
    queryKey: ['/api/admin/verification-requests'],
    enabled: !!user?.isAdmin,
  });

  // WebSocket connection
  useEffect(() => {
    if (!user?.isAdmin) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connected');
      socket.send(JSON.stringify({
        type: 'AUTH',
        userId: user.id,
        isAdmin: true
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received WebSocket message:', data);

        if (data.type === 'VERIFICATION_REQUEST') {
          // Invalidate the query to refetch the latest data
          queryClient.invalidateQueries(['/api/admin/verification-requests']);

          toast({
            title: "New Verification Request",
            description: `${data.data.barName} needs verification`,
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      // Try to reconnect after 5 seconds
      setTimeout(() => {
        if (user?.isAdmin) {
          setWs(null); // This will trigger a reconnect
        }
      }, 5000);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [user, queryClient]);

  const handleApprove = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await fetch(`/api/admin/verification-requests/${requestId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || errorJson.message || 'Failed to approve request');
        } catch (e) {
          throw new Error(errorText || 'Failed to approve request');
        }
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['/api/admin/verification-requests']);
      queryClient.invalidateQueries(['/api/kava-bars']); // Refresh bar data
      toast({
        title: "Request Approved",
        description: "The verification request has been approved.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleDeny = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await fetch(`/api/admin/verification-requests/${requestId}/deny`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to deny request');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['/api/admin/verification-requests']);
      toast({
        title: "Request Denied",
        description: "The verification request has been denied.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  if (!user?.isAdmin) return null;

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center"
            >
              {notifications.length}
            </Badge>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Notifications</DrawerTitle>
          <DrawerDescription>
            Bar verification requests and other admin notifications
          </DrawerDescription>
        </DrawerHeader>
        <div className="p-4 space-y-4">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground">No new notifications</p>
          ) : (
            notifications.map((notification) => {
              const timestamp = new Date(notification.createdAt);
              const isValidDate = !isNaN(timestamp.getTime());

              return (
                <div 
                  key={notification.id} 
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">{notification.barName}</h4>
                      <p className="text-sm text-muted-foreground">
                        Requested by {notification.requesterName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Phone: {notification.phoneNumber}
                      </p>
                    </div>
                    <div className="space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDeny.mutate(notification.id)}
                        disabled={handleDeny.isPending}
                      >
                        Deny
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleApprove.mutate(notification.id)}
                        disabled={handleApprove.isPending}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isValidDate 
                      ? timestamp.toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })
                      : 'Invalid date'}
                  </p>
                </div>
              );
            })
          )}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}