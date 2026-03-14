import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Ban, Shield, Trash2, UserCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

function fullName(user: any) {
  if (!user) return null;
  const f = user.firstName?.trim() || "";
  const l = user.lastName?.trim() || "";
  return f || l ? `${f} ${l}`.trim() : null;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [banUser, setBanUser] = useState<any>(null);
  const [banReason, setBanReason] = useState("");
  const [unbanUser, setUnbanUser] = useState<any>(null);
  const [deleteUser, setDeleteUser] = useState<any>(null);

  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phoneNumber?.includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q)
    );
  });

  const banMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${banUser.id}/ban`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: banReason }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed"); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User banned" });
      setBanUser(null); setBanReason("");
    },
    onError: (e: any) => toast({ title: "Ban failed", description: e.message, variant: "destructive" }),
  });

  const unbanMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${unbanUser.id}/unban`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User unbanned" });
      setUnbanUser(null);
    },
    onError: (e: any) => toast({ title: "Unban failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed"); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted" });
      setDeleteUser(null);
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading users…</div>;

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <span className="text-sm text-gray-500">{filtered.length} / {users.length} users</span>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, username, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* User cards */}
      <div className="space-y-3">
        {filtered.map((user) => {
          const isBanned = user.status === "banned";
          const name = fullName(user);
          return (
            <div
              key={user.id}
              className={`bg-white rounded-xl border p-4 shadow-sm ${isBanned ? "border-red-200 opacity-80" : "border-gray-200"}`}
            >
              {/* Top row: avatar + info */}
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shrink-0 text-white ${
                  user.isAdmin ? "bg-[#D35400]" : isBanned ? "bg-red-500" : "bg-gray-400"
                }`}>
                  {(user.username?.[0] || "?").toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name + badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="font-semibold text-gray-900 text-sm">{user.username}</span>
                    {name && <span className="text-gray-500 text-xs">({name})</span>}
                    {user.isAdmin && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[#D35400] bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                        <Shield className="h-2.5 w-2.5" /> ADMIN
                      </span>
                    )}
                    {isBanned && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                        BANNED
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs truncate">{user.email}</p>
                  {user.phoneNumber && <p className="text-gray-400 text-xs">{user.phoneNumber}</p>}
                  {isBanned && user.banReason && (
                    <p className="text-red-500 text-xs mt-1 italic">Ban reason: {user.banReason}</p>
                  )}
                  <p className="text-gray-400 text-[10px] mt-1">
                    #{user.id} · {user.points || 0} pts · {user.isPhoneVerified ? "✓ verified" : "unverified"}
                  </p>
                </div>
              </div>

              {/* Action row */}
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                {isBanned ? (
                  <Button size="sm" variant="outline"
                    className="text-green-600 border-green-300 hover:bg-green-50 text-xs h-7"
                    onClick={() => setUnbanUser(user)}>
                    <UserCheck className="h-3 w-3 mr-1" /> Unban
                  </Button>
                ) : (
                  <Button size="sm" variant="outline"
                    className="text-red-500 border-red-200 hover:bg-red-50 text-xs h-7"
                    onClick={() => { setBanUser(user); setBanReason(""); }}>
                    <Ban className="h-3 w-3 mr-1" /> Ban
                  </Button>
                )}

                <Button size="sm" variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7 ml-auto"
                  onClick={() => setDeleteUser(user)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-12">No users found</p>
        )}
      </div>

      {/* Ban Dialog */}
      <Dialog open={!!banUser} onOpenChange={(o) => { if (!o) { setBanUser(null); setBanReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500 flex items-center gap-2">
              <Ban className="h-4 w-4" /> Ban {banUser?.username}
            </DialogTitle>
            <DialogDescription>
              Bans user and blacklists phone {banUser?.phoneNumber ? `(${banUser.phoneNumber})` : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason <span className="text-red-500">*</span></Label>
            <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)}
              placeholder="e.g. Spam, harassment…" rows={3} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setBanUser(null); setBanReason(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={!banReason.trim() || banMutation.isPending} onClick={() => banMutation.mutate()}>
              {banMutation.isPending ? "Banning…" : "Confirm Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unban Dialog */}
      <Dialog open={!!unbanUser} onOpenChange={(o) => { if (!o) setUnbanUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-green-600">Unban {unbanUser?.username}?</DialogTitle>
            <DialogDescription>
              Restores access and removes phone from blacklist.
              {unbanUser?.banReason && (
                <span className="block mt-2 text-amber-600 text-sm">Was banned for: {unbanUser.banReason}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUnbanUser(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={unbanMutation.isPending} onClick={() => unbanMutation.mutate()}>
              {unbanMutation.isPending ? "Unbanning…" : "Confirm Unban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(o) => { if (!o) setDeleteUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Delete User
            </DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteUser?.username}</strong>
              {fullName(deleteUser) ? ` (${fullName(deleteUser)})` : ""}?{" "}
              This cannot be undone. All their data, reviews, and check-ins will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              {deleteMutation.isPending ? "Deleting…" : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
