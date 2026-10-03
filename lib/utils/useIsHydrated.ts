import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False on the server and during the hydration render, true on every client render after. Anything
// that only the browser knows (a stored preference, the window size) can wait for it, so the first
// client render matches the server's HTML.
export const useIsHydrated = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
