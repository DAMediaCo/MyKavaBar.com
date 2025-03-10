import { useRef, useEffect } from "react";

export const ImageWithFallBack = ({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) => {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img) {
      // Check if src was moved to data-src
      const dataSrc = img.getAttribute("data-src");
      if (dataSrc && !img.src) {
        img.src = dataSrc;
      }

      // Create observer to watch for attribute changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "data-src") {
            const newDataSrc = img.getAttribute("data-src");
            if (newDataSrc) {
              img.src = newDataSrc;
            }
          }
        });
      });

      // Start observing
      observer.observe(img, { attributes: true });

      // Cleanup
      return () => observer.disconnect();
    }
  }, []);

  return <img ref={imgRef} src={src} alt={alt} className={className} />;
};
