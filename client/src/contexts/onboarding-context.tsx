import { createContext, useContext, useState, useEffect } from "react";

type OnboardingContextType = {
  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (seen: boolean) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  isOnboardingOpen: boolean;
  startOnboarding: () => void;
  closeOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('hasSeenOnboarding') === 'true';
        console.log('Initial hasSeenOnboarding:', stored);
        return stored;
      }
      return false;
    } catch {
      console.error('Failed to read from localStorage');
      return false;
    }
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  useEffect(() => {
    // Check if the app is running as a PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                 (window.navigator as any).standalone || 
                 document.referrer.includes('android-app://');

    console.log('PWA detection:', {
      isStandalone: window.matchMedia('(display-mode: standalone)').matches,
      iosStandalone: (window.navigator as any).standalone,
      androidApp: document.referrer.includes('android-app://'),
      isPWA,
      hasSeenOnboarding,
      isDevelopment: process.env.NODE_ENV === 'development'
    });

    // Show onboarding for first-time PWA users or in development
    if ((!hasSeenOnboarding && isPWA) || 
        (!hasSeenOnboarding && process.env.NODE_ENV === 'development')) {
      console.log('Auto-opening onboarding tutorial');
      setIsOnboardingOpen(true);
    }
  }, [hasSeenOnboarding]);

  // Save onboarding state to localStorage when changed
  useEffect(() => {
    try {
      if (hasSeenOnboarding) {
        localStorage.setItem('hasSeenOnboarding', 'true');
        console.log('Saved hasSeenOnboarding to localStorage');
      }
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  }, [hasSeenOnboarding]);

  const startOnboarding = () => {
    console.log('Starting onboarding tutorial');
    setCurrentStep(0);
    setIsOnboardingOpen(true);
  };

  const closeOnboarding = () => {
    console.log('Closing onboarding tutorial');
    setIsOnboardingOpen(false);
    setHasSeenOnboarding(true);
  };

  const value = {
    hasSeenOnboarding,
    setHasSeenOnboarding,
    currentStep,
    setCurrentStep,
    isOnboardingOpen,
    startOnboarding,
    closeOnboarding,
  };

  console.log('OnboardingContext state:', value);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}