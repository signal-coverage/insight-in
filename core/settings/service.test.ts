import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  userSettings: { findUnique: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import {
  getUserSettings,
  saveHiddenSummaryCurrencies,
  saveIncludeExpectedIncomes,
} from "./service";

const { userSettings } = db;

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  userSettings.findUnique.mockResolvedValue(null);
  userSettings.upsert.mockResolvedValue({});
});

describe("getUserSettings", () => {
  it("reads only the user's own row", async () => {
    await getUserSettings(USER_ID);

    expect(userSettings.findUnique).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
  });

  it("gives the defaults when the user never saved a setting", async () => {
    await expect(getUserSettings(USER_ID)).resolves.toEqual({
      includeExpectedIncomes: true,
      hiddenSummaryCurrencies: [],
    });
  });

  it("gives what the user saved", async () => {
    userSettings.findUnique.mockResolvedValue({
      userId: USER_ID,
      includeExpectedIncomes: false,
      hiddenSummaryCurrencies: ["USD", "EUR"],
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    });

    await expect(getUserSettings(USER_ID)).resolves.toEqual({
      includeExpectedIncomes: false,
      hiddenSummaryCurrencies: ["USD", "EUR"],
    });
  });

  it.each([null, undefined])(
    "reads a row whose hidden currencies are %s as none hidden",
    async (column) => {
      userSettings.findUnique.mockResolvedValue({
        userId: USER_ID,
        includeExpectedIncomes: false,
        hiddenSummaryCurrencies: column,
      });

      await expect(getUserSettings(USER_ID)).resolves.toEqual({
        includeExpectedIncomes: false,
        hiddenSummaryCurrencies: [],
      });
    },
  );
});

describe("saveIncludeExpectedIncomes", () => {
  it("creates the row the first time and updates it afterwards", async () => {
    await saveIncludeExpectedIncomes(USER_ID, false);

    expect(userSettings.upsert).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      create: { userId: USER_ID, includeExpectedIncomes: false },
      update: { includeExpectedIncomes: false },
    });
  });

  it("can turn it back on", async () => {
    await saveIncludeExpectedIncomes(USER_ID, true);

    expect(userSettings.upsert.mock.calls[0][0].update).toEqual({
      includeExpectedIncomes: true,
    });
  });
});

describe("saveHiddenSummaryCurrencies", () => {
  it("creates the row the first time and updates it afterwards, scoped to the user", async () => {
    await saveHiddenSummaryCurrencies(USER_ID, ["USD", "EUR"]);

    expect(userSettings.upsert).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      create: { userId: USER_ID, hiddenSummaryCurrencies: ["USD", "EUR"] },
      update: { hiddenSummaryCurrencies: ["USD", "EUR"] },
    });
  });

  it("can save an empty list: every currency shown again", async () => {
    await saveHiddenSummaryCurrencies(USER_ID, []);

    expect(userSettings.upsert.mock.calls[0][0].update).toEqual({
      hiddenSummaryCurrencies: [],
    });
  });
});
