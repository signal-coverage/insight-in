import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireUserId: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/requireUserId", () => ({
  requireUserId: mocks.requireUserId,
}));

import Dashboard from "./page";

beforeEach(() => {
  mocks.redirect.mockClear();
  mocks.requireUserId.mockReset();
  mocks.requireUserId.mockResolvedValue("user_1");
});

describe("/dashboard", () => {
  it("sends the person to the summary, the General page under Resumen", async () => {
    await Dashboard();

    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/overview");
  });

  it("checks the session first, so a signed-out visitor is sent to sign in and not to the summary", async () => {
    mocks.requireUserId.mockRejectedValue(new Error("not signed in"));

    await expect(Dashboard()).rejects.toThrow("not signed in");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
