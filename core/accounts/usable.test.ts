import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ account: { findFirst: vi.fn() } }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import {
  AccountArchivedError,
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "./errors";
import { assertUsableAccount } from "./usable";

const USER_ID = "user_123";
const AT = new Date("2026-10-04T12:00:00.000Z");

const accountRow = (patch: Record<string, unknown> = {}) => ({
  id: "acc_1",
  currency: "ARS",
  archivedAt: null,
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("assertUsableAccount", () => {
  it("reads the account only among the user's own", async () => {
    db.account.findFirst.mockResolvedValue(accountRow());

    await assertUsableAccount(USER_ID, { accountId: "acc_1", currency: "ARS" });

    expect(db.account.findFirst).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      select: { id: true, currency: true, archivedAt: true },
    });
  });

  it("accepts an active account in the currency of the movement", async () => {
    db.account.findFirst.mockResolvedValue(accountRow());

    await expect(
      assertUsableAccount(USER_ID, { accountId: "acc_1", currency: "ARS" }),
    ).resolves.toBeUndefined();
  });

  it("treats another user's account (or an unknown id) as not found", async () => {
    db.account.findFirst.mockResolvedValue(null);

    await expect(
      assertUsableAccount(USER_ID, {
        accountId: "acc_of_someone_else",
        currency: "ARS",
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it("refuses an account in another currency than the movement", async () => {
    db.account.findFirst.mockResolvedValue(accountRow({ currency: "USD" }));

    await expect(
      assertUsableAccount(USER_ID, { accountId: "acc_1", currency: "ARS" }),
    ).rejects.toBeInstanceOf(AccountCurrencyMismatchError);
  });

  it("refuses an archived account for a new movement", async () => {
    db.account.findFirst.mockResolvedValue(accountRow({ archivedAt: AT }));

    await expect(
      assertUsableAccount(USER_ID, { accountId: "acc_1", currency: "ARS" }),
    ).rejects.toBeInstanceOf(AccountArchivedError);
  });

  it("lets an edit keep the archived account the record already has", async () => {
    db.account.findFirst.mockResolvedValue(accountRow({ archivedAt: AT }));

    await expect(
      assertUsableAccount(USER_ID, {
        accountId: "acc_1",
        currency: "ARS",
        keepAccountId: "acc_1",
      }),
    ).resolves.toBeUndefined();
  });

  it("still refuses an archived account an edit moves the record to", async () => {
    db.account.findFirst.mockResolvedValue(
      accountRow({ id: "acc_2", archivedAt: AT }),
    );

    await expect(
      assertUsableAccount(USER_ID, {
        accountId: "acc_2",
        currency: "ARS",
        keepAccountId: "acc_1",
      }),
    ).rejects.toBeInstanceOf(AccountArchivedError);
  });

  it("checks the currency even when the record keeps its archived account", async () => {
    db.account.findFirst.mockResolvedValue(
      accountRow({ currency: "USD", archivedAt: AT }),
    );

    await expect(
      assertUsableAccount(USER_ID, {
        accountId: "acc_1",
        currency: "ARS",
        keepAccountId: "acc_1",
      }),
    ).rejects.toBeInstanceOf(AccountCurrencyMismatchError);
  });
});
