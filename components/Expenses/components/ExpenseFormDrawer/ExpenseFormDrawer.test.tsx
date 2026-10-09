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
  createExpenseAction: vi.fn(),
  updateExpenseAction: vi.fn(),
  createCategoryAction: vi.fn(),
}));

vi.mock("@/core/expenses/actions", () => actions);

import { CRYPTO_CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";
import type { AccountChoice } from "@/core/accounts/types";

import { creditOption } from "../../testCards";
import type { CardOption, ExpenseRow, FormTarget } from "../../types";
import { ExpenseFormDrawer } from "./ExpenseFormDrawer";

const CATEGORIES = [
  { id: "c1", name: "Alquiler" },
  { id: "c2", name: "Comida" },
];

// Closes on the 25th and is paid on the 5th.
const CARD: CardOption = creditOption();

const DOLLAR_CARD: CardOption = creditOption({
  id: "card_2",
  title: "Mastercard •••• 9999",
  brand: "MASTERCARD",
  last4: "9999",
  currency: "USD",
});

const ACCOUNTS = [
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

const EXPENSE: ExpenseRow = {
  id: "exp_1",
  description: "Monthly rent",
  amount: 35000050,
  currency: "ARS",
  date: "2026-01-05",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  accountLabel: "Banco Galicia · Caja de ahorro",
  isRecurring: true,
  installmentPlanId: null,
  installmentNumber: null,
  cardId: null,
  purchaseDate: null,
  originCurrency: null,
  originAmount: null,
  originAmountDecimal: null,
  originLabel: null,
  originTooltip: null,
  expectedReimbursement: null,
  reimbursementReceived: 0,
  expectedReimbursementDecimal: null,
  reimbursementTooltip: null,
  amountLabel: "$ 350.000,50",
  amountDecimal: "350000.50",
  dateLabel: "5 ene 2026",
};

const INSTALLMENT: ExpenseRow = {
  ...EXPENSE,
  id: "exp_9",
  description: "Heladera (3/12)",
  isRecurring: false,
  status: "PLANNED",
  installmentPlanId: "plan_1",
  installmentNumber: 3,
};

const renderForm = (
  expense: ExpenseRow | null,
  cards: readonly CardOption[] = [],
  accounts: readonly AccountChoice[] = ACCOUNTS,
) => {
  const onClose = vi.fn();
  const target: FormTarget = { key: 1, expense, defaultDate: "2026-09-29" };

  render(
    <ExpenseFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
      categories={CATEGORIES}
      cards={cards}
      accounts={accounts}
    />,
  );

  return { onClose };
};

const pickCategory = async (name: string) => {
  fireEvent.keyDown(screen.getByRole("button", { name: /Categoría/ }), {
    key: "ArrowDown",
  });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

// A promise the test settles by hand, to observe the form while a save is in flight.
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
};

const createdForm = (): FormData =>
  actions.createExpenseAction.mock.calls[0][0] as FormData;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("has an Add expense button with the same plus icon as every other add action", () => {
    renderForm(null);

    const button = screen.getByRole("button", { name: "Agregar gasto" });

    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("starts with sensible defaults: the default currency, today, and already paid", () => {
    renderForm(null);

    expect(screen.getByRole("button", { name: /Moneda/ })).toHaveTextContent(
      "ARS",
    );
    expect(document.querySelector('input[name="date"]')).toHaveValue(
      "2026-09-29",
    );
    expect(screen.getByRole("radio", { name: "Pagada" })).toBeChecked();
    expect(
      screen.queryByRole("switch", { name: "Ya pagado" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Gasto recurrente" }),
    ).not.toBeChecked();
  });

  it("shows 'Agregando gasto…' with a spinner, and locks Cancel, while it saves", async () => {
    const save = deferred<{ status: "success" }>();

    actions.createExpenseAction.mockReturnValue(save.promise);
    renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Rent" },
    });
    fireEvent.change(screen.getByLabelText(/Monto/), {
      target: { value: "10" },
    });
    await pickCategory("Alquiler");
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    const pending = await screen.findByRole("button", {
      name: /Agregando gasto/,
    });

    expect(pending).toHaveTextContent("Agregando gasto…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Agregando gasto/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("sends the status picked and the recurring mark as the switch says", async () => {
    actions.createExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Rent" },
    });
    fireEvent.change(screen.getByLabelText(/Monto/), {
      target: { value: "10" },
    });
    await pickCategory("Alquiler");
    fireEvent.click(screen.getByRole("radio", { name: "Pendiente" }));
    fireEvent.click(screen.getByRole("switch", { name: "Gasto recurrente" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("status")).toBe("PLANNED");
    expect(createdForm().get("isRecurring")).toBe("true");
    expect(createdForm().get("description")).toBe("Rent");
  });

  it("shows server field errors and stays open", async () => {
    actions.createExpenseAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { amount: ["El monto debe ser mayor que cero."] },
    });
    const { onClose } = renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Rent" },
    });
    fireEvent.change(screen.getByLabelText(/Monto/), {
      target: { value: "10" },
    });
    await pickCategory("Alquiler");
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    expect(
      await screen.findByText("El monto debe ser mayor que cero."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("account field", () => {
  const accountTrigger = () => screen.getByRole("button", { name: /Cuenta/ });

  const pickCurrency = async (label: RegExp) => {
    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    const option = await screen.findByRole("option", { name: label });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });
  };

  it("replaces the Medio radio: there is no Digital/Efectivo choice any more", () => {
    renderForm(null);

    expect(
      screen.queryByRole("radiogroup", { name: "Medio" }),
    ).not.toBeInTheDocument();
    expect(accountTrigger()).toBeInTheDocument();
  });

  it("preselects the only account of the currency for a new expense", () => {
    renderForm(null);

    expect(accountTrigger()).toHaveTextContent(
      "Banco Galicia · Caja de ahorro",
    );
  });

  it("starts on the account of the expense being edited", () => {
    renderForm(
      { ...EXPENSE, accountId: "acc_2" },
      [],
      [
        ...ACCOUNTS,
        {
          id: "acc_2",
          currency: "ARS",
          label: "Efectivo · Efectivo",
          archived: false,
        },
      ],
    );

    expect(accountTrigger()).toHaveTextContent("Efectivo · Efectivo");
  });

  it("keeps an archived account the expense already has, marked as archived", () => {
    renderForm(
      { ...EXPENSE, accountId: "acc_old" },
      [],
      [
        ...ACCOUNTS,
        {
          id: "acc_old",
          currency: "ARS",
          label: "Banco Nación · Vieja",
          archived: true,
        },
      ],
    );

    expect(accountTrigger()).toHaveTextContent(
      "Banco Nación · Vieja (archivada)",
    );
  });

  it("follows a currency change: the account of the old currency goes, the only one of the new comes", async () => {
    renderForm(null);

    await pickCurrency(/^USD - /);

    expect(accountTrigger()).toHaveTextContent(
      "Banco Galicia · Cuenta en dólares",
    );
  });

  it("asks for an account again when the new currency has several", async () => {
    renderForm(
      null,
      [],
      [
        ...ACCOUNTS,
        {
          id: "acc_usd_2",
          currency: "USD",
          label: "Efectivo · Dólares",
          archived: false,
        },
      ],
    );

    await pickCurrency(/^USD - /);

    expect(accountTrigger()).toHaveTextContent("Elegí una cuenta");
  });

  it("sends the chosen account with the rest of the form", async () => {
    actions.createExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Coffee" },
    });
    fireEvent.change(screen.getByLabelText(/Monto/), {
      target: { value: "10" },
    });
    await pickCategory("Comida");
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("accountId")).toBe("acc_1");
    expect(createdForm().has("medium")).toBe(false);
  });

  it("shows the error the server found for the account", async () => {
    actions.updateExpenseAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        accountId: [
          "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
        ],
      },
    });
    renderForm(EXPENSE);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText(
        "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
      ),
    ).toBeInTheDocument();
  });
});

