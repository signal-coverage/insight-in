import { flushSync } from "react-dom";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// The View Transitions API snapshots the DOM, runs the callback, and snapshots again, so
// the theme class must be on <html> by the time the callback returns — hence `flushSync`,
// which forces next-themes' state update (and its effect) to land synchronously.
export const runThemeTransition = (applyTheme: () => void): void => {
  const update = () => flushSync(applyTheme);

  if (
    !document.startViewTransition ||
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  ) {
    update();
    return;
  }

  document.startViewTransition(update);
};
