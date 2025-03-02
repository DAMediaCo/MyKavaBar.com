import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Loader2, X } from "lucide-react";
import { z } from "zod";

type StaffMember = {
  id: number;
  userId: number;
  barId: number;
  hireDate: string;
  isActive: boolean;
  position: string;
  user: {
    username: string;
    email: string;
    phoneNumber: string | null;
  };
};

const phoneRegex = /^\+?1?\d{10}$/;

const addStaffSchema = z.object({
  phoneNumber: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .max(12, "Phone number must not exceed 12 digits")
    .regex(phoneRegex, "Please enter a valid phone number (10 digits)")
});

export default function BarStaff({ barId, ownerId }: { barId: number; ownerId: number | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: staff, isLoading } = useQuery<StaffMember[]>({
    queryKey: [`/api/bars/${barId}/staff`],
    queryFn: async () => {
      console.log('Fetching staff members...');
      const response = await fetch(`/api/bars/${barId}/staff`, {
        credentials: "include",
      });
      if (!response.ok) {
        console.error('Staff fetch error:', { 
          status: response.status, 
          statusText: response.statusText 
        });
        throw new Error(await response.text());
      }
      const data = await response.json();
      console.log('Staff members loaded:', data);
      return data;
    },
    enabled: !!barId,
  });

  const addStaffMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      console.log("Submitting phone number:", phoneNumber);
      const response = await fetch(`/api/bars/${barId}/staff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ phoneNumber: phoneNumber }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        console.error('Add staff error:', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorData 
        });
        throw new Error(errorData.error || "Failed to add staff member");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bars/${barId}/staff`] });
      setIsAddStaffOpen(false);
      setPhoneNumber("");
      setFormError(null);
      toast({
        title: "Success",
        description: "Staff member added successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Add staff mutation error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const removeStaffMutation = useMutation({
    mutationFn: async (staffId: number) => {
      const response = await fetch(`/api/bars/${barId}/staff/${staffId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bars/${barId}/staff`] });
      toast({
        title: "Success",
        description: "Staff member removed successfully",
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

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      // Format phone number to remove any non-digits
      const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');

      // Validate the cleaned phone number
      const result = addStaffSchema.parse({ phoneNumber: cleanedPhoneNumber });

      console.log("Validated phone number:", result.phoneNumber); // Debug log
      addStaffMutation.mutate(result.phoneNumber);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setFormError(error.errors[0].message);
      } else {
        setFormError("An unexpected error occurred");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Staff Members</h2>
        {staff && (
          <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Staff Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Staff Member</DialogTitle>
                <DialogDescription>
                  Enter the phone number of the person you want to add as staff. The phone number must be verified in our system.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddStaff}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Enter phone number (e.g., 1234567890)"
                      type="tel"
                      pattern="[0-9]*"
                    />
                    {formError && (
                      <p className="text-sm text-destructive">{formError}</p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addStaffMutation.isPending}>
                    {addStaffMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Add Staff Member
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {staff && staff.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Hire Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.user.username}</TableCell>
                <TableCell>{member.user.email}</TableCell>
                <TableCell>{member.user.phoneNumber || "N/A"}</TableCell>
                <TableCell>{member.position}</TableCell>
                <TableCell>{new Date(member.hireDate).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStaffMutation.mutate(member.id)}
                    disabled={removeStaffMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove staff member</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          No staff members found
        </div>
      )}
    </div>
  );
}