// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AmountCurrencyFields } from "./AmountCurrencyFields";

describe("AmountCurrencyFields", () => {
  it("shows the amount as typed and the currency chosen", () => {
    render(
      <AmountCurrencyFields amount="1200" currency="USD" onChange={() => {}} />,
    );

    expect(screen.getByRole("textbox", { name: /^Monto\b/ })).toHaveValue(
      "1200",
    );
    expect(screen.getByRole("button", { name: /Moneda/ })).toHaveTextContent(
      "USD",
    );
    expect(screen.getByText("Usa un punto para los decimales.")).toBeVisible();
  });

  it("reports the amount as the user types it", () => {
    const onChange = vi.fn();

    render(
      <AmountCurrencyFields amount="" currency="ARS" onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: /^Monto\b/ }), {
      target: { value: "99.5" },
    });

    expect(onChange).toHaveBeenCalledWith({ amount: "99.5" });
  });

  it("reports the currency the user picks", async () => {
    const onChange = vi.fn();

    render(
      <AmountCurrencyFields amount="" currency="ARS" onChange={onChange} />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    const option = await screen.findByRole("option", { name: /USD/ });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith({ currency: "USD" });
  });

  it("offers only legal tender: a plan in installments never takes a crypto currency", async () => {
    render(
      <AmountCurrencyFields amount="" currency="ARS" onChange={() => {}} />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    expect(
      await screen.findByRole("option", { name: /^USD - / }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "USDC - USD Coin" }),
    ).toBeNull();
    expect(screen.queryByText("Criptomonedas")).toBeNull();
  });
});
