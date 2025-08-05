import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  LogOut,
  Building2,
  Shield,
  ListPlus,
  BookOpen,
  Share,
  Users,
} from "lucide-react";

import { Link, useLocation } from "wouter";
import AdminNotifications from "@/components/admin-notifications";
import { ThemeToggle } from "@/components/theme-toggle";

export default function NavBar() {
  const { user, logout } = useUser();
  const [, navigate] = useLocation();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/">
            <h1 className="text-xl font-bold cursor-pointer">MyKavaBar</h1>
          </Link>
        </div>

        {user ? (
          <div className="flex items-center space-x-2">
            <Link href="/learn">
              <Button variant="ghost" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Learn
              </Button>
            </Link>
            {user.isAdmin && <AdminNotifications />}
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Avatar>
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex justify-between items-center">
                    <span>{user.username}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/profile">
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    Edit Profile
                  </DropdownMenuItem>
                </Link>
                {user.role === "kavatender" && (
                  <Link href="/referrals">
                    <DropdownMenuItem className="cursor-pointer">
                      <Share className="h-4 w-4 mr-2" />
                      Referrals
                    </DropdownMenuItem>
                  </Link>
                )}
                {user.role === "bar_owner" && (
                  <Link href="/owner-dashboard">
                    <DropdownMenuItem className="cursor-pointer">
                      <Building2 className="h-4 w-4 mr-2" />
                      Bar Owner Dashboard
                    </DropdownMenuItem>
                  </Link>
                )}
                {user.isAdmin && (
                  <>
                    <Link href="/admin/verification-codes">
                      <DropdownMenuItem className="cursor-pointer">
                        <Shield className="h-4 w-4 mr-2" />
                        Verification Codes
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/admin/manage-bars">
                      <DropdownMenuItem className="cursor-pointer">
                        <ListPlus className="h-4 w-4 mr-2" />
                        Manage Bars
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/admin/users">
                      <DropdownMenuItem className="cursor-pointer">
                        <Users className="h-4 w-4 mr-2" />
                        Manage Users
                      </DropdownMenuItem>
                    </Link>
                  </>
                )}
                <DropdownMenuItem onClick={() => logout()} className="text-sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Link href="/learn">
              <Button variant="ghost" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Learn
              </Button>
            </Link>
            <Link href="/welcome">
              <Button variant="ghost" className="flex items-center gap-2">
                About
              </Button>
            </Link>
            <ThemeToggle />
            <Button variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
