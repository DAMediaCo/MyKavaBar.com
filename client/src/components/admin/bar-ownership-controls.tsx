import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { KavaBar } from "@db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface BarOwnershipControlsProps {
  bar: KavaBar;
}

export default function BarOwnershipControls({ bar }: BarOwnershipControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const removeOwnershipMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/bars/${bar.id}/remove-owner`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ownership Removed",
        description: "Successfully removed bar ownership",
      });
      setIsOpen(false);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/kava-bars'] });
      queryClient.invalidateQueries({ queryKey: [`/api/kava-bars/${bar.id}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!bar.ownerId) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="destructive"
          size="sm"
          className="w-full mt-2"
        >
          Remove Owner
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Bar Ownership</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove the current owner of {bar.name}? This action will:
            <ul className="list-disc list-inside mt-2">
              <li>Remove the owner's access to manage this bar</li>
              <li>Change their role back to regular user</li>
              <li>Make the bar available for new ownership claims</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              removeOwnershipMutation.mutate();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove Ownership
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
