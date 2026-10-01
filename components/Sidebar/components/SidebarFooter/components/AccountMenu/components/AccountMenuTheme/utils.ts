import type { Selection } from "@heroui/react";
import { flushSync } from "react-dom";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// The theme a single-choice list reports, or null when it reports none.
export const selectedThemeId = (selection: Selection): string | null => {
  if (selection === "all") return null;

  const [first] = selection;

  return first === undefined ? null : String(first);
};

// The View Transitions API snapshots the DOM, runs the callback, and snapshots again, so
// the theme class must be on <html> by the time the callback returns — hence `flushSync`,
// which forces next-themes' state update (and its effect) to land synchronously.
//
// Resolves when the animation is over (at once when there is none), so the caller can keep
// the theme list locked meanwhile: the browser skips a running transition when another starts,
// and a skipped one has no animation and rejects `ready` and `finished` with an AbortError.
export const runThemeTransition = (applyTheme: () => void): Promise<void> => {
  const update = () => flushSync(applyTheme);

  if (
    !document.startViewTransition ||
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  ) {
    update();
    return Promise.resolve();
  }

  const transition = document.startViewTransition(update);

  // `ready` rejects together with `finished`, which is the one that is reported below; left
  // alone it would surface as an unhandled rejection.
  transition.ready.catch(() => undefined);

  return transition.finished.catch((error: unknown) => {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }
  });
};
