import { describe, expect, it } from "vitest";

import { formatIncomeDate } from "@/core/incomes/dates";
import { formatMoney } from "@/core/incomes/money";
import type { Transfer } from "@/core/transfers/types";

import { NO_FILTERS } from "./consts";
import type { TransferRow } from "./types";
import {
  filterTransfers,
  hasActiveFilters,
  toTransferRows,
  transferTitle,
} from "./utils";

const TRANSFER: Transfer = {
  id: "tr_1",
  fromAccountId: "acc_a",
  toAccountId: "acc_b",
  fromLabel: "Galicia · Caja de ahorro",
  toLabel: "Efectivo · Efectivo",
  currency: "ARS",
  amount: 150050,
  date: "2026-10-03",
  notes: "Alquiler",
};

const row = (patch: Partial<TransferRow> = {}): TransferRow => ({
  ...toTransferRows([TRANSFER])[0],
  ...patch,
});

describe("toTransferRows", () => {
  it("formats the money in the currency of the transfer and the date for reading, and keeps the rest", () => {
    expect(toTransferRows([TRANSFER])).toEqual([
      {
        ...TRANSFER,
        amountLabel: formatMoney(150050, "ARS"),
        amountDecimal: "1500.50",
        dateLabel: formatIncomeDate("2026-10-03"),
      },
    ]);
  });

  it("formats each transfer in its own currency", () => {
    const [usd] = toTransferRows([
      { ...TRANSFER, currency: "USD", amount: 2500 },
    ]);

    expect(usd.amountLabel).toMatch(/25,00/);
    expect(usd.amountLabel).not.toBe(toTransferRows([TRANSFER])[0].amountLabel);
    expect(usd.amountDecimal).toBe("25.00");
  });
});

describe("transferTitle", () => {
  it("names the transfer by its two accounts, for the accessible name of its buttons", () => {
    expect(transferTitle(row())).toBe(
      "Transferencia de Galicia · Caja de ahorro a Efectivo · Efectivo",
    );
  });
});

describe("filterTransfers", () => {
  const rows = [
    row({
      id: "a",
      fromAccountId: "acc_a",
      toAccountId: "acc_b",
      currency: "ARS",
    }),
    row({
      id: "b",
      fromAccountId: "acc_c",
      toAccountId: "acc_d",
      fromLabel: "Nación · Dólares",
      toLabel: "Efectivo · Dólares",
      currency: "USD",
      notes: null,
    }),
  ];

  it("keeps every row without filters", () => {
    expect(filterTransfers(rows, NO_FILTERS)).toEqual(rows);
  });

  it("finds a row by either account, bank or note, ignoring case and accents", () => {
    expect(
      filterTransfers(rows, { ...NO_FILTERS, search: "NACION" }).map(
        (r) => r.id,
      ),
    ).toEqual(["b"]);
    expect(
      filterTransfers(rows, { ...NO_FILTERS, search: "caja de ahorro" }).map(
        (r) => r.id,
      ),
    ).toEqual(["a"]);
    expect(
      filterTransfers(rows, { ...NO_FILTERS, search: "alquiler" }).map(
        (r) => r.id,
      ),
    ).toEqual(["a"]);
    expect(
      filterTransfers(rows, { ...NO_FILTERS, search: "  efectivo " }).map(
        (r) => r.id,
      ),
    ).toEqual(["a", "b"]);
  });

  it("finds nothing for a text nothing has", () => {
    expect(filterTransfers(rows, { ...NO_FILTERS, search: "zzz" })).toEqual([]);
  });

  it("filters by an account on either side", () => {
    expect(
      filterTransfers(rows, { ...NO_FILTERS, accountId: "acc_b" }).map(
        (r) => r.id,
      ),
    ).toEqual(["a"]);
    expect(
      filterTransfers(rows, { ...NO_FILTERS, accountId: "acc_c" }).map(
        (r) => r.id,
      ),
    ).toEqual(["b"]);
  });

  it("filters by currency", () => {
    expect(
      filterTransfers(rows, { ...NO_FILTERS, currency: "USD" }).map(
        (r) => r.id,
      ),
    ).toEqual(["b"]);
  });

  it("combines the filters", () => {
    expect(
      filterTransfers(rows, {
        search: "efectivo",
        accountId: "acc_a",
        currency: "ARS",
      }).map((r) => r.id),
    ).toEqual(["a"]);
    expect(
      filterTransfers(rows, {
        search: "efectivo",
        accountId: "acc_a",
        currency: "USD",
      }),
    ).toEqual([]);
  });

  it("does not change the rows it is given", () => {
    const copy = [...rows];

    filterTransfers(rows, { ...NO_FILTERS, search: "nacion" });

    expect(rows).toEqual(copy);
  });
});

describe("hasActiveFilters", () => {
  it("is false at the defaults, including a search of only spaces", () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, search: "   " })).toBe(false);
  });

  it("is true when anything narrows the list", () => {
    expect(hasActiveFilters({ ...NO_FILTERS, search: "a" })).toBe(true);
    expect(hasActiveFilters({ ...NO_FILTERS, accountId: "acc_a" })).toBe(true);
    expect(hasActiveFilters({ ...NO_FILTERS, currency: "ARS" })).toBe(true);
  });
});
