// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createRecurringIncomeAction: vi.fn(),
  updateRecurringIncomeAction: vi.fn(),
  createCategoryAction: vi.fn(),
}));

vi.mock("@/core/incomes/actions", () => actions);

import { CRYPTO_CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";
import type { AccountChoice } from "@/core/accounts/types";

import type { RecurringFormTarget, RecurringRow } from "../../types";
import { RecurringFormDrawer } from "./RecurringFormDrawer";

const CATEGORIES = [
  { id: "c1", name: "Salary" },
  { id: "c2", name: "Other" },
];

const ACCOUNTS: readonly AccountChoice[] = [
  {
    id: "acc_1",
    currency: "ARS",
    label: "Banco Galicia · Caja de ahorro",
    archived: false,
  },
  {
    id: "acc_usd",
    currency: "USD",
    label: "Banco Galicia · Cuenta en dólares",
    archived: false,
  },
];

const ARCHIVED_ACCOUNT: AccountChoice = {
  id: "acc_old",
  currency: "USD",
  label: "Banco Nación · Vieja",
  archived: true,
};

const RECURRING: RecurringRow = {
  id: "rec_1",
  description: "Monthly salary",
  amount: 250000,
  currency: "USD",
  categoryId: "c1",
  categoryName: "Salary",
  notes: "Paid on the 5th",
  accountId: "acc_usd",
  frequency: "WEEKLY",
  startDate: "2026-01-05",
  endDate: "2026-12-05",
  amountLabel: "$2,500.00",
  amountDecimal: "2500.00",
  frequencyLabel: "Semanal",
  nextLabel: "Próximo: 5 oct 2026",
  endLabel: "Termina el 5 dic 2026",
};

const renderForm = (
  recurring: RecurringRow | null,
  accounts: readonly AccountChoice[] = ACCOUNTS,
) => {
  const onClose = vi.fn();
  const target: RecurringFormTarget = {
    key: 1,
    recurring,
    defaultDate: "2026-09-29",
  };

  render(
    <RecurringFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
      categories={CATEGORIES}
      accounts={accounts}
    />,
  );

  return { onClose };
};

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: /^(Agregar|Guardar)/ }));

// The date pickers submit ISO dates through hidden inputs, so what the form would send is the
// meaningful thing to assert (their visible segments are not one labelled input).
const formValue = (name: string) =>
  new FormData(document.querySelector("form")!).get(name);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("starts with sensible defaults", () => {
    renderForm(null);

    expect(
      screen.getByRole("heading", { name: "Agregar ingreso recurrente" }),
    ).toBeInTheDocument();
    expect(formValue("startDate")).toBe("2026-09-29");
    expect(formValue("endDate")).toBe("");
    expect(
      screen.getByRole("button", { name: /Frecuencia/ }),
    ).toHaveTextContent("Mensual");
    expect(
      screen.getByRole("button", { name: "Agregar ingreso recurrente" }),
    ).toBeInTheDocument();
  });

  it("has the same plus icon on its add button as every other add action", () => {
    renderForm(null);

    const button = screen.getByRole("button", {
      name: "Agregar ingreso recurrente",
    });

    expect(button.querySelector("svg")).not.toBeNull();
  });
});

describe("account field", () => {
  const accountTrigger = () => screen.getByRole("button", { name: /Cuenta$/ });

  it("preselects the only account in the currency of a new template (pesos)", () => {
    renderForm(null);

    expect(accountTrigger()).toHaveTextContent(
      "Banco Galicia · Caja de ahorro",
    );
    expect(formValue("accountId")).toBe("acc_1");
  });

  it("starts on the account of the template being edited", () => {
    renderForm(RECURRING);

    expect(accountTrigger()).toHaveTextContent(
      "Banco Galicia · Cuenta en dólares",
    );
  });

  it("keeps an archived account the template already has, marked as archived", () => {
    renderForm({ ...RECURRING, accountId: "acc_old" }, [
      ...ACCOUNTS,
      ARCHIVED_ACCOUNT,
    ]);

    expect(accountTrigger()).toHaveTextContent(
      "Banco Nación · Vieja (archivada)",
    );
    expect(formValue("accountId")).toBe("acc_old");
  });

  it("drops the account when the currency changes, and takes the only one of the new currency", async () => {
    renderForm(RECURRING);

    expect(formValue("accountId")).toBe("acc_usd");

    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    const pesos = await screen.findByRole("option", { name: /^ARS/ });

    fireEvent.keyDown(pesos, { key: "Enter" });
    fireEvent.keyUp(pesos, { key: "Enter" });

    expect(formValue("accountId")).toBe("acc_1");
  });

  it("asks for an account again when the new currency has several", async () => {
    renderForm(RECURRING, [
      ...ACCOUNTS,
      {
        id: "acc_ars_2",
        currency: "ARS",
        label: "Efectivo · Pesos",
        archived: false,
      },
    ]);

    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    const pesos = await screen.findByRole("option", { name: /^ARS/ });

    fireEvent.keyDown(pesos, { key: "Enter" });
    fireEvent.keyUp(pesos, { key: "Enter" });

    expect(accountTrigger()).toHaveTextContent("Elegí una cuenta");
    expect(formValue("accountId")).toBe("");
  });

  it("sends the chosen account with the rest of the form", async () => {
    actions.updateRecurringIncomeAction.mockResolvedValue({
      status: "success",
    });
    renderForm(RECURRING);

    submit();

    await waitFor(() =>
      expect(actions.updateRecurringIncomeAction).toHaveBeenCalledTimes(1),
    );

    const formData = actions.updateRecurringIncomeAction.mock
      .calls[0][1] as FormData;

    expect(formData.get("accountId")).toBe("acc_usd");
    expect(formData.has("medium")).toBe(false);
  });

  it("sends the archived account the template already has, so the edit keeps it", async () => {
    actions.updateRecurringIncomeAction.mockResolvedValue({
      status: "success",
    });
    renderForm({ ...RECURRING, accountId: "acc_old" }, [
      ...ACCOUNTS,
      ARCHIVED_ACCOUNT,
    ]);

    submit();

    await waitFor(() =>
      expect(actions.updateRecurringIncomeAction).toHaveBeenCalledTimes(1),
    );

    const formData = actions.updateRecurringIncomeAction.mock
      .calls[0][1] as FormData;

    expect(formData.get("accountId")).toBe("acc_old");
  });

  it("shows the error the server found for the account", async () => {
    actions.updateRecurringIncomeAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        accountId: [
          "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
        ],
      },
    });
    renderForm(RECURRING);

    submit();

    expect(
      await screen.findByText(
        "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
      ),
    ).toBeInTheDocument();
  });
});

