import { describe, expect, it } from "vitest";

import { CLERK_APPEARANCE, USER_PROFILE_APPEARANCE } from "./clerk-appearance";

describe("CLERK_APPEARANCE", () => {
  it("takes every colour from the app's theme tokens, so Clerk follows the chosen theme", () => {
    for (const value of Object.values(CLERK_APPEARANCE.variables)) {
      expect(value === "transparent" || value.startsWith("var(--")).toBe(true);
    }
  });
});

describe("USER_PROFILE_APPEARANCE", () => {
  it("only reshapes the profile's boxes: the colours stay the app's", () => {
    expect(Object.keys(USER_PROFILE_APPEARANCE)).toEqual(["elements"]);
  });

  it("borders the profile with the theme's border colour, not a hard-coded one", () => {
    expect(USER_PROFILE_APPEARANCE.elements.cardBox.border).toBe(
      "1px solid var(--border)",
    );
  });
});
