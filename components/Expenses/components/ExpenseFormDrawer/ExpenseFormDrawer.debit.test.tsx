// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createExpenseAction: vi.fn(),
  updateExpenseAction: vi.fn(),
  createCategoryAction: vi.fn(),
}));

vi.mock("@/core/expenses/actions", () => actions);

import type { AccountChoice } from "@/core/accounts/types";

import { creditOption, debitOption } from "../../testCards";
import type { CardOption, ExpenseRow, FormTarget } from "../../types";
import { ExpenseFormDrawer } from "./ExpenseFormDrawer";

const CATEGORIES = [{ id: "c1", name: "Comida" }];

const ACCOUNTS: AccountChoice[] = [
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

const CREDIT: CardOption = creditOption();

// A debit card of Banco Galicia, which has an active account in ARS and one in USD.
const DEBIT: CardOption = debitOption({
  accounts: [
    { id: "acc_1", currency: "ARS", label: "Banco Galicia · Caja de ahorro" },
    {
      id: "acc_usd",
      currency: "USD",
      label: "Banco Galicia · Cuenta en dólares",
    },
  ],
});

const EXPENSE: ExpenseRow = {
  id: "exp_1",
  description: "Supermercado",
  amount: 500000,
  currency: "ARS",
  date: "2026-10-05",
  categoryId: "c1",
  categoryName: "Comida",
  notes: null,
  status: "SETTLED",
  accountId: "acc_old",
  accountLabel: "Banco Galicia · Caja vieja",
  isRecurring: false,
  installmentPlanId: null,
  installmentNumber: null,
  cardId: "card_9",
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
  amountLabel: "$ 5.000,00",
  amountDecimal: "5000.00",
  dateLabel: "5 oct 2026",
};

const renderForm = (
  expense: ExpenseRow | null,
  cards: readonly CardOption[] = [CREDIT, DEBIT],
  accounts: readonly AccountChoice[] = ACCOUNTS,
) => {
  const onClose = vi.fn();
  const target: FormTarget = { key: 1, expense, defaultDate: "2026-10-05" };

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

const cardButton = () => screen.getByRole("button", { name: /Tarjeta$/ });
const accountButton = () => screen.queryByRole("button", { name: /Cuenta$/ });

const pick = async (trigger: HTMLElement, name: string | RegExp) => {
  fireEvent.keyDown(trigger, { key: "ArrowDown" });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

const pickCurrency = (code: string) =>
  pick(
    screen.getByRole("button", { name: /Moneda$/ }),
    new RegExp(`^${code} - `),
  );

const fillRequired = async () => {
  fireEvent.change(screen.getByLabelText(/Descripción/), {
    target: { value: "Supermercado" },
  });
  fireEvent.change(screen.getByLabelText(/Monto/), {
    target: { value: "5000" },
  });
  await pick(screen.getByRole("button", { name: /Categoría/ }), "Comida");
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("a debit or prepaid card on an expense", () => {
  it("is offered in the currencies of its bank's active accounts, and a credit card in those of its caps", async () => {
    renderForm(null);

    fireEvent.keyDown(cardButton(), { key: "ArrowDown" });

    expect(
      (await screen.findAllByRole("option")).map(
        (option) => option.textContent,
      ),
    ).toEqual(["Sin tarjeta", "Visa •••• 1234", "Visa •••• 9999"]);
  });

  it("is the only card offered in a currency only its bank has", async () => {
    renderForm(null);

    await pickCurrency("USD");
    fireEvent.keyDown(cardButton(), { key: "ArrowDown" });

    expect(
      (await screen.findAllByRole("option")).map(
        (option) => option.textContent,
      ),
    ).toEqual(["Sin tarjeta", "Visa •••• 9999"]);
  });

  it("replaces the Cuenta selector with the account it takes the money from", async () => {
    renderForm(null);

    expect(accountButton()).toBeInTheDocument();

    await pick(cardButton(), "Visa •••• 9999");

    expect(
      screen.getByText("Se descuenta de Banco Galicia · Caja de ahorro"),
    ).toBeVisible();
    expect(accountButton()).not.toBeInTheDocument();
  });

  it("names the bank's account in the new currency when the currency changes", async () => {
    renderForm(null);

    await pick(cardButton(), "Visa •••• 9999");
    await pickCurrency("USD");

    expect(
      screen.getByText("Se descuenta de Banco Galicia · Cuenta en dólares"),
    ).toBeVisible();
  });

  it("is dropped when the currency changes to one its bank has no account in, and the Cuenta selector comes back", async () => {
    renderForm(null);

    await pick(cardButton(), "Visa •••• 9999");
    await pickCurrency("EUR");

    expect(cardButton()).toHaveTextContent("Sin tarjeta");
    expect(accountButton()).toBeInTheDocument();
  });

  it("keeps the date called 'Fecha', with no charge line: the money leaves that day", async () => {
    renderForm(null);

    await pick(cardButton(), "Visa •••• 9999");

    expect(screen.getByText("Fecha")).toBeInTheDocument();
    expect(screen.queryByText(/Se cobra el/)).not.toBeInTheDocument();
  });

  it("sends the card and no account: the server takes the bank's", async () => {
    actions.createExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    await fillRequired();
    await pick(cardButton(), "Visa •••• 9999");
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = actions.createExpenseAction.mock.calls[0][0] as FormData;

    expect(sent.get("cardId")).toBe("card_9");
    expect(sent.get("accountId")).toBeNull();
  });

  it("shows the refusal for funds under Monto and the Bancos refusal under Tarjeta, and stays open", async () => {
    actions.createExpenseAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        amount: [
          "La cuenta no tiene fondos suficientes para este gasto: tenía $ 300,00.",
        ],
        cardId: [
          "El banco de esta tarjeta no tiene una cuenta activa en ARS. Creá una en Bancos.",
        ],
      },
    });
    const { onClose } = renderForm(null);

    await fillRequired();
    await pick(cardButton(), "Visa •••• 9999");
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    expect(
      await screen.findByText(
        "La cuenta no tiene fondos suficientes para este gasto: tenía $ 300,00.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "El banco de esta tarjeta no tiene una cuenta activa en ARS. Creá una en Bancos.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps an edited expense's own card and the account its money left, even when the bank has no account in that currency now", () => {
    renderForm(EXPENSE, [CREDIT, debitOption({ accounts: [] })]);

    expect(cardButton()).toHaveTextContent("Visa •••• 9999");
    expect(
      screen.getByText("Se descuenta de Banco Galicia · Caja vieja"),
    ).toBeVisible();
  });
});

// Each case fills a form, saves it and then changes a select: slow under a loaded full run.
describe(
  "server field errors after a refused save",
  { timeout: 20_000 },
  () => {
    const FUNDS =
      "La cuenta no tiene fondos suficientes para este gasto: tenía $ 300,00.";
    const TWO_ARS_ACCOUNTS: AccountChoice[] = [
      ...ACCOUNTS,
      {
        id: "acc_2",
        currency: "ARS",
        label: "Banco Galicia · Caja chica",
        archived: false,
      },
    ];

    // Saves a form with a credit card (so the Cuenta selector is there) and gets the funds refusal
    // back under Monto.
    const refuseOnFunds = async (
      accounts: readonly AccountChoice[] = ACCOUNTS,
    ) => {
      actions.createExpenseAction.mockResolvedValue({
        status: "error",
        message: "Corrige los campos resaltados.",
        fieldErrors: { amount: [FUNDS] },
      });
      renderForm(null, [CREDIT, DEBIT], accounts);

      await fillRequired();
      await pick(cardButton(), "Visa •••• 9999");
      fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

      expect(await screen.findByText(FUNDS)).toBeInTheDocument();
    };

    it("keeps the refusal while the user edits something that cannot change the verdict", async () => {
      await refuseOnFunds();

      fireEvent.change(screen.getByLabelText(/Descripción/), {
        target: { value: "Otro nombre" },
      });

      expect(screen.getByText(FUNDS)).toBeInTheDocument();
    });

    it("clears it when the card is changed, so the form can be sent again", async () => {
      await refuseOnFunds();

      await pick(cardButton(), "Sin tarjeta");

      expect(screen.queryByText(FUNDS)).not.toBeInTheDocument();
    });

    it("clears it when the currency is changed", async () => {
      await refuseOnFunds();

      await pickCurrency("USD");

      expect(screen.queryByText(FUNDS)).not.toBeInTheDocument();
    });

    it("clears it when the status is changed", async () => {
      await refuseOnFunds();

      fireEvent.click(screen.getByRole("radio", { name: "Pendiente" }));

      expect(screen.queryByText(FUNDS)).not.toBeInTheDocument();
    });

    it("clears it when the date is changed", async () => {
      await refuseOnFunds();

      fireEvent.click(screen.getByRole("button", { name: /calendar/i }));

      const grid = await screen.findByRole("grid");
      const day = Array.from(grid.querySelectorAll('[role="button"]')).find(
        (cell) =>
          cell.textContent === "15" && !cell.hasAttribute("data-outside-month"),
      );

      expect(day).toBeDefined();
      fireEvent.click(day!);

      await waitFor(() =>
        expect(screen.queryByText(FUNDS)).not.toBeInTheDocument(),
      );
    });

    it("clears it when the account is changed", async () => {
      actions.createExpenseAction.mockResolvedValue({
        status: "error",
        message: "Corrige los campos resaltados.",
        fieldErrors: { amount: [FUNDS] },
      });
      renderForm(null, [CREDIT, DEBIT], TWO_ARS_ACCOUNTS);

      await fillRequired();
      await pick(screen.getByRole("button", { name: /Cuenta$/ }), /Caja chica/);
      fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

      expect(await screen.findByText(FUNDS)).toBeInTheDocument();

      await pick(
        screen.getByRole("button", { name: /Cuenta$/ }),
        /Caja de ahorro/,
      );

      expect(screen.queryByText(FUNDS)).not.toBeInTheDocument();
    });

    it("clears the Tarjeta and Cuenta refusals too, which are shown from the same state", async () => {
      actions.createExpenseAction.mockResolvedValue({
        status: "error",
        message: "Corrige los campos resaltados.",
        fieldErrors: {
          cardId: [
            "El banco de esta tarjeta no tiene una cuenta activa en ARS.",
          ],
        },
      });
      renderForm(null);

      await fillRequired();
      await pick(cardButton(), "Visa •••• 9999");
      fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

      expect(
        await screen.findByText(/no tiene una cuenta activa en ARS/),
      ).toBeInTheDocument();

      await pick(cardButton(), "Visa •••• 1234");

      expect(
        screen.queryByText(/no tiene una cuenta activa en ARS/),
      ).not.toBeInTheDocument();
    });
  },
);