describe("edit mode", () => {
  it("prefills every field from the template", () => {
    renderForm(RECURRING);

    expect(
      screen.getByRole("heading", { name: "Editar ingreso recurrente" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Descripción/)).toHaveValue("Monthly salary");
    expect(screen.getByLabelText(/Monto/)).toHaveValue("2500.00");
    expect(formValue("startDate")).toBe("2026-01-05");
    expect(formValue("endDate")).toBe("2026-12-05");
    expect(screen.getByLabelText(/Notas/)).toHaveValue("Paid on the 5th");
    expect(
      screen.getByRole("button", { name: /Frecuencia/ }),
    ).toHaveTextContent("Semanal");
    expect(screen.getByRole("button", { name: /Categoría/ })).toHaveTextContent(
      "Salary",
    );
  });

  it("saves through the update action with the form values and closes", async () => {
    actions.updateRecurringIncomeAction.mockResolvedValue({
      status: "success",
    });
    const { onClose } = renderForm(RECURRING);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Salary v2" },
    });
    submit();

    await waitFor(() =>
      expect(actions.updateRecurringIncomeAction).toHaveBeenCalledTimes(1),
    );

    const [id, formData] = actions.updateRecurringIncomeAction.mock
      .calls[0] as [string, FormData];

    expect(id).toBe("rec_1");
    expect(Object.fromEntries(formData)).toMatchObject({
      description: "Salary v2",
      amount: "2500.00",
      categoryId: "c1",
      frequency: "WEEKLY",
      startDate: "2026-01-05",
      endDate: "2026-12-05",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.createRecurringIncomeAction).not.toHaveBeenCalled();
  });

  it("shows 'Saving…' with a spinner, and locks Cancel, while it saves", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.updateRecurringIncomeAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderForm(RECURRING);

    submit();

    const pending = await screen.findByRole("button", { name: /Guardando/ });

    expect(pending).toHaveTextContent("Guardando…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    finish({ status: "success" });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Guardando/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows server field errors and stays open", async () => {
    actions.updateRecurringIncomeAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        endDate: ["La fecha de fin debe ser igual o posterior a la de inicio."],
      },
    });
    const { onClose } = renderForm(RECURRING);

    submit();

    expect(
      await screen.findByText(
        "La fecha de fin debe ser igual o posterior a la de inicio.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a general error when there are no field errors", async () => {
    actions.updateRecurringIncomeAction.mockResolvedValue({
      status: "error",
      message: "No se encontró el ingreso recurrente.",
    });

    renderForm(RECURRING);
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se encontró el ingreso recurrente.",
    );
  });
});

describe("the currency of a recurring income", () => {
  it("lists the crypto currencies after the legal-tender ones, and takes one", async () => {
    renderForm(null);

    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(options.slice(-CRYPTO_CURRENCY_OPTIONS.length)).toEqual(
      CRYPTO_CURRENCY_OPTIONS.map(({ label }) => label),
    );

    const usdc = within(listbox).getByRole("option", {
      name: "USDC - USD Coin",
    });

    fireEvent.keyDown(usdc, { key: "Enter" });
    fireEvent.keyUp(usdc, { key: "Enter" });

    expect(formValue("currency")).toBe("USDC");
  });
});
