import { motion, AnimatePresence } from "framer-motion";
import { useOnboarding } from "@/contexts/onboarding-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Search, MapPin, Star, Share2, Plus } from "lucide-react";

const steps = [
  {
    title: "Welcome to MyKavaBar!",
    description: "Your guide to discovering the best kava bars. Let's get started!",
    icon: <Star className="w-12 h-12 text-primary" />,
  },
  {
    title: "Install the App",
    description: "Add MyKavaBar to your home screen!\n\niOS: Tap the share button (📤) in Safari, then 'Add to Home Screen'\nAndroid: Tap the menu (⋮) in Chrome, then 'Install App'",
    icon: <Plus className="w-12 h-12 text-primary" />,
  },
  {
    title: "Find Kava Bars",
    description: "Search for kava bars near you or explore our curated list of locations.",
    icon: <Search className="w-12 h-12 text-primary" />,
  },
  {
    title: "Interactive Map",
    description: "View all kava bars on our interactive map and find the closest ones to you.",
    icon: <MapPin className="w-12 h-12 text-primary" />,
  },
  {
    title: "Share with Friends",
    description: "Found a great kava bar? Share it with your friends directly from the app!",
    icon: <Share2 className="w-12 h-12 text-primary" />,
  },
];

export default function OnboardingTutorial() {
  const { 
    isOnboardingOpen, 
    currentStep, 
    setCurrentStep, 
    closeOnboarding,
  } = useOnboarding();

  console.log('OnboardingTutorial render:', { isOnboardingOpen, currentStep });

  if (!isOnboardingOpen) {
    console.log('Onboarding is not open, returning null');
    return null;
  }

  const handleNext = () => {
    console.log('Handling next step:', currentStep);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      closeOnboarding();
    }
  };

  const handleSkip = () => {
    console.log('Skipping onboarding');
    closeOnboarding();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <Card className="w-[90vw] max-w-md mx-auto">
          <CardHeader>
            <div className="flex justify-center mb-4">
              {steps[currentStep].icon}
            </div>
            <CardTitle className="text-center">{steps[currentStep].title}</CardTitle>
            <CardDescription className="text-center whitespace-pre-line">
              {steps[currentStep].description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center space-x-1">
              {steps.map((_, index) => (
                <motion.div
                  key={index}
                  className={`h-1 rounded-full ${
                    index === currentStep ? "w-8 bg-primary" : "w-2 bg-muted"
                  }`}
                  animate={{
                    width: index === currentStep ? 32 : 8,
                    backgroundColor: index === currentStep ? "hsl(var(--primary))" : "hsl(var(--muted))",
                  }}
                />
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" onClick={handleSkip}>
              Skip
            </Button>
            <Button onClick={handleNext}>
              {currentStep === steps.length - 1 ? "Get Started" : "Next"}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}