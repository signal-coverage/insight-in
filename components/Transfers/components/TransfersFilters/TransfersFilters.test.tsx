// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AccountChoice } from "@/core/accounts/types";

import { NO_FILTERS } from "../../consts";
import { TransfersFilters } from "./TransfersFilters";

const ACCOUNTS: AccountChoice[] = [
  {
    id: "acc_a",
    currency: "ARS",
    label: "Galicia · Caja de ahorro",
    archived: false,
  },
  { id: "acc_old", currency: "ARS", label: "Nación · Vieja", archived: true },
  { id: "acc_c", currency: "USD", label: "Galicia · Dólares", archived: false },
];

const renderFilters = (
  patch: Partial<Parameters<typeof TransfersFilters>[0]> = {},
) => {
  const onChange = vi.fn();
  const onClear = vi.fn();

  render(
    <TransfersFilters
      filters={NO_FILTERS}
      accounts={ACCOUNTS}
      canClear={false}
      onChange={onChange}
      onClear={onClear}
      {...patch}
    />,
  );

  return { onChange, onClear };
};

describe("TransfersFilters", () => {
  it("is a group named for what it filters, with a search field", () => {
    renderFilters();

    expect(
      screen.getByRole("group", { name: "Filtrar transferencias" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Buscar transferencias" }),
    ).toBeInTheDocument();
  });

  it("reports what is typed in the search", () => {
    const { onChange } = renderFilters();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar transferencias" }),
      {
        target: { value: "alqui" },
      },
    );

    expect(onChange).toHaveBeenCalledWith({ search: "alqui" });
  });

  it("offers every account, archived ones included (a past transfer may use one)", async () => {
    renderFilters();

    fireEvent.keyDown(screen.getByRole("button", { name: /Cuenta$/ }), {
      key: "ArrowDown",
    });

    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual([
      "Todas las cuentas",
      "Galicia · Caja de ahorro",
      "Nación · Vieja",
      "Galicia · Dólares",
    ]);
  });

  it("offers the currencies the accounts have, each once", async () => {
    renderFilters();

    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda$/ }), {
      key: "ArrowDown",
    });

    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["Todas las monedas", "ARS", "USD"]);
  });

  it("reports the account chosen", async () => {
    const { onChange } = renderFilters();

    fireEvent.keyDown(screen.getByRole("button", { name: /Cuenta$/ }), {
      key: "ArrowDown",
    });

    const option = await screen.findByRole("option", {
      name: "Galicia · Dólares",
    });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith({ accountId: "acc_c" });
  });

  it("reports the currency chosen", async () => {
    const { onChange } = renderFilters();

    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda$/ }), {
      key: "ArrowDown",
    });

    const option = await screen.findByRole("option", { name: "USD" });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith({ currency: "USD" });
  });

  it("offers 'Limpiar filtros' only when something is on", () => {
    const { onClear } = renderFilters({ canClear: true });

    fireEvent.click(screen.getByRole("button", { name: /Limpiar filtros/ }));

    expect(onClear).toHaveBeenCalled();
  });

  it("has no clear button at the defaults", () => {
    renderFilters();

    expect(
      screen.queryByRole("button", { name: /Limpiar filtros/ }),
    ).toBeNull();
  });

  it.each([
    ["Cuenta", /Cuenta$/, "Todas las cuentas", { accountId: null }],
    ["Moneda", /Moneda$/, "Todas las monedas", { currency: null }],
  ])(
    "clears the %s filter when its 'all' option is chosen",
    async (_label, trigger, optionName, expected) => {
      const { onChange } = renderFilters({
        filters: { ...NO_FILTERS, accountId: "acc_c", currency: "USD" },
      });

      fireEvent.keyDown(screen.getByRole("button", { name: trigger }), {
        key: "ArrowDown",
      });

      const option = await screen.findByRole("option", { name: optionName });

      fireEvent.keyDown(option, { key: "Enter" });
      fireEvent.keyUp(option, { key: "Enter" });

      expect(onChange).toHaveBeenCalledWith(expected);
    },
  );
});