describe("the Estado field", () => {
  const HINT = "Cubierta: la pagó otra persona, no se descuenta de tu plata.";
  const statusGroup = () => screen.getByRole("radiogroup", { name: "Estado" });

  const EXPENSES = [
    ["a new expense", null],
    ["an ordinary expense", { ...EXPENSE, isRecurring: false }],
    ["a recurring expense", EXPENSE],
    ["an installment of a purchase in cuotas", INSTALLMENT],
  ] as const;

  it.each(EXPENSES)(
    "offers a three-way Estado instead of the 'Ya pagado' switch for %s",
    (_name, expense) => {
      renderForm(expense);

      const radios = within(statusGroup()).getAllByRole("radio");

      expect(
        radios.map((radio) => radio.closest("label")?.textContent),
      ).toEqual(["Pendiente", "Pagada", "Cubierta por otro"]);
      expect(
        screen.queryByRole("switch", { name: "Ya pagado" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(EXPENSES)(
    "explains what 'Cubierta' means for %s",
    (_name, expense) => {
      renderForm(expense);

      expect(screen.getByText(HINT)).toBeInTheDocument();
    },
  );

  it("starts a new expense as Pagada", () => {
    renderForm(null);

    expect(screen.getByRole("radio", { name: "Pagada" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Pendiente" })).not.toBeChecked();
  });

  it.each([
    ["PLANNED", "Pendiente"],
    ["SETTLED", "Pagada"],
    ["COVERED", "Cubierta por otro"],
  ] as const)(
    "starts an ordinary expense with %s selected as %s",
    (status, label) => {
      renderForm({ ...EXPENSE, isRecurring: false, status });

      expect(screen.getByRole("radio", { name: label })).toBeChecked();
    },
  );

  it.each([
    ["PLANNED", "Pendiente"],
    ["SETTLED", "Pagada"],
    ["COVERED", "Cubierta por otro"],
  ] as const)(
    "starts an installment with %s selected as %s",
    (status, label) => {
      renderForm({ ...INSTALLMENT, status });

      expect(screen.getByRole("radio", { name: label })).toBeChecked();
    },
  );

  it("sends COVERED for a new expense when it is picked", async () => {
    actions.createExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Dinner" },
    });
    fireEvent.change(screen.getByLabelText(/Monto/), {
      target: { value: "10" },
    });
    await pickCategory("Comida");
    fireEvent.click(screen.getByRole("radio", { name: "Cubierta por otro" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("status")).toBe("COVERED");
  });

  it("sends COVERED for an ordinary expense when it is picked", async () => {
    actions.updateExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm({ ...EXPENSE, isRecurring: false });

    fireEvent.click(screen.getByRole("radio", { name: "Cubierta por otro" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = actions.updateExpenseAction.mock.calls[0][1] as FormData;

    expect(actions.updateExpenseAction.mock.calls[0][0]).toBe("exp_1");
    expect(sent.get("status")).toBe("COVERED");
  });

  it("sends the stored status when nothing was changed", async () => {
    actions.updateExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm({ ...EXPENSE, status: "PLANNED" });

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(
      (actions.updateExpenseAction.mock.calls[0][1] as FormData).get("status"),
    ).toBe("PLANNED");
  });

  it("sends the status picked, COVERED included, for an installment", async () => {
    actions.updateExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(INSTALLMENT);

    fireEvent.click(screen.getByRole("radio", { name: "Cubierta por otro" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = actions.updateExpenseAction.mock.calls[0][1] as FormData;

    expect(actions.updateExpenseAction.mock.calls[0][0]).toBe("exp_9");
    expect(sent.get("status")).toBe("COVERED");
    expect(sent.get("description")).toBe("Heladera (3/12)");
  });

  it("locks the currency of an installment but still sends the plan's", async () => {
    actions.updateExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(INSTALLMENT);

    expect(screen.getByRole("button", { name: /Moneda$/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = actions.updateExpenseAction.mock.calls[0][1] as FormData;

    expect(sent.get("currency")).toBe("ARS");
  });

  it("keeps the currency open for an ordinary expense", () => {
    renderForm({ ...EXPENSE, isRecurring: false });

    expect(screen.getByRole("button", { name: /Moneda$/ })).toBeEnabled();
  });

  it("keeps the recurring switch for a new and an ordinary expense", () => {
    renderForm(null);

    expect(
      screen.getByRole("switch", { name: "Gasto recurrente" }),
    ).toBeInTheDocument();
  });

  it("keeps the recurring switch for an existing expense", () => {
    renderForm({ ...EXPENSE, isRecurring: false });

    expect(
      screen.getByRole("switch", { name: "Gasto recurrente" }),
    ).toBeInTheDocument();
  });

  it("does not offer to make an installment recurring", () => {
    renderForm(INSTALLMENT);

    expect(
      screen.queryByRole("switch", { name: "Gasto recurrente" }),
    ).not.toBeInTheDocument();
  });
});

describe("edit mode", () => {
  it("has a plain Save changes button, without a plus", () => {
    renderForm(EXPENSE);

    expect(
      screen
        .getByRole("button", { name: "Guardar cambios" })
        .querySelector("svg"),
    ).toBeNull();
  });

  it("prefills every field from the expense", () => {
    renderForm({ ...EXPENSE, status: "PLANNED", notes: "Paid by transfer" });

    expect(screen.getByLabelText(/Descripción/)).toHaveValue("Monthly rent");
    expect(screen.getByLabelText(/Monto/)).toHaveValue("350000.50");
    expect(screen.getByRole("button", { name: /Categoría/ })).toHaveTextContent(
      "Alquiler",
    );
    expect(screen.getByLabelText(/Notas/)).toHaveValue("Paid by transfer");
    expect(screen.getByRole("radio", { name: "Pendiente" })).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Gasto recurrente" }),
    ).toBeChecked();
  });

  it("saves through the update action with the expense id and closes", async () => {
    actions.updateExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(EXPENSE);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.updateExpenseAction.mock.calls[0][0]).toBe("exp_1");
    expect(
      (actions.updateExpenseAction.mock.calls[0][1] as FormData).get(
        "isRecurring",
      ),
    ).toBe("true");
  });

  it("shows 'Guardando…' with a spinner, and locks Cancel, while it saves", async () => {
    const save = deferred<{ status: "success" }>();

    actions.updateExpenseAction.mockReturnValue(save.promise);
    renderForm(EXPENSE);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const pending = await screen.findByRole("button", { name: /Guardando/ });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(actions.updateExpenseAction).toHaveBeenCalledTimes(1),
    );
  });

  describe("the recurring switch", () => {
    const HINT =
      "Para dejar de repetirlo, usá Gastos recurrentes y elegí Quitar.";
    const toggle = () =>
      screen.getByRole("switch", { name: "Gasto recurrente" });

    it("is on and locked, with the hint, for an expense that belongs to a template", () => {
      renderForm({ ...EXPENSE, isRecurring: true });

      expect(toggle()).toBeChecked();
      expect(toggle()).toBeDisabled();
      expect(screen.getByText(HINT)).toBeInTheDocument();
    });

    it("still sends 'true' when a linked expense is saved", async () => {
      actions.updateExpenseAction.mockResolvedValue({ status: "success" });
      const { onClose } = renderForm({ ...EXPENSE, isRecurring: true });

      fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(
        (actions.updateExpenseAction.mock.calls[0][1] as FormData).get(
          "isRecurring",
        ),
      ).toBe("true");
    });

    it("is free to turn on for an expense that is not recurring, with no hint", () => {
      renderForm({ ...EXPENSE, isRecurring: false });

      expect(toggle()).not.toBeChecked();
      expect(toggle()).toBeEnabled();
      expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    });
  });

  it("shows a general error when there are no field errors", async () => {
    actions.updateExpenseAction.mockResolvedValue({
      status: "error",
      message: "No se encontró el gasto.",
    });
    renderForm(EXPENSE);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("No se encontró el gasto."),
    ).toBeInTheDocument();
  });
});

describe("the card", () => {
  const cardButton = () => screen.getByRole("button", { name: /Tarjeta/ });

  const pickCard = async (title: string) => {
    fireEvent.keyDown(cardButton(), { key: "ArrowDown" });

    const option = await screen.findByRole("option", { name: title });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });
  };

  const pickCurrency = async (code: string) => {
    fireEvent.keyDown(screen.getByRole("button", { name: /Moneda/ }), {
      key: "ArrowDown",
    });

    const option = await screen.findByRole("option", {
      name: new RegExp(`^${code} - `),
    });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });
  };

  const fillRequired = async () => {
    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Zapatillas" },
    });
    fireEvent.change(screen.getByLabelText(/Monto/), {
      target: { value: "10" },
    });
    await pickCategory("Comida");
  };

  const WITH_CARD: ExpenseRow = {
    ...EXPENSE,
    isRecurring: false,
    cardId: "card_1",
    date: "2026-10-05",
    purchaseDate: "2026-09-05",
  };

  it("is not offered when the user has no cards", () => {
    renderForm(null);

    expect(
      screen.queryByRole("button", { name: /Tarjeta/ }),
    ).not.toBeInTheDocument();
  });

  it("starts on 'Sin tarjeta', with the date called 'Fecha' and no charge line", () => {
    renderForm(null, [CARD]);

    expect(cardButton()).toHaveTextContent("Sin tarjeta");
    expect(screen.getByText("Fecha")).toBeInTheDocument();
    expect(screen.queryByText(/Se cobra el/)).not.toBeInTheDocument();
  });

  it("offers only the cards in the currency of the expense", async () => {
    renderForm(null, [CARD, DOLLAR_CARD]);

    fireEvent.keyDown(cardButton(), { key: "ArrowDown" });

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "Sin tarjeta",
      "Visa •••• 1234",
    ]);
  });

  it("calls the date 'Fecha de la compra' and says when it is charged once a card is chosen", async () => {
    renderForm(null, [CARD]);

    await pickCard("Visa •••• 1234");

    expect(screen.getByText("Fecha de la compra")).toBeInTheDocument();
    // Bought on the 29th, after the closing day of the 25th: it goes in the next statement, which
    // closes on October 25 and is paid on November 5.
    expect(
      screen.getByText(
        /^Se cobra el 5 nov 2026 \(resumen que cierra el 25 oct 2026\)$/,
      ),
    ).toBeVisible();
  });

  it("goes back to 'Fecha' and hides the charge line when the card is taken off", async () => {
    renderForm(null, [CARD]);

    await pickCard("Visa •••• 1234");
    await pickCard("Sin tarjeta");

    expect(screen.getByText("Fecha")).toBeInTheDocument();
    expect(screen.queryByText(/Se cobra el/)).not.toBeInTheDocument();
  });

  it("updates the charge line as the purchase date changes", async () => {
    renderForm(null, [CARD]);

    await pickCard("Visa •••• 1234");
    fireEvent.click(screen.getByRole("button", { name: /calendar/i }));

    const grid = await screen.findByRole("grid");
    const day = Array.from(grid.querySelectorAll('[role="button"]')).find(
      (cell) =>
        cell.textContent === "10" && !cell.hasAttribute("data-outside-month"),
    );

    fireEvent.click(day!);

    // Bought on September 10, before the closing: the September statement, paid on October 5.
    expect(
      await screen.findByText(
        /^Se cobra el 5 oct 2026 \(resumen que cierra el 25 sept?\.? 2026\)$/,
      ),
    ).toBeVisible();
  });

  it("drops a card that is in another currency when the currency changes, and offers the cards of the new one", async () => {
    renderForm(null, [CARD, DOLLAR_CARD]);

    await pickCard("Visa •••• 1234");
    await pickCurrency("USD");

    expect(cardButton()).toHaveTextContent("Sin tarjeta");
    expect(screen.queryByText(/Se cobra el/)).not.toBeInTheDocument();

    fireEvent.keyDown(cardButton(), { key: "ArrowDown" });

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "Sin tarjeta",
      "Mastercard •••• 9999",
    ]);
  });

  it("sends the card and the purchase date with the rest of the form", async () => {
    actions.createExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null, [CARD]);

    await fillRequired();
    await pickCard("Visa •••• 1234");
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("cardId")).toBe("card_1");
    // The server turns the purchase day into the charge date, so the form sends the day typed.
    expect(createdForm().get("date")).toBe("2026-09-29");
  });

  it("sends no card when none is chosen", async () => {
    actions.createExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null, [CARD]);

    await fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("cardId")).toBe("");
  });

  it("shows the stored purchase date, not the charge date, for an expense that has a card, and the charge line", () => {
    renderForm(WITH_CARD, [CARD]);

    expect(cardButton()).toHaveTextContent("Visa •••• 1234");
    expect(screen.getByText("Fecha de la compra")).toBeInTheDocument();
    expect(document.querySelector('input[name="date"]')).toHaveValue(
      "2026-09-05",
    );
    expect(
      screen.getByText(
        /^Se cobra el 5 oct 2026 \(resumen que cierra el 25 sept?\.? 2026\)$/,
      ),
    ).toBeVisible();
  });

  it("sends the purchase date back when an expense with a card is saved", async () => {
    actions.updateExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(WITH_CARD, [CARD]);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = actions.updateExpenseAction.mock.calls[0][1] as FormData;

    expect(sent.get("cardId")).toBe("card_1");
    expect(sent.get("date")).toBe("2026-09-05");
  });

  it("does not offer a card for an installment of a plan", () => {
    renderForm(INSTALLMENT, [CARD]);

    expect(
      screen.queryByRole("button", { name: /Tarjeta/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Fecha")).toBeInTheDocument();
  });

  it("shows the server's complaint about the card under the field", async () => {
    actions.createExpenseAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { cardId: ["No se encontró la tarjeta."] },
    });
    renderForm(null, [CARD]);

    await fillRequired();
    await pickCard("Visa •••• 1234");
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    expect(
      await screen.findByText("No se encontró la tarjeta."),
    ).toBeInTheDocument();
  });
});

