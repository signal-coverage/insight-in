import type { ReactNode } from "react";

// Either the value itself or a promise of it. Components take this so they can be rendered (and
// tested) with plain data, while the server can hand them a promise that is still loading.
export type Source<T> = T | Promise<T>;

export interface AwaitProps<T> {
  source: Source<T>;
  // What stands in for the section while the promise is pending.
  fallback: ReactNode;
  children: (value: T) => ReactNode;
}
