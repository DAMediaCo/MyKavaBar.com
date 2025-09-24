import { useState } from "react";
import { format } from "date-fns";

export function ComingSoonBanner({
  grandOpeningDate,
}: {
  grandOpeningDate?: Date | undefined;
}) {
  const [visible, setVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);

  // Called on container click to start fade out
  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      setShouldRender(false);
    }, 300); // Transition duration 300ms (match CSS below)
  };

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      } shadow-black/50 dark:shadow-white/40`}
      onClick={handleClose}
      style={{
        transition: "opacity 300ms ease",
        zIndex: 9999,
      }}
    >
      {/* Background blur overlay */}
      <div
        className={`absolute inset-0 bg-black bg-opacity-30 backdrop-blur-md ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        style={{
          transition: "opacity 300ms ease",
        }}
      ></div>

      {/* Banner with scale and opacity transition */}
      <div
        className={`relative px-6 py-3 bg-[#222] bg-opacity-85 rounded-xl shadow-md border border-yellow-400 flex items-center gap-3 ${
          visible ? "opacity-100 scale-100" : "opacity-0 scale-90"
        }`}
        style={{
          overflow: "hidden",
          transition: "opacity 300ms ease, transform 300ms ease",
          zIndex: 10,
        }}
      >
        <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block mr-2"></span>

        <span className="text-lg font-semibold text-yellow-100 relative z-10">
          Coming Soon
          {grandOpeningDate ? (
            <> &bull; Grand Opening {format(grandOpeningDate, "MMM d")}</>
          ) : (
            <> &bull; TBD</>
          )}
        </span>
      </div>

      {/* Animated instruction text */}
      <span
        className="mt-4 text-white text-shadow-sm text-shadow-intensity-25 dark:text-yellow-200 text-sm"
        style={{
          zIndex: 10,
          animation: visible ? "fadeInOut 1s ease-in-out infinite" : "none",
        }}
      >
        Click anywhere to close the banner
      </span>

      <style>{`
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
