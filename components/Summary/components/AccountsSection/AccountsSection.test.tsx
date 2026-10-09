// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CurrencyAccountsRow } from "../../types";
import { AccountsSection } from "./AccountsSection";

const ARS: CurrencyAccountsRow = {
  currency: "ARS",
  totalLabel: "$ 8.500,00",
  isTotalNegative: false,
  banks: [
    {
      bankId: "b1",
      bankName: "Efectivo",
      accounts: [
        {
          accountId: "a1",
          name: "Efectivo",
          balanceLabel: "$ 1.000,00",
          isNegative: false,
          isArchived: false,
        },
      ],
    },
    {
      bankId: "b2",
      bankName: "Galicia",
      accounts: [
        {
          accountId: "a2",
          name: "Caja de ahorro",
          balanceLabel: "$ 5.000,00",
          isNegative: false,
          isArchived: false,
        },
        {
          accountId: "a3",
          name: "Vieja",
          balanceLabel: "-$ 300,00",
          isNegative: true,
          isArchived: true,
        },
      ],
    },
  ],
};
const USD: CurrencyAccountsRow = {
  currency: "USD",
  totalLabel: "US$ 700,00",
  isTotalNegative: false,
  banks: [
    {
      bankId: "b2",
      bankName: "Galicia",
      accounts: [
        {
          accountId: "a4",
          name: "Dólares",
          balanceLabel: "US$ 700,00",
          isNegative: false,
          isArchived: false,
        },
      ],
    },
  ],
};

describe("AccountsSection", () => {
  it("is the 'Por cuenta' section and says it shows today's balances", () => {
    render(<AccountsSection rows={[ARS, USD]} />);

    expect(
      screen.getByRole("heading", { name: "Por cuenta" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Saldos de hoy/)).toBeVisible();
  });

  it("has one card per currency, never mixing them, each with its total", () => {
    render(<AccountsSection rows={[ARS, USD]} />);

    const ars = screen.getByRole("region", { name: "Por cuenta en ARS" });
    const usd = screen.getByRole("region", { name: "Por cuenta en USD" });

    expect(within(ars).getByText("$ 8.500,00")).toBeVisible();
    expect(within(ars).queryByText("US$ 700,00")).toBeNull();
    // The only USD account holds the whole total, so the amount shows twice: as its balance and as the total.
    expect(within(usd).getAllByText("US$ 700,00")).toHaveLength(2);
  });

  it("groups the accounts of a currency under their bank, each with its balance", () => {
    render(<AccountsSection rows={[ARS]} />);

    const ars = screen.getByRole("region", { name: "Por cuenta en ARS" });
    const galicia = within(ars).getByRole("group", { name: "Galicia" });

    expect(within(galicia).getByText("Caja de ahorro")).toBeVisible();
    expect(within(galicia).getByText("$ 5.000,00")).toBeVisible();
    expect(
      within(ars).getByRole("group", { name: "Efectivo" }),
    ).toBeInTheDocument();
  });

  it("shows a negative balance as a danger text and marks an archived account", () => {
    render(<AccountsSection rows={[ARS]} />);

    expect(screen.getByText("-$ 300,00")).toHaveClass("text-danger");
    expect(screen.getByText("$ 5.000,00")).not.toHaveClass("text-danger");
    expect(screen.getByText(/Vieja/)).toHaveTextContent("Vieja (archivada)");
  });

  it("shows a negative total as a danger text too", () => {
    render(
      <AccountsSection
        rows={[{ ...ARS, totalLabel: "-$ 10,00", isTotalNegative: true }]}
      />,
    );

    expect(screen.getByText("-$ 10,00")).toHaveClass("text-danger");
  });

  it("renders nothing without accounts", () => {
    const { container } = render(<AccountsSection rows={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the full name of an account as a title, so a long one that is cut can still be read", () => {
    render(<AccountsSection rows={[ARS]} />);

    expect(screen.getByText("Caja de ahorro")).toHaveAttribute(
      "title",
      "Caja de ahorro",
    );
    expect(screen.getByText(/Vieja/)).toHaveAttribute(
      "title",
      "Vieja (archivada)",
    );
  });
});
