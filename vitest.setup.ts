import { afterEach } from "vitest";

// Everything below only matters for component tests, which opt into jsdom with a
// `// @vitest-environment jsdom` docblock. Node-environment tests skip it entirely so
// they do not pay for loading React and Testing Library.
if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");

  // With Vitest globals off, Testing Library cannot switch React into its test ("act")
  // environment by itself (it does that in a global beforeAll). Without it React never retries
  // a Suspense boundary after a promise resolves, so anything using `use()` would stay on its
  // fallback forever in a test.
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  // Vitest globals are off, so Testing Library cannot register its own auto-cleanup.
  afterEach(() => {
    cleanup();
  });

  // jsdom has no ResizeObserver; components that observe their size only need it to exist.
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    globalThis.ResizeObserver = ResizeObserverStub;
  }
}
