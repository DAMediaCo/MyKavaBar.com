/**
 * PhotoLightbox — iPhone Photos-style full-screen viewer
 * - Photos drag with your finger in real time (translateX follows touch)
 * - Swipe up or down 80px to dismiss
 * - Quick flick to advance even if short drag
 * - Tap to toggle chrome (header, thumbnails)
 * - Smooth spring transition on release
 * - Pinch-to-zoom
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Photo {
  url: string;
  caption?: string;
  uploadedBy?: string;
  createdAt?: string;
}

interface Props {
  photos: Photo[];
  initialIndex?: number;
  onClose: () => void;
  footer?: React.ReactNode; // e.g. upload form
}

export function PhotoLightbox({ photos, initialIndex = 0, onClose, footer }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [showChrome, setShowChrome] = useState(true);
  const [dragX, setDragX] = useState(0);       // horizontal drag offset (px)
  const [dragY, setDragY] = useState(0);        // vertical drag offset (px)
  const [dragging, setDragging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [scale, setScale] = useState(1);
  const [entering, setEntering] = useState(true);

  const touchRef = useRef<{ x: number; y: number; t: number; lastX: number }>({ x: 0, y: 0, t: 0, lastX: 0 });
  const pinchRef = useRef<{ dist: number }>({ dist: 0 });
  const mouseRef = useRef<{ down: boolean; startX: number; startY: number; t: number }>({ down: false, startX: 0, startY: 0, t: 0 });

  // Mount animation
  useEffect(() => {
    requestAnimationFrame(() => setEntering(false));
  }, []);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") advance(1);
      if (e.key === "ArrowLeft") advance(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index]);

  const close = useCallback(() => {
    setDismissing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  const advance = useCallback((dir: 1 | -1) => {
    setDragX(0);
    setIndex(i => {
      const next = i + dir;
      if (next < 0 || next >= photos.length) return i;
      return next;
    });
  }, [photos.length]);

  // ── Touch handlers ────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current.dist = Math.sqrt(dx * dx + dy * dy);
      return;
    }
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), lastX: t.clientX };
    setDragging(true);
    setDragX(0);
    setDragY(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / (pinchRef.current.dist || dist);
      setScale(s => Math.min(4, Math.max(1, s * ratio)));
      pinchRef.current.dist = dist;
      return;
    }
    if (!dragging) return;
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    touchRef.current.lastX = t.clientX;

    // If zoomed in, allow panning but not page-swiping
    if (scale > 1.1) return;

    // Prefer horizontal vs vertical drag
    if (Math.abs(dx) > Math.abs(dy)) {
      setDragX(dx);
    } else {
      setDragY(dy);
    }
  };

  // ── Mouse drag handlers (desktop) ────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    mouseRef.current = { down: true, startX: e.clientX, startY: e.clientY, t: Date.now() };
    setDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!mouseRef.current.down) return;
    const dx = e.clientX - mouseRef.current.startX;
    const dy = e.clientY - mouseRef.current.startY;
    if (Math.abs(dx) > Math.abs(dy)) setDragX(dx);
    else setDragY(dy);
  };
  const onMouseUp = (e: React.MouseEvent) => {
    if (!mouseRef.current.down) return;
    mouseRef.current.down = false;
    setDragging(false);
    const elapsed = Date.now() - mouseRef.current.t;
    const velocity = dragX / elapsed;
    if (dragY > 80) { close(); return; }
    const threshold = window.innerWidth * 0.15;
    if (dragX < -threshold || velocity < -0.3) advance(1);
    else if (dragX > threshold || velocity > 0.3) advance(-1);
    else { setDragX(0); setDragY(0); }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!dragging) return;
    setDragging(false);
    const elapsed = Date.now() - touchRef.current.t;
    const velocity = dragX / elapsed; // px/ms

    // Dismiss on swipe down 80px OR fast downward flick
    if (dragY > 80 || (dragY > 30 && dragY / elapsed > 0.3)) {
      close();
      return;
    }

    // Advance on swipe >25% screen width OR fast flick
    const threshold = window.innerWidth * 0.25;
    if (dragX < -threshold || velocity < -0.3) { advance(1); }
    else if (dragX > threshold || velocity > 0.3) { advance(-1); }
    else { setDragX(0); setDragY(0); }
  };

  const onTap = () => {
    if (Math.abs(dragX) < 5 && Math.abs(dragY) < 5) {
      setShowChrome(c => !c);
    }
  };

  // ── Computed styles ───────────────────────────────────────────────────────
  // Use vw units so % is relative to viewport, not the strip's own (inflated) width
  const photoTransform = `translateX(calc(-${index * 100}vw + ${dragX}px)) translateY(${dragY}px)`;
  const bgOpacity = dismissing ? 0 : entering ? 0 : Math.max(0, 1 - Math.abs(dragY) / 300);
  const containerStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: `rgba(0,0,0,${bgOpacity})`,
    transition: dismissing ? "background 0.22s ease" : "background 0.08s",
    display: "flex", flexDirection: "column",
    transform: entering ? "scale(0.97)" : "scale(1)",
    opacity: entering ? 0 : 1,
    transition2: "opacity 0.18s ease, transform 0.18s ease",
  } as any;

  const stripStyle: React.CSSProperties = {
    display: "flex",
    // Each panel is 100vw wide, strip is photos.length × 100vw
    width: `${photos.length * 100}vw`,
    height: "100%",
    transform: photoTransform,
    transition: dragging ? "none" : "transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    willChange: "transform",
  };

  const chromeTransition = "opacity 0.18s ease";

  return createPortal(
    <div
      style={{ ...containerStyle, cursor: dragging ? "grabbing" : "grab" }}
      onClick={onTap}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
    >
      {/* Header chrome */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          padding: "env(safe-area-inset-top, 12px) 16px 12px",
          background: "linear-gradient(rgba(0,0,0,0.6), transparent)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: showChrome ? 1 : 0, transition: chromeTransition, pointerEvents: showChrome ? "auto" : "none",
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={close}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <X className="h-5 w-5 text-white" />
        </button>
        <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 500 }}>
          {index + 1} of {photos.length}
        </span>
        <div style={{ width: 36 }} />
      </div>

      {/* Photo strip */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={stripStyle}>
          {photos.map((photo, i) => (
            <div key={i} style={{ width: "100vw", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px" }}>
              <img
                src={photo.url}
                alt={`Photo ${i + 1}`}
                loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
                onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%231A1A1C' width='200' height='200'/%3E%3Cpath d='M80 100 L100 80 L140 120 M60 130 L80 110' stroke='%23444' stroke-width='2' fill='none'/%3E%3Ccircle cx='75' cy='85' r='6' fill='%23444'/%3E%3C/svg%3E"; }}
                style={{
                  maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                  transform: i === index ? `scale(${scale})` : "scale(1)",
                  transition: "transform 0.1s",
                  userSelect: "none", pointerEvents: "none",
                  WebkitUserDrag: "none",
                } as any}
              />
            </div>
          ))}
        </div>

        {/* Desktop prev/next arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); advance(-1); }}
              style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: showChrome && index > 0 ? 1 : 0, transition: chromeTransition, pointerEvents: showChrome && index > 0 ? "auto" : "none",
              }}
            ><ChevronLeft className="h-5 w-5 text-white" /></button>
            <button
              onClick={e => { e.stopPropagation(); advance(1); }}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: showChrome && index < photos.length - 1 ? 1 : 0, transition: chromeTransition, pointerEvents: showChrome && index < photos.length - 1 ? "auto" : "none",
              }}
            ><ChevronRight className="h-5 w-5 text-white" /></button>
          </>
        )}


      </div>

      {/* Thumbnail filmstrip */}
      {photos.length > 1 && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            opacity: showChrome ? 1 : 0, transition: chromeTransition, pointerEvents: showChrome ? "auto" : "none",
            padding: "8px 12px calc(env(safe-area-inset-bottom, 8px) + 8px)",
            background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
            display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none",
          }}
        >
          {photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              style={{
                flexShrink: 0, width: 48, height: 48, borderRadius: 8, overflow: "hidden",
                border: `2px solid ${i === index ? "#D35400" : "transparent"}`,
                opacity: i === index ? 1 : 0.5,
                transition: "border-color 0.15s, opacity 0.15s",
              }}
            >
              <img src={photo.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
            </button>
          ))}
        </div>
      )}

      {/* Footer (upload form etc) */}
      {footer && showChrome && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: "#111111", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px" }}
        >
          {footer}
        </div>
      )}
    </div>,
    document.body
  );
}
