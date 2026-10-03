// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runThemeTransition, selectedThemeId } from "./utils";

describe("selectedThemeId", () => {
  it("is the one key of a single selection", () => {
    expect(selectedThemeId(new Set(["ocean"]))).toBe("ocean");
  });

  it("is nothing for an empty selection", () => {
    expect(selectedThemeId(new Set())).toBeNull();
  });

  it("is nothing for a select-all, which a single-choice list never produces", () => {
    expect(selectedThemeId("all")).toBeNull();
  });
});

const setViewTransitions = (value: unknown) =>
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value,
  });

describe("runThemeTransition", () => {
  const apply = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });

  afterEach(() => {
    apply.mockClear();
    Reflect.deleteProperty(document, "startViewTransition");
    vi.unstubAllGlobals();
  });

  it("applies the theme at once when the browser has no view transitions", () => {
    runThemeTransition(apply);

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("applies the theme at once for people who ask for reduced motion", () => {
    const startViewTransition = vi.fn();

    setViewTransitions(startViewTransition);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));

    runThemeTransition(apply);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("is already over when there is no transition to wait for", async () => {
    await expect(runThemeTransition(apply)).resolves.toBeUndefined();
  });

  describe("with view transitions", () => {
    const abort = () => new DOMException("Skipped", "AbortError");

    // A transition whose `ready` and `finished` the test settles by hand.
    const stubTransition = () => {
      let finish!: () => void;
      let skip!: () => void;
      const finished = new Promise<void>((resolve, reject) => {
        finish = resolve;
        skip = () => reject(abort());
      });
      const ready = new Promise<void>((resolve, reject) => {
        finished.then(resolve, reject);
      });
      const startViewTransition = vi.fn((update: () => void) => {
        update();

        return { ready, finished };
      });

      setViewTransitions(startViewTransition);

      return { startViewTransition, finish, skip };
    };

    it("applies the theme inside the transition, so the new look is what gets revealed", () => {
      const { startViewTransition } = stubTransition();

      void runThemeTransition(apply);

      expect(startViewTransition).toHaveBeenCalledTimes(1);
      expect(apply).toHaveBeenCalledTimes(1);
    });

    it("stays pending until the animation has finished", async () => {
      const { finish } = stubTransition();
      const over = vi.fn();

      void runThemeTransition(apply).then(over);
      await Promise.resolve();

      expect(over).not.toHaveBeenCalled();

      finish();
      await vi.waitFor(() => expect(over).toHaveBeenCalledTimes(1));
    });

    it("is over, without an error, when the browser skips the transition", async () => {
      const { skip } = stubTransition();
      const result = runThemeTransition(apply);

      skip();

      await expect(result).resolves.toBeUndefined();
    });
  });
});
