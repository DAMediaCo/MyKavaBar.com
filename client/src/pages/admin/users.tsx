import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Search } from "lucide-react";

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Enhanced error handling in the fetch request
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      try {
        console.log('Fetching admin users data...');
        const response = await fetch('/api/admin/users', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          }
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error response:', errorData);
          throw new Error(errorData.error || 'Failed to fetch users');
        }

        const data = await response.json();
        console.log('Fetched users:', data);
        return data;
      } catch (err) {
        console.error('Fetch error:', err);
        throw err;
      }
    },
    retry: false,
    onError: (error: any) => {
      console.error('Query error:', error);
      toast({
        title: "Error Loading Users",
        description: error.message || "Please check your admin access and try again.",
        variant: "destructive",
      });
    }
  });

  // Show error state
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Error Loading Users</h2>
          <p className="mt-2 text-gray-600">
            {error instanceof Error ? error.message : "Failed to load users. Please check your admin access and try again."}
          </p>
          <Button 
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] })}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Loading Users...</h2>
          <p className="mt-2 text-gray-600">Please wait while we fetch the user data.</p>
        </div>
      </div>
    );
  }

  // Handle empty users array
  if (!users || users.length === 0) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">No Users Found</h2>
          <p className="mt-2 text-gray-600">There are currently no users in the system.</p>
        </div>
      </div>
    );
  }

  // Filter users based on search query
  const filteredUsers = users.filter((user: any) => {
    if (!user) return false;
    const searchLower = searchQuery.toLowerCase();
    return (
      user.username?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.phoneNumber?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account
              </DialogDescription>
            </DialogHeader>
            {/* Add user form - This section is intentionally left blank as per the edited code */}
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Phone</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user: any) => (
            <TableRow key={user.id}>
              <TableCell>{user.username}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>{user.status}</TableCell>
              <TableCell>{user.phoneNumber}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}