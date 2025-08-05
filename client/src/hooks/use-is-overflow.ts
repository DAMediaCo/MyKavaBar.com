import { useEffect, useState } from "react";

export function useIsOverflow(ref: React.RefObject<HTMLElement>) {
  const [isOverflow, setIsOverflow] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const el = ref.current;
    // Check if scrollHeight is greater than clientHeight (means overflow)
    setIsOverflow(el.scrollHeight > el.clientHeight);
  }, [ref.current, ref.current?.innerText]); // re-check if ref or text changes

  return isOverflow;
}
