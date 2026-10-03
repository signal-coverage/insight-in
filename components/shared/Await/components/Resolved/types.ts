import type { ReactNode } from "react";

export interface ResolvedProps<T> {
  source: Promise<T>;
  children: (value: T) => ReactNode;
}
