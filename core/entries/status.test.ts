import { describe, expect, it } from "vitest";

import {
  ENTRY_STATUSES,
  isEntryStatus,
  isMoneyStatus,
  MONEY_STATUSES,
} from "./status";

describe("the entry statuses", () => {
  it("are the three values of the database enum", () => {
    expect(ENTRY_STATUSES).toEqual(["PLANNED", "SETTLED", "COVERED"]);
  });

  it("recognises each of them and nothing else", () => {
    for (const status of ENTRY_STATUSES) {
      expect(isEntryStatus(status)).toBe(true);
    }

    expect(isEntryStatus("DONE")).toBe(false);
    expect(isEntryStatus("covered")).toBe(false);
    expect(isEntryStatus(null)).toBe(false);
  });
});

describe("the money statuses", () => {
  it("leave COVERED out: it never moves the user's money", () => {
    expect(MONEY_STATUSES).toEqual(["PLANNED", "SETTLED"]);
    expect(isMoneyStatus("PLANNED")).toBe(true);
    expect(isMoneyStatus("SETTLED")).toBe(true);
    expect(isMoneyStatus("COVERED")).toBe(false);
    expect(isMoneyStatus(undefined)).toBe(false);
  });
});
