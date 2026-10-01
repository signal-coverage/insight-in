import { useCallback, useEffect, useRef, useState } from "react";

// Tracks whether the scroll area has more content to the left or to the right, and how much room
// its own scrollbars take, so the edge fades can sit exactly over the content. It measures again
// whenever the area is resized or the columns or rows change.
export function useScrollFades(...dependencies: unknown[]) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [scrollbarGutter, setScrollbarGutter] = useState({
    right: 0,
    bottom: 0,
  });

  const updateFades = useCallback(() => {
    const el = scrollRef.current;

    if (!el) return;

    setShowLeftFade(el.scrollLeft > 0);
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    setScrollbarGutter({
      right: el.offsetWidth - el.clientWidth,
      bottom: el.offsetHeight - el.clientHeight,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;

    if (!el) return;

    updateFades();

    const observer = new ResizeObserver(updateFades);

    observer.observe(el);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller names what should trigger a new measurement
  }, [updateFades, ...dependencies]);

  return {
    scrollRef,
    showLeftFade,
    showRightFade,
    scrollbarGutter,
    updateFades,
  };
}
