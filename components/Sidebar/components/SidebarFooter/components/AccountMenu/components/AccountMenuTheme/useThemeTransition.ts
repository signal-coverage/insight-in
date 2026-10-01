import { useCallback, useRef, useState } from "react";

import { runThemeTransition } from "./utils";

// Applies a theme with its animation and reports whether that animation is still running.
// A second change started meanwhile is ignored: the browser would skip the running transition
// (no animation, an AbortError) or the new theme could be lost.
export const useThemeTransition = (setTheme: (theme: string) => void) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  // The state alone is stale for a second choice made before the next render.
  const running = useRef(false);

  const changeTheme = useCallback(
    (id: string) => {
      if (running.current) return;

      running.current = true;
      setIsTransitioning(true);

      void runThemeTransition(() => setTheme(id)).finally(() => {
        running.current = false;
        setIsTransitioning(false);
      });
    },
    [setTheme],
  );

  return { isTransitioning, changeTheme };
};
