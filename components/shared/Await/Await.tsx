import { Suspense } from "react";

import { Resolved } from "./components/Resolved";
import type { AwaitProps } from "./types";
import { isPromise } from "./utils";

// Renders `children` with the value, waiting for it if it is still a promise. Only this section
// waits (its `fallback` shows in its place); everything around it renders right away. A plain
// value renders immediately, so callers and tests that already have the data need no Suspense.
//
// On a later navigation React keeps showing the old content until the new promise resolves (the
// navigations here run inside a transition), so the fallback only appears on the first load.
export function Await<T>({ source, fallback, children }: AwaitProps<T>) {
  if (!isPromise(source)) {
    return <>{children(source)}</>;
  }

  return (
    <Suspense fallback={fallback}>
      <Resolved source={source}>{children}</Resolved>
    </Suspense>
  );
}
