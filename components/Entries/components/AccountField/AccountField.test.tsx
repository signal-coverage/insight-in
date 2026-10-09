// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccountField } from "./AccountField";

const ACCOUNTS = [
  {
    id: "galicia",
    currency: "ARS",
    label: "Banco Galicia · Caja de ahorro",
    archived: false,
  },
  {
    id: "cash",
    currency: "ARS",
    label: "Efectivo · Efectivo",
    archived: false,
  },
  { id: "old", currency: "ARS", label: "Banco Nación · Vieja", archived: true },
  {
    id: "dollars",
    currency: "USD",
    label: "Banco Galicia · Dólares",
    archived: false,
  },
];

const renderField = (
  patch: Partial<Parameters<typeof AccountField>[0]> = {},
) => {
  const onChange = vi.fn();

  render(
    <form aria-label="form">
      <AccountField
        accounts={ACCOUNTS}
        currency="ARS"
        value={null}
        onChange={onChange}
        {...patch}
      />
    </form>,
  );

  return { onChange };
};

const trigger = () => screen.getByRole("button", { name: /Cuenta$/ });

const open = async () => {
  fireEvent.keyDown(trigger(), { key: "ArrowDown" });

  return screen.findAllByRole("option");
};

const submitted = () =>
  new FormData(screen.getByRole("form", { name: "form" }) as HTMLFormElement);

