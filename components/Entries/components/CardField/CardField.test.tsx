// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CardField } from "./CardField";

const CARDS = [
  { id: "visa", title: "Visa •••• 1234", currencies: ["ARS"] },
  { id: "master", title: "Mastercard •••• 9999", currencies: ["ARS"] },
  { id: "dollars", title: "Visa •••• 4321", currencies: ["USD"] },
  { id: "both", title: "Visa •••• 5555", currencies: ["EUR", "USD"] },
];

const renderField = (patch: Partial<Parameters<typeof CardField>[0]> = {}) => {
  const onChange = vi.fn();

  render(
    <CardField
      cards={CARDS}
      currency="ARS"
      value={null}
      onChange={onChange}
      {...patch}
    />,
  );

  return { onChange };
};

const trigger = () => screen.getByRole("button", { name: /Tarjeta/ });

const open = async () => {
  fireEvent.keyDown(trigger(), { key: "ArrowDown" });

  return screen.findAllByRole("option");
};

describe("CardField", () => {
  it("starts on 'Sin tarjeta' when no card is chosen", () => {
    renderField();

    expect(trigger()).toHaveTextContent("Sin tarjeta");
  });

  it("offers 'Sin tarjeta' and only the cards in the currency of the purchase", async () => {
    renderField();

    const options = await open();

    expect(options.map((option) => option.textContent)).toEqual([
      "Sin tarjeta",
      "Visa •••• 1234",
      "Mastercard •••• 9999",
    ]);
  });

  it("follows the currency: other currency, other cards", async () => {
    renderField({ currency: "USD" });

    const options = await open();

    expect(options.map((option) => option.textContent)).toEqual([
      "Sin tarjeta",
      "Visa •••• 4321",
      "Visa •••• 5555",
    ]);
  });

  it("offers a card in every currency it can pay in, and in no other", async () => {
    renderField({ currency: "EUR" });

    const options = await open();

    expect(options.map((option) => option.textContent)).toEqual([
      "Sin tarjeta",
      "Visa •••• 5555",
    ]);
  });

  it("shows the card that is chosen", () => {
    renderField({ value: "master" });

    expect(trigger()).toHaveTextContent("Mastercard •••• 9999");
  });

  it("reports the id of the card picked", async () => {
    const { onChange } = renderField();

    const options = await open();
    const visa = options.find((option) => option.textContent?.includes("Visa"));

    fireEvent.keyDown(visa!, { key: "Enter" });
    fireEvent.keyUp(visa!, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("visa");
  });

  it("reports null when 'Sin tarjeta' is picked again", async () => {
    const { onChange } = renderField({ value: "visa" });

    const options = await open();
    const none = options.find((option) => option.textContent === "Sin tarjeta");

    fireEvent.keyDown(none!, { key: "Enter" });
    fireEvent.keyUp(none!, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  describe("when a card is required", () => {
    it("does not offer 'Sin tarjeta', only the cards in the currency", async () => {
      renderField({ isRequired: true });

      const options = await open();

      expect(options.map((option) => option.textContent)).toEqual([
        "Visa •••• 1234",
        "Mastercard •••• 9999",
      ]);
    });

    it("asks to pick one while none is chosen", () => {
      renderField({ isRequired: true });

      expect(trigger()).toHaveTextContent("Elegí una tarjeta");
      expect(trigger()).not.toHaveTextContent("Sin tarjeta");
    });

    it("reports the id of the card picked", async () => {
      const { onChange } = renderField({ isRequired: true });

      const options = await open();

      fireEvent.keyDown(options[1], { key: "Enter" });
      fireEvent.keyUp(options[1], { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith("master");
    });
  });

  it("shows the error the server found for the card", () => {
    renderField({ errorMessage: "No se encontró la tarjeta." });

    expect(screen.getByText("No se encontró la tarjeta.")).toBeInTheDocument();
  });

  it("keeps offering the card the record already has, even in a currency it no longer pays in", async () => {
    renderField({ currency: "ARS", value: "dollars", keepCardId: "dollars" });

    expect(trigger()).toHaveTextContent("Visa •••• 4321");

    const options = await open();

    expect(options.map((option) => option.textContent)).toContain(
      "Visa •••• 4321",
    );
  });

  it("does not offer that card to any other record", async () => {
    renderField({ currency: "ARS" });

    const options = await open();

    expect(options.map((option) => option.textContent)).not.toContain(
      "Visa •••• 4321",
    );
  });
});
