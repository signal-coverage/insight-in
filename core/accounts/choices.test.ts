import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ account: { findMany: vi.fn() } }));
const defaultCash = vi.hoisted(() => ({ ensureDefaultCash: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("./defaultCash", () => defaultCash);

import { listAccountChoices } from "./choices";

const USER_ID = "user_123";
const AT = new Date("2026-10-04T12:00:00.000Z");

beforeEach(() => {
  vi.resetAllMocks();
  db.account.findMany.mockResolvedValue([]);
});

describe("listAccountChoices", () => {
  it("seeds the default cash account before reading, so a new user always has one to pick", async () => {
    const order: string[] = [];

    defaultCash.ensureDefaultCash.mockImplementation(async () => {
      order.push("seed");
    });
    db.account.findMany.mockImplementation(async () => {
      order.push("read");

      return [];
    });

    await listAccountChoices(USER_ID);

    expect(defaultCash.ensureDefaultCash).toHaveBeenCalledWith(USER_ID);
    expect(order).toEqual(["seed", "read"]);
  });

  it("reads only the user's accounts, with their bank, in the board's order", async () => {
    await listAccountChoices(USER_ID);

    expect(db.account.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      include: { bank: { select: { name: true } } },
      orderBy: [
        { bank: { createdAt: "asc" } },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });
  });

  it("names each account 'Banco · Cuenta' and keeps the archived ones, flagged", async () => {
    db.account.findMany.mockResolvedValue([
      {
        id: "acc_1",
        currency: "ARS",
        name: "Caja de ahorro",
        archivedAt: null,
        bank: { name: "Banco Galicia" },
      },
      {
        id: "acc_2",
        currency: "USD",
        name: "Vieja",
        archivedAt: AT,
        bank: { name: "Banco Galicia" },
      },
    ]);

    expect(await listAccountChoices(USER_ID)).toEqual([
      {
        id: "acc_1",
        currency: "ARS",
        label: "Banco Galicia · Caja de ahorro",
        archived: false,
      },
      {
        id: "acc_2",
        currency: "USD",
        label: "Banco Galicia · Vieja",
        archived: true,
      },
    ]);
  });
});
