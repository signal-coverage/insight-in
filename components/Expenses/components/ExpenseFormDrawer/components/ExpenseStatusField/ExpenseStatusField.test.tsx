// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExpenseStatusField } from "./ExpenseStatusField";

const HINT = "Cubierta: la pagó otra persona, no se descuenta de tu plata.";

describe("ExpenseStatusField", () => {
  it("offers Pendiente, Pagada and Cubierta por otro in that order, named Estado", () => {
    render(<ExpenseStatusField defaultStatus="SETTLED" />);

    const radios = within(
      screen.getByRole("radiogroup", { name: "Estado" }),
    ).getAllByRole("radio");

    expect(radios.map((radio) => radio.closest("label")?.textContent)).toEqual([
      "Pendiente",
      "Pagada",
      "Cubierta por otro",
    ]);
  });

  it("explains what 'Cubierta' means", () => {
    render(<ExpenseStatusField defaultStatus="SETTLED" />);

    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it.each([
    ["PLANNED", "Pendiente"],
    ["SETTLED", "Pagada"],
    ["COVERED", "Cubierta por otro"],
  ] as const)("selects %s as %s by default", (status, label) => {
    render(<ExpenseStatusField defaultStatus={status} />);

    expect(screen.getByRole("radio", { name: label })).toBeChecked();
  });

  it("submits the chosen value under the status name", () => {
    render(
      <form>
        <ExpenseStatusField defaultStatus="COVERED" />
      </form>,
    );

    const form = document.querySelector("form") as HTMLFormElement;

    expect(new FormData(form).get("status")).toBe("COVERED");
  });
});

describe("ExpenseStatusField onChange", () => {
  it("reports the status the user picks, and nothing before that", () => {
    const onChange = vi.fn();

    render(<ExpenseStatusField defaultStatus="SETTLED" onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "Pendiente" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("PLANNED");
  });
});
