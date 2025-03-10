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
import ConnectionStatus from "@/components/connection-status";
import { MapProvider } from "@/components/map-provider";
import Footer from "@/components/footer";
// Import all your page components
import PrivacyPolicy from "./pages/privacy-policy";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth-page";
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

interface ProtectedRouteProps {
  children: React.ReactNode;
  isAllowed: boolean;
}

function ProtectedRoute({ children, isAllowed }: ProtectedRouteProps) {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAllowed) {
      navigate("/auth");
    }
  }, [isAllowed, navigate]);

  return isAllowed ? <>{children}</> : null;
}

function Router() {
  const { user, isLoading, error } = useUser();

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
          <Route path="/kava-bars/:id" component={BarDetails} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password/:token" component={ResetPassword} />
          <Route path="/learn" component={Learn} />

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
          <Route path="/admin/users">
            <ProtectedRoute isAllowed={!!user?.isAdmin}>
              <ManageUsers />
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
          <MapProvider>
            <Router />
            <ConnectionStatus />
            <Toaster />
            <OnboardingTutorial />
          </MapProvider>
        </OnboardingProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