describe("AccountField", () => {
  it("is a select named Cuenta that asks to pick one while none is chosen", () => {
    renderField();

    expect(trigger()).toHaveTextContent("Elegí una cuenta");
  });

  it("offers only the active accounts in the currency of the movement, as 'Banco · Cuenta'", async () => {
    renderField();

    const options = await open();

    expect(options.map((option) => option.textContent)).toEqual([
      "Banco Galicia · Caja de ahorro",
      "Efectivo · Efectivo",
    ]);
  });

  it("follows the currency: other currency, other accounts", async () => {
    renderField({ currency: "USD" });

    const options = await open();

    expect(options.map((option) => option.textContent)).toEqual([
      "Banco Galicia · Dólares",
    ]);
  });

  it("shows the account that is chosen", () => {
    renderField({ value: "cash" });

    expect(trigger()).toHaveTextContent("Efectivo · Efectivo");
  });

  it("offers the archived account the record already has, marked as archived", async () => {
    renderField({ value: "old", keepAccountId: "old" });

    expect(trigger()).toHaveTextContent("Banco Nación · Vieja (archivada)");

    const options = await open();

    expect(options.map((option) => option.textContent)).toContain(
      "Banco Nación · Vieja (archivada)",
    );
  });

  it("reports the id of the account picked", async () => {
    const { onChange } = renderField();

    const options = await open();

    fireEvent.keyDown(options[1], { key: "Enter" });
    fireEvent.keyUp(options[1], { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("cash");
  });

  it("submits the chosen account with the form", () => {
    renderField({ value: "galicia" });

    expect(submitted().get("accountId")).toBe("galicia");
  });

  it("submits an empty account while none is chosen, which the server refuses", () => {
    renderField();

    expect(submitted().get("accountId")).toBe("");
  });

  it("says there is no account in the currency and links to Bancos to create one", () => {
    renderField({ currency: "EUR" });

    expect(screen.getByText(/No tenés cuentas en EUR\./)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Creá una en Bancos" }),
    ).toHaveAttribute("href", "/dashboard/banks");
  });

  it("shows no such hint while the currency has accounts", () => {
    renderField();

    expect(
      screen.queryByRole("link", { name: "Creá una en Bancos" }),
    ).not.toBeInTheDocument();
  });

  it("shows the error the server found for the account", () => {
    renderField({ errorMessage: "Elegí una cuenta." });

    expect(screen.getByText("Elegí una cuenta.")).toBeInTheDocument();
  });

  it("submits the only account of the new currency when the value is stale from another currency", () => {
    renderField({ currency: "USD", value: "galicia" });

    expect(submitted().get("accountId")).toBe("dollars");
    expect(trigger()).toHaveTextContent("Banco Galicia · Dólares");
  });

  it("submits nothing and asks to pick one when a stale value meets several accounts", () => {
    renderField({
      currency: "USD",
      value: "galicia",
      accounts: [
        ...ACCOUNTS,
        {
          id: "dollars2",
          currency: "USD",
          label: "Banco Nación · Dólares",
          archived: false,
        },
      ],
    });

    expect(submitted().get("accountId")).toBe("");
    expect(trigger()).toHaveTextContent("Elegí una cuenta");
  });

  it("preselects the only account of the currency when no value is given", () => {
    renderField({ currency: "USD", value: null });

    expect(submitted().get("accountId")).toBe("dollars");
    expect(trigger()).toHaveTextContent("Banco Galicia · Dólares");
  });

  it("is not invalid, and shows no error, for an empty error message", () => {
    renderField({ errorMessage: "" });

    expect(document.querySelector('[data-invalid="true"]')).toBeNull();
    expect(document.querySelector('[data-slot="error-message"]')).toBeNull();
  });

  it("is invalid for a non-empty error message", () => {
    renderField({ errorMessage: "Elegí una cuenta." });

    expect(screen.getByText("Elegí una cuenta.")).toBeInTheDocument();
    expect(document.querySelector('[data-invalid="true"]')).not.toBeNull();
  });

  it("disables the select while no account matches the currency, keeping the hint", () => {
    renderField({ currency: "EUR" });

    expect(trigger()).toBeDisabled();
    expect(screen.getByText(/No tenés cuentas en EUR\./)).toBeInTheDocument();
  });

  it("keeps the hint and its link next to the error when there is no account in the currency, since the select hides its own description while invalid", () => {
    renderField({ currency: "EUR", errorMessage: "Elegí una cuenta." });

    expect(screen.getByText("Elegí una cuenta.")).toBeInTheDocument();
    expect(screen.getByText(/No tenés cuentas en EUR\./)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Creá una en Bancos" }),
    ).toHaveAttribute("href", "/dashboard/banks");
    expect(trigger()).toBeDisabled();
    // Outside the invalid select (and its description slot), where HeroUI's CSS cannot hide it.
    expect(document.querySelector('[data-invalid="true"]')).not.toBeNull();
    expect(
      screen
        .getByText(/No tenés cuentas en EUR\./)
        .closest('[data-invalid="true"], [data-slot="description"]'),
    ).toBeNull();
  });

  it("keeps the select enabled while the currency has accounts", () => {
    renderField();

    expect(trigger()).toBeEnabled();
  });
});

describe("AccountField as one side of a transfer", () => {
  it("takes its own label and submits under its own name", () => {
    renderField({
      label: "Cuenta de origen",
      name: "fromAccountId",
      value: "cash",
    });

    expect(
      screen.getByRole("button", { name: /Cuenta de origen/ }),
    ).toBeInTheDocument();
    expect(submitted().get("fromAccountId")).toBe("cash");
    expect(submitted().get("accountId")).toBeNull();
  });

  it("never offers the account excluded (the other side of the transfer)", async () => {
    renderField({ label: "Cuenta de destino", excludeAccountId: "galicia" });

    fireEvent.keyDown(
      screen.getByRole("button", { name: /Cuenta de destino/ }),
      { key: "ArrowDown" },
    );

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "Efectivo · Efectivo",
    ]);
  });

  it("preselects the only account left once the excluded one is out", () => {
    renderField({ excludeAccountId: "galicia", label: "Cuenta de destino" });

    expect(submitted().get("accountId")).toBe("cash");
  });

  it("says its own line when nothing is left to offer, still linking to Bancos", () => {
    renderField({
      accounts: [ACCOUNTS[0]],
      excludeAccountId: "galicia",
      emptyHint: "Necesitás otra cuenta en ARS para recibir la transferencia.",
    });

    expect(
      screen.getByText(
        /Necesitás otra cuenta en ARS para recibir la transferencia\./,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Creá una en Bancos" }),
    ).toBeVisible();
    expect(screen.queryByText(/No tenés cuentas en ARS/)).toBeNull();
  });
});
