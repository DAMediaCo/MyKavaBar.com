import { useState } from "react";
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
  Settings,
  DollarSign,
  Menu,
  Map,
  Trophy,
  Award,
  Calendar,
  ShieldCheck,
} from "lucide-react";

import { Link, useLocation } from "wouter";
import AdminNotifications from "@/components/admin-notifications";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
} from "@/components/ui/sheet";

export default function NavBar() {
  const { user, logout } = useUser();
  const [, navigate] = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  const navLinks = [
    {
      href: "/blog",
      label: "Blog",
      icon: <BookOpen className="h-4 w-4" />,
      show: true,
    },
    {
      href: "/events",
      label: "Events",
      icon: <Calendar className="h-4 w-4" />,
      show: true,
    },
    {
      href: "/leaderboard",
      label: "Leaderboard",
      icon: <Trophy className="h-4 w-4" />,
      show: true,
    },
    {
      href: "/passport",
      label: "Passport",
      icon: <Map className="h-4 w-4" />,
      show: !!user,
    },
    {
      href: "/welcome",
      label: "About",
      icon: null,
      show: !user,
    },
  ];

  const adminLinks = [
    { href: "/admin/manage-bars",       label: "Manage Bars",         icon: <ListPlus className="h-4 w-4" /> },
    { href: "/admin/users",             label: "Manage Users",        icon: <Users className="h-4 w-4" /> },
    { href: "/admin/manage-features",   label: "Manage Features",     icon: <Settings className="h-4 w-4" /> },
    { href: "/admin/payouts",           label: "Referral Payouts",    icon: <DollarSign className="h-4 w-4" /> },

  ];

  function handleSheetNav(to: string) {
    setSheetOpen(false);
    navigate(to);
  }

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="text-xl font-bold tracking-tight text-black dark:text-white">
            MyKava<span className="text-[#D35400]">Bar</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-2">
          {navLinks.filter((l) => l.show).map((link) => (
            <Link key={link.href} href={link.href}>
              <Button variant="ghost" className="flex items-center gap-2">
                {link.icon}
                {link.label}
              </Button>
            </Link>
          ))}

          {user?.isAdmin && <AdminNotifications />}

          {user ? (
            <>
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
                  <DropdownMenuLabel>{user.username}</DropdownMenuLabel>
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
                  {(user.role === "bar_owner" || user.role === "admin") && (
                    <Link href="/owner-dashboard">
                      <DropdownMenuItem className="cursor-pointer">
                        <Building2 className="h-4 w-4 mr-2" />
                        Bar Owner Dashboard
                      </DropdownMenuItem>
                    </Link>
                  )}
                  {user.isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-[#D35400] uppercase tracking-wider flex items-center gap-1 py-1">
                        <ShieldCheck className="h-3 w-3" /> Admin
                      </DropdownMenuLabel>
                      {adminLinks.map((link) => (
                        <Link key={link.href} href={link.href}>
                          <DropdownMenuItem className="cursor-pointer">
                            <span className="mr-2">{link.icon}</span>
                            {link.label}
                          </DropdownMenuItem>
                        </Link>
                      ))}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { logout(); navigate("/"); }}
                    className="text-sm"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            </>
          )}
        </div>

        {/* Mobile Hamburger Menu */}
        <div className="md:hidden flex items-center space-x-2">
          {user?.isAdmin && <AdminNotifications />}
          <ThemeToggle />
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[250px] p-0 overflow-y-auto">
              <SheetHeader className="border-b p-4 mb-2">
                <h2 className="text-xl font-bold tracking-tight text-black dark:text-white">
                  MyKava<span className="text-[#D35400]">Bar</span>
                </h2>
              </SheetHeader>
              <div className="p-4 flex flex-col space-y-3">
                {navLinks.filter((l) => l.show).map((link) => (
                  <Button
                    key={link.href}
                    variant="ghost"
                    className="w-full flex justify-start gap-2"
                    onClick={() => handleSheetNav(link.href)}
                  >
                    {link.icon}
                    {link.label}
                  </Button>
                ))}

                {user ? (
                  <>
                    <Button variant="ghost" className="w-full flex justify-start gap-2" onClick={() => handleSheetNav("/profile")}>
                      <User className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                    {user.role === "kavatender" && (
                      <Button variant="ghost" className="w-full flex justify-start gap-2" onClick={() => handleSheetNav("/referrals")}>
                        <Share className="h-4 w-4 mr-2" />
                        Referrals
                      </Button>
                    )}
                    {(user.role === "bar_owner" || user.role === "admin") && (
                      <Button variant="ghost" className="w-full flex justify-start gap-2" onClick={() => handleSheetNav("/owner-dashboard")}>
                        <Building2 className="h-4 w-4 mr-2" />
                        Bar Owner Dashboard
                      </Button>
                    )}

                    {/* Admin Section — mobile */}
                    {user.isAdmin && (
                      <>
                        <div className="border-t pt-3">
                          <p className="text-xs text-[#D35400] font-semibold uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" /> Admin
                          </p>
                          {adminLinks.map((link) => (
                            <Button
                              key={link.href}
                              variant="ghost"
                              className="w-full flex justify-start gap-2 mb-1"
                              onClick={() => handleSheetNav(link.href)}
                            >
                              {link.icon}
                              {link.label}
                            </Button>
                          ))}
                        </div>
                      </>
                    )}

                    <Button
                      variant="outline"
                      className="w-full flex justify-start gap-2"
                      onClick={() => { setSheetOpen(false); logout(); navigate("/"); }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => handleSheetNav("/auth")}>
                    Sign In
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
