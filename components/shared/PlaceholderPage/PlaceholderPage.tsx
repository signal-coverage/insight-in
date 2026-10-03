import { PLACEHOLDER_HINT } from "./consts";
import { HINT_CLASS_NAME, ROOT_CLASS_NAME, TITLE_CLASS_NAME } from "./styles";
import type { PlaceholderPageProps } from "./types";

// Minimal stand-in for a real page — exists so nav links resolve to a real route
// instead of Next.js's 404 boundary while the actual screen isn't built yet.
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <main className={ROOT_CLASS_NAME}>
      <h1 className={TITLE_CLASS_NAME}>{title}</h1>
      <p className={HINT_CLASS_NAME}>{PLACEHOLDER_HINT}</p>
    </main>
  );
}