describe("the currency and the crypto currencies", () => {
  const CRYPTO_LABELS = CRYPTO_CURRENCY_OPTIONS.map(({ label }) => label);
  const currencyButton = () => screen.getByRole("button", { name: /Moneda$/ });

  it("lists the legal-tender currencies first and then the crypto ones, under 'Criptomonedas'", async () => {
    renderForm(null);

    fireEvent.keyDown(currencyButton(), { key: "ArrowDown" });

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(within(listbox).getByText("Criptomonedas")).toBeInTheDocument();
    expect(options[0]).toMatch(/^ARS - /);
    expect(options.slice(-CRYPTO_LABELS.length)).toEqual(CRYPTO_LABELS);
  });

  it("takes a crypto currency and the wallet account in it", async () => {
    renderForm(
      null,
      [],
      [
        ...ACCOUNTS,
        {
          id: "acc_usdc",
          currency: "USDC",
          label: "Mercado Pago · USDC",
          archived: false,
        },
      ],
    );

    fireEvent.keyDown(currencyButton(), { key: "ArrowDown" });

    const option = await screen.findByRole("option", {
      name: "USDC - USD Coin",
    });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });

    expect(currencyButton()).toHaveTextContent("USDC - USD Coin");
    expect(screen.getByRole("button", { name: /Cuenta$/ })).toHaveTextContent(
      "Mercado Pago · USDC",
    );
  });
});
