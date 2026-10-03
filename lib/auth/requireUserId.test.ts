import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));

import { requireUserId } from "./requireUserId";

// The real `redirectToSignIn()` throws Next's redirect error, so it never returns.
const REDIRECT_SENTINEL = new Error("NEXT_REDIRECT");

describe("requireUserId", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
  });

  it("returns the user id of a signed-in session", async () => {
    const redirectToSignIn = vi.fn();

    mocks.auth.mockResolvedValue({ userId: "user_1", redirectToSignIn });

    await expect(requireUserId()).resolves.toBe("user_1");
    expect(redirectToSignIn).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign-in and never returns a user id", async () => {
    const redirectToSignIn = vi.fn(() => {
      throw REDIRECT_SENTINEL;
    });

    mocks.auth.mockResolvedValue({ userId: null, redirectToSignIn });

    await expect(requireUserId()).rejects.toBe(REDIRECT_SENTINEL);
    expect(redirectToSignIn).toHaveBeenCalledTimes(1);
  });

  it("still refuses to continue if the redirect helper ever returns", async () => {
    const redirectToSignIn = vi.fn();

    mocks.auth.mockResolvedValue({ userId: null, redirectToSignIn });

    await expect(requireUserId()).rejects.toThrow();
    expect(redirectToSignIn).toHaveBeenCalledTimes(1);
  });
});
