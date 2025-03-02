import { useEffect, useState, useId } from 'react';
import { GoogleAd } from './google-ad';

interface DynamicAdProps {
  contentSelector: string;
  minContentHeight?: number;
  minScrollPercentage?: number;
  minTimeOnPage?: number;
  slot: string;
}

export function DynamicAd({
  contentSelector,
  minContentHeight = 100,
  minScrollPercentage = 5,
  minTimeOnPage = 1000,
  slot
}: DynamicAdProps) {
  const [showAd, setShowAd] = useState(false);
  const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID || 'ca-pub-4689433820915825';
  const adId = useId();

  useEffect(() => {
    console.log(`DynamicAd[${adId}]: Initializing...`, {
      slot,
      minContentHeight,
      minScrollPercentage,
      minTimeOnPage
    });

    // Check if we should show the ad immediately
    const checkConditions = () => {
      const contentElement = document.querySelector(contentSelector);
      if (!contentElement) {
        console.log(`DynamicAd[${adId}]: Content element not found`);
        return false;
      }

      const scrollPercentage = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;

      console.log(`DynamicAd[${adId}]: Checking conditions:`, {
        contentHeight: contentElement.scrollHeight,
        requiredHeight: minContentHeight,
        scrollPercentage,
        requiredScroll: minScrollPercentage
      });

      return contentElement.scrollHeight >= minContentHeight && 
             scrollPercentage >= minScrollPercentage;
    };

    // Initial delay to ensure content is loaded
    const initialTimer = setTimeout(() => {
      if (checkConditions()) {
        console.log(`DynamicAd[${adId}]: Initial conditions met, showing ad`);
        setShowAd(true);
      } else {
        // If initial check fails, set up scroll listener
        const scrollHandler = () => {
          if (checkConditions()) {
            console.log(`DynamicAd[${adId}]: Conditions met after scroll, showing ad`);
            setShowAd(true);
            window.removeEventListener('scroll', scrollHandler);
          }
        };

        window.addEventListener('scroll', scrollHandler);
        return () => window.removeEventListener('scroll', scrollHandler);
      }
    }, minTimeOnPage);

    return () => clearTimeout(initialTimer);
  }, [contentSelector, minContentHeight, minScrollPercentage, minTimeOnPage, slot, adId]);

  if (!showAd) {
    return null;
  }

  return (
    <div className="w-full">
      <GoogleAd
        client={publisherId}
        slot={slot}
        format="auto"
        responsive={true}
        className="bg-card border border-border rounded-lg"
      />
    </div>
  );
}