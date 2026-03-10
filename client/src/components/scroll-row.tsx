/**
 * ScrollRow — horizontal scroll container
 * Desktop: drag-to-scroll (grab cursor), fade edge hints, pagination dots
 * Mobile:  native touch swipe, no dots
 */
import { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  children: React.ReactNode;
  snapType?: boolean;
  gap?: number;
}

export function ScrollRow({ children, snapType = false, gap = 12 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);
  const dragRef = useRef<{ active: boolean; startX: number; scrollStart: number }>({ active: false, startX: 0, scrollStart: 0 });

  // Update scroll state
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const sl = el.scrollLeft;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setFadeLeft(sl > 8);
    setFadeRight(sl < maxScroll - 8);

    // Page = which card is most visible
    const children = Array.from(el.children) as HTMLElement[];
    if (children.length === 0) return;
    const itemW = children[0].offsetWidth + gap;
    const currentPage = Math.round(sl / itemW);
    setPage(Math.max(0, Math.min(currentPage, children.length - 1)));
    setPageCount(children.length);
  }, [gap]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Small delay to let layout settle
    const t = setTimeout(update, 50);
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { clearTimeout(t); el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [update, children]);

  // Wheel → horizontal scroll
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      ref.current!.scrollLeft += e.deltaY;
    }
  };

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, startX: e.clientX, scrollStart: ref.current!.scrollLeft };
    e.preventDefault();
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    ref.current!.scrollLeft = dragRef.current.scrollStart - dx;
  };
  const onMouseUp = () => { dragRef.current.active = false; };

  // Dot click → scroll to that item
  const goToPage = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const children = Array.from(el.children) as HTMLElement[];
    if (!children[i]) return;
    el.scrollTo({ left: children[i].offsetLeft - 4, behavior: "smooth" });
  };

  const showDots = pageCount > 1;

  return (
    <div style={{ position: "relative" }}>
      {/* Fade edge masks — desktop only via CSS */}
      <style>{`
        @media (pointer: fine) {
          .scroll-fade-left  { opacity: 1 !important; }
          .scroll-fade-right { opacity: 1 !important; }
          .scroll-row-dots   { display: flex !important; }
          .scroll-row-inner  { cursor: grab; }
          .scroll-row-inner:active { cursor: grabbing; }
        }
      `}</style>

      {/* Left fade */}
      <div
        className="scroll-fade-left"
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 32, zIndex: 2,
          background: "linear-gradient(to right, #111111, transparent)",
          pointerEvents: "none", opacity: 0,
          transition: "opacity 0.2s",
          ...(fadeLeft ? {} : { opacity: 0 }),
        }}
      />
      {/* Right fade */}
      <div
        className="scroll-fade-right"
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 32, zIndex: 2,
          background: "linear-gradient(to left, #111111, transparent)",
          pointerEvents: "none", opacity: 0,
          transition: "opacity 0.2s",
          ...(fadeRight ? {} : { opacity: 0 }),
        }}
      />

      {/* Scroll strip */}
      <div
        ref={ref}
        className="scroll-row-inner"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          display: "flex",
          gap,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          scrollSnapType: snapType ? "x mandatory" : undefined,
          paddingBottom: 2,
          userSelect: "none",
          WebkitUserSelect: "none",
        } as React.CSSProperties}
      >
        {children}
      </div>

      {/* Pagination dots — desktop only */}
      {showDots && (
        <div
          className="scroll-row-dots"
          style={{ display: "none", justifyContent: "center", gap: 6, marginTop: 10 }}
        >
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToPage(i)}
              aria-label={`Go to item ${i + 1}`}
              style={{
                width: i === page ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === page ? "#D35400" : "rgba(255,255,255,0.2)",
                border: "none",
                padding: 0,
                cursor: "pointer",
                transition: "width 0.25s ease, background 0.2s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
