import { useEffect, useRef } from 'react';

interface GoogleAdProps {
  client: string;
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal';
  responsive?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export function GoogleAd({ 
  client, 
  slot, 
  format = 'auto', 
  responsive = true, 
  style,
  className 
}: GoogleAdProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    console.log(`GoogleAd[${slot}]: Starting initialization...`);

    if (!client || !slot) {
      console.error('GoogleAd: Missing required props', { client, slot });
      return;
    }

    const initializeAd = () => {
      if (!window.adsbygoogle) {
        console.log(`GoogleAd[${slot}]: AdSense script not loaded yet`);
        return false;
      }

      if (!adRef.current) {
        console.log(`GoogleAd[${slot}]: Ad container not ready`);
        return false;
      }

      if (isInitialized.current) {
        console.log(`GoogleAd[${slot}]: Already initialized`);
        return true;
      }

      try {
        console.log(`GoogleAd[${slot}]: Pushing ad configuration`);
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        isInitialized.current = true;
        console.log(`GoogleAd[${slot}]: Successfully initialized`);
        return true;
      } catch (error) {
        console.error(`GoogleAd[${slot}]: Error during initialization:`, error);
        return false;
      }
    };

    // Try to initialize immediately
    const initialized = initializeAd();

    // If not initialized, retry after a short delay
    if (!initialized) {
      const retryTimeout = setTimeout(() => {
        console.log(`GoogleAd[${slot}]: Retrying initialization...`);
        initializeAd();
      }, 2000);

      return () => clearTimeout(retryTimeout);
    }

    return () => {
      console.log(`GoogleAd[${slot}]: Cleaning up`);
      isInitialized.current = false;
    };
  }, [client, slot]);

  return (
    <div 
      ref={adRef}
      className={`google-ad ${className || ''}`}
      aria-label="Advertisement"
      style={{
        minHeight: '280px',
        margin: '2rem 0', 
        display: 'block',
        background: 'transparent',
        position: 'relative',
        ...style
      }}
    >
      <div className="text-xs text-muted-foreground mb-2">Advertisement</div>
      <ins
        className="adsbygoogle"
        style={{
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
}