// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { RecurringRow } from "../../../../../../types";
import { AmountCell } from "./AmountCell";

// A subscription quoted in 20 USD that really costs 35.000 ARS.
const NETFLIX: RecurringRow = {
  id: "rec_1",
  description: "Netflix",
  amount: 3500000,
  currency: "ARS",
  categoryId: "c1",
  categoryName: "Servicios",
  notes: null,
  accountId: "acc_1",
  originCurrency: "USD",
  originAmount: 2000,
  dayOfMonth: 5,
  decision: null,
  amountLabel: "$ 35.000,00",
  amountDecimal: "35000.00",
  dayLabel: "Día 5",
  originAmountDecimal: "20.00",
  referenceLabel: "Referencia: US$ 20,00",
};

const PLAIN: RecurringRow = {
  ...NETFLIX,
  originCurrency: null,
  originAmount: null,
  originAmountDecimal: null,
  referenceLabel: null,
};

// The wizard keeps what is typed, so the cell is rendered the way it is used: controlled.
function Harness({ row }: { row: RecurringRow }) {
  const [value, setValue] = useState(row.amountDecimal);

  return (
    <AmountCell
      row={row}
      value={value}
      isDisabled={false}
      onChange={setValue}
    />
  );
}

const amountInput = () =>
  screen.getByRole("textbox", { name: "Monto de Netflix" });

describe("AmountCell reference price", () => {
  it("shows the reference price of the template under the input", () => {
    render(<Harness row={NETFLIX} />);

    expect(screen.getByText("Referencia: US$ 20,00")).toBeVisible();
  });

  it("shows the implied rate of the amount in the input", () => {
    render(<Harness row={NETFLIX} />);

    expect(screen.getByText(/^1 USD = /).textContent).toMatch(
      /^1 USD = \$\s1\.750,00$/,
    );
  });

  it("follows the amount while the user edits it", () => {
    render(<Harness row={NETFLIX} />);

    fireEvent.change(amountInput(), { target: { value: "40000" } });

    expect(screen.getByText(/^1 USD = /).textContent).toMatch(
      /^1 USD = \$\s2\.000,00$/,
    );
  });

  it("hides the rate while the amount is not valid, and keeps the reference", () => {
    render(<Harness row={NETFLIX} />);

    fireEvent.change(amountInput(), { target: { value: "abc" } });

    expect(screen.queryByText(/^1 USD = /)).not.toBeInTheDocument();
    expect(screen.getByText("Referencia: US$ 20,00")).toBeVisible();

    fireEvent.change(amountInput(), { target: { value: "" } });

    expect(screen.queryByText(/^1 USD = /)).not.toBeInTheDocument();
  });

  it("says nothing extra for a template without a reference price", () => {
    render(<Harness row={PLAIN} />);

    expect(screen.queryByText(/Referencia/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ = /)).not.toBeInTheDocument();
  });

  it("keeps showing only the formatted amount once the template is decided", () => {
    render(<Harness row={{ ...NETFLIX, decision: "ENABLED" }} />);

    expect(screen.getByText("$ 35.000,00")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Referencia/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^1 USD = /)).not.toBeInTheDocument();
  });
});
