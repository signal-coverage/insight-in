// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Label, Select } from "@heroui/react";
import { describe, expect, it } from "vitest";

import { CRYPTO_CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";

import { CurrencyListBox } from "./CurrencyListBox";

const CRYPTO_LABELS = CRYPTO_CURRENCY_OPTIONS.map(({ label }) => label);

const openWith = async (includeCrypto: boolean, cryptoFirst?: boolean) => {
  render(
    <Select defaultValue="ARS">
      <Label>Moneda</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <CurrencyListBox
          includeCrypto={includeCrypto}
          cryptoFirst={cryptoFirst}
        />
      </Select.Popover>
    </Select>,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: /Moneda$/ }), {
    key: "ArrowDown",
  });

  const listbox = await screen.findByRole("listbox");

  return {
    listbox,
    options: within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? ""),
  };
};

describe("CurrencyListBox", () => {
  it("lists only legal tender when the field takes no crypto", async () => {
    const { listbox, options } = await openWith(false);

    expect(options[0]).toMatch(/^ARS - /);
    expect(options.some((option) => option.startsWith("USD - "))).toBe(true);
    expect(options.some((option) => CRYPTO_LABELS.includes(option))).toBe(
      false,
    );
    expect(within(listbox).queryByText("Criptomonedas")).toBeNull();
  });

  it("adds the crypto currencies after the legal tender ones, under 'Criptomonedas'", async () => {
    const { listbox, options } = await openWith(true);

    expect(within(listbox).getByText("Monedas")).toBeInTheDocument();
    expect(within(listbox).getByText("Criptomonedas")).toBeInTheDocument();
    expect(options[0]).toMatch(/^ARS - /);
    expect(CRYPTO_LABELS).toHaveLength(10);
    expect(options.slice(-CRYPTO_LABELS.length)).toEqual(CRYPTO_LABELS);
    expect(
      options
        .slice(0, -CRYPTO_LABELS.length)
        .some((option) => CRYPTO_LABELS.includes(option)),
    ).toBe(false);
  });

  it("lists the legal tender first, then the crypto, when cryptoFirst is not set", async () => {
    const { listbox, options } = await openWith(true);

    expect(options[0]).toMatch(/^ARS - /);
    expect(options[0]).not.toBe(CRYPTO_LABELS[0]);
    expect(
      within(listbox)
        .getByText("Monedas")
        .compareDocumentPosition(within(listbox).getByText("Criptomonedas")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("lists the crypto first, then the legal tender, when cryptoFirst is set", async () => {
    const { listbox, options } = await openWith(true, true);

    expect(options[0]).toBe(CRYPTO_LABELS[0]);
    expect(options[0]).toMatch(/^USDC - /);
    expect(options.slice(0, CRYPTO_LABELS.length)).toEqual(CRYPTO_LABELS);
    expect(options[CRYPTO_LABELS.length]).toMatch(/^ARS - /);
    expect(
      within(listbox)
        .getByText("Criptomonedas")
        .compareDocumentPosition(within(listbox).getByText("Monedas")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
