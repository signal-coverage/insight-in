import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserSettings: vi.fn(),
  requireUserId: vi.fn(),
}));

vi.mock("@/lib/auth/requireUserId", () => ({
  requireUserId: mocks.requireUserId,
}));
vi.mock("@/core/settings/service", () => ({
  getUserSettings: mocks.getUserSettings,
}));
vi.mock("@/components/Settings", () => ({ Settings: () => null }));

import SettingsPage from "./page";

beforeEach(() => {
  mocks.requireUserId.mockReset();
  mocks.requireUserId.mockResolvedValue("user_1");
  mocks.getUserSettings.mockReset();
  mocks.getUserSettings.mockResolvedValue({ includeExpectedIncomes: false });
});

describe("/dashboard/settings", () => {
  it("checks the session first and reads the settings of that user only", async () => {
    await SettingsPage();

    expect(mocks.requireUserId).toHaveBeenCalledTimes(1);
    expect(mocks.getUserSettings).toHaveBeenCalledWith("user_1");
  });

  it("hands the page the saved switch value as a promise, so the header does not wait for it", async () => {
    const page = await SettingsPage();

    await expect(page.props.includeExpectedIncomes).resolves.toBe(false);
  });

  it("reads nothing for a signed-out visitor", async () => {
    mocks.requireUserId.mockRejectedValue(new Error("not signed in"));

    await expect(SettingsPage()).rejects.toThrow("not signed in");
    expect(mocks.getUserSettings).not.toHaveBeenCalled();
  });
});
