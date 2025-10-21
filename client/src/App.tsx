import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useUser } from "@/hooks/use-user";
import { Loader2 } from "lucide-react";
import NavBar from "@/components/nav-bar";
import { useLocation } from "wouter";
import { OnboardingProvider } from "@/contexts/onboarding-context";
import { ThemeProvider } from "@/contexts/theme-context";
import OnboardingTutorial from "@/components/onboarding-tutorial";
import Footer from "@/components/footer";
// Import all your page components
import PrivacyPolicy from "./pages/privacy-policy";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth-page";
import CompleteOnboarding from "@/pages/complete-onboarding";
import BarDetails from "@/pages/bar-details";
import OwnerDashboard from "@/pages/owner-dashboard";
import VerificationCodes from "@/pages/admin/verification-codes";
import VerificationRequests from "@/pages/admin/verification-requests";
import ManageBars from "@/pages/admin/manage-bars";
import ManageUsers from "@/pages/admin/users";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Profile from "@/pages/profile";
import VerificationStatus from "@/pages/verification-status";
import Learn from "@/pages/learn";
import History from "@/pages/learn/history";
import Kratom from "@/pages/learn/kratom";
import BlueLotus from "@/pages/learn/blue-lotus";
import Kanna from "@/pages/learn/kanna";
import Damiana from "@/pages/learn/damiana";
import ManageBar from "./pages/manage-bar";
import TermsOfService from "./pages/terms-of-service";
import CookiePolicy from "./pages/cookie-policy";
import Welcome from "./pages/welcome";
import Referral from "./pages/referrals";
import AdminPayoutPage from "./pages/admin/payout";
import ManageFeatures from "@/pages/admin/manage-features";
import MyRsvpsPage from "./pages/my-rsvp";
interface ProtectedRouteProps {
  children: React.ReactNode;
  isAllowed: boolean;
  redirectTo?: string;
}

function ProtectedRoute({
  children,
  isAllowed,
  redirectTo = "/auth", // default to login
}: ProtectedRouteProps) {
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!isAllowed) {
      navigate(redirectTo);
    }
  }, [isAllowed, navigate, redirectTo]);

  return isAllowed ? <>{children}</> : null;
}

function Router() {
  const { user, isLoading, error } = useUser();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error) {
    console.error("User authentication error:", error);
  }
  const rawRef =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("ref")
      : null;

  const referralCode = rawRef && rawRef.startsWith("K-") ? rawRef : undefined;

  if (user && user.username === null && user.provider !== "local") {
    const refQuery = referralCode?.startsWith("K-")
      ? `?ref=${referralCode}`
      : "";
    setLocation("/complete-onboarding" + refQuery);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />
      <main className="container mx-auto px-4 py-6 flex-grow">
        <Switch>
          <Route path="/privacy-policy" component={PrivacyPolicy} />
          <Route path="/terms-of-service" component={TermsOfService} />
          <Route path="/cookie-policy" component={CookiePolicy} />
          {/* Public routes */}
          <Route path="/" component={Home} />
          <Route path="/welcome" component={Welcome} />
          <Route path="/kava-bars/:id" component={BarDetails} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password/:token" component={ResetPassword} />
          <Route path="/learn" component={Learn} />
          <Route path="/complete-onboarding" component={CompleteOnboarding} />
          {/* Knowledge Hub Routes */}
          <Route path="/learn/history" component={History} />
          <Route path="/learn/kratom" component={Kratom} />
          <Route path="/learn/blue-lotus" component={BlueLotus} />
          <Route path="/learn/kanna" component={Kanna} />
          <Route path="/learn/damiana" component={Damiana} />
          {/* Protected routes */}
          <Route path="/profile">
            <ProtectedRoute isAllowed={!!user}>
              <Profile />
            </ProtectedRoute>
          </Route>
          <Route path="/my-rsvp">
            <ProtectedRoute isAllowed={!!user}>
              <MyRsvpsPage />
            </ProtectedRoute>
          </Route>
          <Route path="/referrals">
            <ProtectedRoute isAllowed={!!user && user.role === "kavatender"}>
              <Referral />
            </ProtectedRoute>
          </Route>
          <Route path="/owner-dashboard">
            <ProtectedRoute isAllowed={!!user}>
              <OwnerDashboard />
            </ProtectedRoute>
          </Route>
          {/* Admin routes */}
          <Route path="/admin/verification-status">
            <ProtectedRoute isAllowed={!!user?.isAdmin}>
              <VerificationStatus />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/verification-codes">
            <ProtectedRoute isAllowed={!!user?.isAdmin}>
              <VerificationCodes />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/verification-requests">
            <ProtectedRoute isAllowed={!!user?.isAdmin}>
              <VerificationRequests />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/manage-bars">
            <ProtectedRoute isAllowed={!!user?.isAdmin}>
              <ManageBars />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/manage-features">
            <ProtectedRoute isAllowed={!!user?.isAdmin}>
              <ManageFeatures />
            </ProtectedRoute>
          </Route>
          <Route path="/admin/users">
            <ProtectedRoute isAllowed={!!user?.isAdmin}>
              <ManageUsers />
            </ProtectedRoute>
          </Route>

          <Route path="/admin/payouts">
            <ProtectedRoute isAllowed={!!user?.isAdmin}>
              <AdminPayoutPage />
            </ProtectedRoute>
          </Route>
          <Route path="/manage-bar/:id">
            <ProtectedRoute isAllowed={!!user}>
              <ManageBar />
            </ProtectedRoute>
          </Route>
          {/* Fallback */}
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="mykavabar-theme">
        <OnboardingProvider>
          <Router />
          <Toaster />
          <OnboardingTutorial />
        </OnboardingProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
