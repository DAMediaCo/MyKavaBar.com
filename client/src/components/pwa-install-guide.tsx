import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Apple, Chrome, Smartphone } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Platform = "ios" | "android" | "chrome" | "other";

export default function PWAInstallGuide({ isOpen, onClose }: Props) {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    // Detect user's platform
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform("ios");
    } else if (/android/.test(ua)) {
      setPlatform("android");
    } else if (/chrome/.test(ua)) {
      setPlatform("chrome");
    }
  }, []);

  const platformInstructions = {
    ios: {
      title: "Install on iOS",
      steps: [
        "Tap the Share button in Safari",
        "Scroll down and tap 'Add to Home Screen'",
        "Tap 'Add' in the top-right corner"
      ]
    },
    android: {
      title: "Install on Android",
      steps: [
        "Tap the menu button (⋮) in Chrome",
        "Tap 'Install app' or 'Add to Home screen'",
        "Tap 'Install' to confirm"
      ]
    },
    chrome: {
      title: "Install on Desktop Chrome",
      steps: [
        "Click the install icon in the address bar",
        "Click 'Install' in the prompt"
      ]
    },
    other: {
      title: "Install MyKavaBar",
      steps: [
        "Open this website in Chrome or Safari"
      ]
    }
  };

  const instructions = platformInstructions[platform];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {platform === "ios" && <Apple className="h-5 w-5" />}
            {platform === "android" && <Smartphone className="h-5 w-5" />}
            {platform === "chrome" && <Chrome className="h-5 w-5" />}
            {instructions.title}
          </DialogTitle>
          <DialogDescription>
            Follow these steps to install MyKavaBar on your device
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-6">
          {instructions.steps.map((step, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {index + 1}
              </div>
              <p className="text-lg">{step}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}