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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Search, Edit, Ban } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Zod schema for all editable fields
const AdminUserSchema = z.object({
  username: z
    .string()
    .min(4, { message: "Username must be at least 4 characters" })
    .max(20, { message: "Username must be 20 characters or less" })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: "Only letters, numbers, and _ allowed",
    }),
  email: z.string().email({ message: "Invalid email address" }),
  phoneNumber: z
    .string()
    .min(10, { message: "Must be a valid mobile number" })
    .max(15, { message: "Number too long" })
    .regex(/^[+\d][\d\s\-]{7,15}$/, { message: "Invalid phone number" }),
  password: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 8, {
      message: "Password must be at least 8 characters",
    }),
});

type AdminUserForm = z.infer<typeof AdminUserSchema>;

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editUser, setEditUser] = useState<any | null>(null);
  const [banUser, setBanUser] = useState<any | null>(null);
  const [banReason, setBanReason] = useState("");
  const [isBanning, setIsBanning] = useState(false);

  async function handleBan() {
    if (!banUser || !banReason.trim()) return;
    setIsBanning(true);
    try {
      const resp = await fetch(`/api/admin/users/${banUser.id}/ban`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: banReason }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.error || "Failed to ban user");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Banned", description: `${banUser.username} has been banned and their phone number blacklisted.` });
      setBanUser(null);
      setBanReason("");
    } catch (err: any) {
      toast({ title: "Ban Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsBanning(false);
    }
  }

  // Query for users
  const {
    data: users,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch users");
      }
      return await response.json();
    },
    retry: false,
    onError: (error: any) => {
      toast({
        title: "Error Loading Users",
        description:
          error.message || "Please check your admin access and try again.",
        variant: "destructive",
      });
    },
  });

  // Search users
  const filteredUsers =
    users?.filter((user: any) => {
      if (!user) return false;
      const searchLower = searchQuery.toLowerCase();
      return (
        user.username?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.phoneNumber?.toLowerCase().includes(searchLower)
      );
    }) || [];

  // Edit dialog form
  function EditUserDialog({
    user,
    open,
    setOpen,
  }: {
    user: any;
    open: boolean;
    setOpen: (v: boolean) => void;
  }) {
    const {
      register,
      handleSubmit,
      formState: { errors, isSubmitting },
      reset,
    } = useForm<AdminUserForm>({
      resolver: zodResolver(AdminUserSchema),
      defaultValues: {
        username: user?.username || "",
        email: user?.email || "",
        phoneNumber: user?.phoneNumber || "",
        password: "",
      },
    });
    async function onSubmit(data: AdminUserForm) {
      try {
        const resp = await fetch(`/api/admin/users/${user.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!resp.ok) {
          // Try to extract error message from response body
          const errorData = await resp.json().catch(() => null);
          const errMsg =
            errorData?.error || errorData?.message || "Could not update user.";

          toast({
            title: "Update Failed",
            description: errMsg,
            variant: "destructive",
          });

          return;
        }

        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        setOpen(false);
        toast({
          title: "User Updated",
          description: "User details updated successfully.",
        });
      } catch (err: any) {
        toast({
          title: "Update Failed",
          description: err.message || "Could not update user.",
          variant: "destructive",
        });
      }
    }

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details and reset password if needed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Label>Username</Label>
            <Input {...register("username")} />
            {errors.username && (
              <span className="text-red-600">{errors.username.message}</span>
            )}

            <Label>Phone Number</Label>
            <Input {...register("phoneNumber")} />
            {errors.phoneNumber && (
              <span className="text-red-600">{errors.phoneNumber.message}</span>
            )}
            {user.provider === "local" && (
              <>
                <Label>Email</Label>
                <Input {...register("email")} />
                {errors.email && (
                  <span className="text-red-600">{errors.email.message}</span>
                )}

                <Label>New Password</Label>
                <Input type="password" {...register("password")} />
                {errors.password && (
                  <span className="text-red-600">
                    {errors.password.message}
                  </span>
                )}
              </>
            )}
            <DialogFooter>
              <div className="mt-3">
                <Button type="submit" disabled={isSubmitting}>
                  Update
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reset()}
                  disabled={isSubmitting}
                >
                  Reset Form
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">
            Error Loading Users
          </h2>
          <p className="mt-2 text-gray-600">
            {error instanceof Error
              ? error.message
              : "Failed to load users. Please check your admin access and try again."}
          </p>
          <Button
            className="mt-4"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })
            }
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Loading Users...</h2>
          <p className="mt-2 text-gray-600">
            Please wait while we fetch the user data.
          </p>
        </div>
      </div>
    );
  }

  // No users found state
  if (!users || users.length === 0) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">No Users Found</h2>
          <p className="mt-2 text-gray-600">
            There are currently no users in the system.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        {/* Add user dialog code... (not implemented here) */}
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
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user: any) => (
            <TableRow key={user.id} className={user.status === "banned" ? "opacity-50" : ""}>
              <TableCell className="font-medium">{user.username}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>
                {user.status === "banned" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-900/40 text-red-400 border border-red-800">
                    <Ban className="h-3 w-3" /> Banned
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-900/40 text-green-400 border border-green-800">
                    Active
                  </span>
                )}
              </TableCell>
              <TableCell>{user.phoneNumber}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditUser(user)} title="Edit user">
                    <Edit className="h-4 w-4" />
                  </Button>
                  {user.status !== "banned" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setBanUser(user); setBanReason(""); }}
                      className="text-red-500 hover:text-red-400 hover:bg-red-900/20"
                      title="Ban user"
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {editUser?.id === user.id && (
                  <EditUserDialog
                    user={user}
                    open={!!editUser}
                    setOpen={(open) => { if (!open) setEditUser(null); }}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Ban Confirmation Dialog */}
      <Dialog open={!!banUser} onOpenChange={(open) => { if (!open) { setBanUser(null); setBanReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Ban className="h-5 w-5" /> Ban User
            </DialogTitle>
            <DialogDescription>
              This will permanently ban <strong>{banUser?.username}</strong> and blacklist their phone number{banUser?.phoneNumber ? ` (${banUser.phoneNumber})` : ""}. They will not be able to log in or re-register with this phone number.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="ban-reason">Reason for ban <span className="text-red-500">*</span></Label>
            <Textarea
              id="ban-reason"
              placeholder="e.g. Posted explicit content, repeated profanity in reviews..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setBanUser(null); setBanReason(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBan}
              disabled={isBanning || !banReason.trim()}
            >
              {isBanning ? "Banning..." : "Confirm Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
