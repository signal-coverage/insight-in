import { describe, expect, it, vi } from "vitest";

import { moveExpenseDates, moveIncomeDates } from "./dateMoves";

const USER_ID = "user_123";

const MOVES = [
  { id: "a", date: "2026-12-05" },
  { id: "b", date: "2027-01-05" },
];

const fakeDb = () => ({ $executeRaw: vi.fn().mockResolvedValue(2) });

// The tagged template reaches the client as (strings, ...values).
const callOf = (db: ReturnType<typeof fakeDb>) => {
  const [strings, ...values] = db.$executeRaw.mock.calls[0] as [
    TemplateStringsArray,
    ...unknown[],
  ];

  return { sql: strings.join("?").replace(/\s+/g, " ").trim(), values };
};

describe("moveIncomeDates", () => {
  it("writes every date in one statement, whatever the number of moves", async () => {
    const db = fakeDb();
    const many = Array.from({ length: 12 }, (_, index) => ({
      id: `i${index}`,
      date: `2027-${String(index + 1).padStart(2, "0")}-05`,
    }));

    await moveIncomeDates(db, USER_ID, many);

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("passes the ids, the dates and the user as parameters, never inside the SQL text", async () => {
    const db = fakeDb();

    await moveIncomeDates(db, USER_ID, MOVES);

    const { sql, values } = callOf(db);

    expect(values).toEqual([["a", "b"], ["2026-12-05", "2027-01-05"], USER_ID]);
    expect(sql).not.toContain("user_123");
    expect(sql).not.toContain("2026-12-05");
  });

  it("only touches planned incomes of the user, and only changes the date", async () => {
    const db = fakeDb();

    await moveIncomeDates(db, USER_ID, MOVES);

    const { sql } = callOf(db);

    expect(sql).toContain('UPDATE "Income"');
    expect(sql).toContain(`"userId" = ?`);
    expect(sql).toContain(`"status" = 'PLANNED'`);
    expect(sql).toContain(`SET "date" = `);
  });

  it("keeps the updatedAt column fresh, as an ordinary update does", async () => {
    const db = fakeDb();

    await moveIncomeDates(db, USER_ID, MOVES);

    expect(callOf(db).sql).toContain(`"updatedAt" = NOW()`);
  });

  it("writes nothing for no moves", async () => {
    const db = fakeDb();

    await expect(moveIncomeDates(db, USER_ID, [])).resolves.toBe(0);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("returns how many rows were updated", async () => {
    await expect(moveIncomeDates(fakeDb(), USER_ID, MOVES)).resolves.toBe(2);
  });
});

describe("moveExpenseDates", () => {
  it("writes every date in one statement, scoped to the user and without a status filter", async () => {
    const db = fakeDb();

    await moveExpenseDates(db, USER_ID, MOVES);

    const { sql, values } = callOf(db);

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(values).toEqual([["a", "b"], ["2026-12-05", "2027-01-05"], USER_ID]);
    expect(sql).toContain('UPDATE "Expense"');
    expect(sql).toContain(`"userId" = ?`);
    expect(sql).not.toContain("status");
  });

  it("writes nothing for no moves", async () => {
    const db = fakeDb();

    await expect(moveExpenseDates(db, USER_ID, [])).resolves.toBe(0);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
