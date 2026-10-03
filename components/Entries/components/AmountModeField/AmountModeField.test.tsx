// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AmountModeField } from "./AmountModeField";

describe("AmountModeField", () => {
  it("offers the total or the amount of one installment, as a group named after the question", () => {
    render(<AmountModeField value="total" onChange={() => {}} />);

    const group = screen.getByRole("radiogroup", {
      name: "Cómo ingresar el monto",
    });

    expect(group).toBeVisible();
    expect(
      screen.getAllByRole("radio").map((radio) => radio.getAttribute("value")),
    ).toEqual(["total", "perInstallment"]);
    expect(screen.getByRole("radio", { name: "Monto total" })).toBeVisible();
    expect(
      screen.getByRole("radio", { name: "Monto por cuota" }),
    ).toBeVisible();
  });

  it("checks the mode it is given", () => {
    render(<AmountModeField value="perInstallment" onChange={() => {}} />);

    expect(
      screen.getByRole("radio", { name: "Monto por cuota" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Monto total" }),
    ).not.toBeChecked();
  });

  it("reports the mode the user picks", () => {
    const onChange = vi.fn();

    render(<AmountModeField value="total" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Monto por cuota" }));

    expect(onChange).toHaveBeenCalledWith("perInstallment");
  });
});
