import { use } from "react";

import type { ResolvedProps } from "./types";

// Reads the promise with `use`, which suspends the nearest Suspense boundary until it settles.
export function Resolved<T>({ source, children }: ResolvedProps<T>) {
  return <>{children(use(source))}</>;
}
