import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUserId: vi.fn() }));

vi.mock("@/lib/auth/requireUserId", () => ({
  requireUserId: mocks.requireUserId,
}));
vi.mock("@/components/Account", () => ({ Account: () => null }));

import AccountPage from "./page";

beforeEach(() => {
  mocks.requireUserId.mockReset();
  mocks.requireUserId.mockResolvedValue("user_1");
});

describe("/dashboard/account", () => {
  it("checks the session before showing the account", async () => {
    await AccountPage();

    expect(mocks.requireUserId).toHaveBeenCalledTimes(1);
  });

  it("shows nothing to a signed-out visitor", async () => {
    mocks.requireUserId.mockRejectedValue(new Error("not signed in"));

    await expect(AccountPage()).rejects.toThrow("not signed in");
  });
});
