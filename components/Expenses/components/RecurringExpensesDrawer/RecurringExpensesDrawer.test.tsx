// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  applyRecurringDecisionsAction: vi.fn(),
  setRecurringDecisionAction: vi.fn(),
  removeRecurringExpenseAction: vi.fn(),
  updateRecurringExpenseAction: vi.fn(),
}));

vi.mock("@/core/expenses/recurringActions", () => actions);
vi.mock("@/core/expenses/actions", () => ({ createCategoryAction: vi.fn() }));

import type {
  InstallmentPlanRow,
  RecurringData,
  RecurringRow,
} from "../../types";
import { RecurringExpensesDrawer } from "./RecurringExpensesDrawer";

const row = (patch: Partial<RecurringRow>): RecurringRow => ({
  id: "rec_1",
  description: "Monthly rent",
  amount: 35000050,
  currency: "ARS",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  accountId: "acc_1",
  originCurrency: null,
  originAmount: null,
  dayOfMonth: 5,
  decision: null,
  amountLabel: "$ 350.000,50",
  amountDecimal: "350000.50",
  dayLabel: "Día 5",
  originAmountDecimal: null,
  referenceLabel: null,
  ...patch,
});

const RENT = row({});
const GYM = row({
  id: "rec_2",
  description: "Gym",
  amount: 4500,
  currency: "USD",
  categoryName: "Salud",
  dayOfMonth: 20,
  amountLabel: "US$ 45,00",
  amountDecimal: "45.00",
  dayLabel: "Día 20",
});
const INTERNET = row({
  id: "rec_3",
  description: "Internet",
  categoryName: "Servicios",
  decision: "ENABLED",
});
const CABLE = row({
  id: "rec_4",
  description: "Cable",
  categoryName: "Servicios",
  decision: "DISABLED",
});

const dataOf = (
  pending: RecurringRow[],
  decided: RecurringRow[] = [],
  plans: InstallmentPlanRow[] = [],
): RecurringData => ({
  month: "2026-10",
  monthLabel: "Octubre de 2026",
  pending,
  decided,
  pendingCount: pending.length,
  plans,
});

const FRIDGE: InstallmentPlanRow = {
  id: "plan_1",
  description: "Heladera",
  categoryName: "Hogar",
  currency: "ARS",
  totalCuotas: 12,
  doneCount: 3,
  pendingCount: 9,
  nextAmount: 10000000,
  defaultCount: 1,
  nextAmountLabel: "$ 100.000,00",
  progressLabel: "3 de 12 · quedan 9",
};
const PHONE: InstallmentPlanRow = {
  id: "plan_2",
  description: "Celular",
  categoryName: "Tecnología",
  currency: "USD",
  totalCuotas: 6,
  doneCount: 5,
  pendingCount: 1,
  nextAmount: 12000,
  defaultCount: 0,
  nextAmountLabel: "US$ 120,00",
  progressLabel: "5 de 6 · queda 1",
};

const CATEGORIES = [
  { id: "c1", name: "Alquiler" },
  { id: "c2", name: "Salud" },
];

const renderDrawer = (data = dataOf([RENT, GYM], [INTERNET, CABLE])) => {
  const onClose = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <RecurringExpensesDrawer
      isOpen
      onOpenChange={onOpenChange}
      onClose={onClose}
      sessionKey={1}
      data={data}
      categories={CATEGORIES}
      accounts={[]}
    />,
  );

  return { onClose, onOpenChange };
};

const rowOf = (description: string): HTMLElement =>
  screen.getByText(description).closest("tr") as HTMLElement;

const choose = (description: string, choice: string) =>
  fireEvent.click(
    within(rowOf(description)).getByRole("radio", { name: choice }),
  );

const apply = () => screen.getByRole("button", { name: /Aplicar|Aplicando/ });

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("the wizard's header", () => {
  it("is titled with the month being resolved and explains what to do", () => {
    renderDrawer();

    expect(
      screen.getByRole("heading", {
        name: "Gastos recurrentes de Octubre de 2026",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Decidí qué pasa con cada uno este mes. Si cambiás un monto, queda guardado para los próximos meses.",
      ),
    ).toBeInTheDocument();
  });
});

describe("the pending rows", () => {
  it("has the Actions, Expense, Day, Amount and Decision columns, Actions first", () => {
    renderDrawer();

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Acciones", "Gasto", "Día", "Monto", "Decisión"]);
  });

  it("describes each template with its category under it and its day", () => {
    renderDrawer();

    expect(rowOf("Monthly rent")).toHaveTextContent("Alquiler");
    expect(rowOf("Monthly rent")).toHaveTextContent("Día 5");
    expect(rowOf("Gym")).toHaveTextContent("Salud");
    expect(rowOf("Gym")).toHaveTextContent("Día 20");
  });

  it("prefills the amount of each template and shows its currency", () => {
    renderDrawer();

    expect(screen.getByLabelText("Monto de Monthly rent")).toHaveValue(
      "350000.50",
    );
    expect(rowOf("Monthly rent")).toHaveTextContent("ARS");
    expect(screen.getByLabelText("Monto de Gym")).toHaveValue("45.00");
    expect(rowOf("Gym")).toHaveTextContent("USD");
  });

  it("offers Habilitar, Deshabilitar and Quitar per row, with none selected", () => {
    renderDrawer();

    const radios = within(rowOf("Monthly rent")).getAllByRole("radio");

    expect(radios.map((radio) => radio.closest("label")?.textContent)).toEqual([
      "Habilitar",
      "Deshabilitar",
      "Quitar",
    ]);
    radios.forEach((radio) => expect(radio).not.toBeChecked());
  });

  it("keeps the amount editable whatever is chosen, except Quitar", () => {
    renderDrawer();

    const rent = screen.getByLabelText("Monto de Monthly rent");

    expect(rent).toBeEnabled();

    choose("Monthly rent", "Habilitar");
    expect(rent).toBeEnabled();

    choose("Monthly rent", "Deshabilitar");
    expect(rent).toBeEnabled();

    choose("Monthly rent", "Quitar");
    expect(rent).toBeDisabled();
    expect(screen.getByLabelText("Monto de Gym")).toBeEnabled();

    choose("Monthly rent", "Deshabilitar");
    expect(rent).toBeEnabled();
  });

  it("lets a choice be made independently on each row", () => {
    renderDrawer();

    choose("Monthly rent", "Habilitar");
    choose("Gym", "Quitar");

    expect(
      within(rowOf("Monthly rent")).getByRole("radio", { name: "Habilitar" }),
    ).toBeChecked();
    expect(
      within(rowOf("Gym")).getByRole("radio", { name: "Quitar" }),
    ).toBeChecked();
    expect(
      within(rowOf("Gym")).getByRole("radio", { name: "Habilitar" }),
    ).not.toBeChecked();
  });
});

describe("the rows already decided this month", () => {
  it("are listed after the pending ones, read-only, with a chip", () => {
    renderDrawer();

    const rows = screen.getAllByRole("row").slice(1);

    expect(rows.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Monthly rent"),
      expect.stringContaining("Gym"),
      expect.stringContaining("Internet"),
      expect.stringContaining("Cable"),
    ]);
    expect(rowOf("Internet")).toHaveTextContent("Habilitado");
    expect(rowOf("Cable")).toHaveTextContent("Deshabilitado");
  });

  it("have no radios and no amount input", () => {
    renderDrawer();

    expect(within(rowOf("Internet")).queryByRole("radio")).toBeNull();
    expect(within(rowOf("Internet")).queryByRole("textbox")).toBeNull();
    expect(within(rowOf("Cable")).queryByRole("radio")).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(6);
  });

  it("show their amount as text", () => {
    renderDrawer();

    expect(rowOf("Internet")).toHaveTextContent("$ 350.000,50");
  });
});

describe("with no templates", () => {
  it("invites the user to create a recurring expense", () => {
    renderDrawer(dataOf([]));

    expect(
      screen.getByText(
        "Todavía no tenés gastos recurrentes. Creá un gasto y activá «Gasto recurrente», o cargá una compra en cuotas.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("keeps Aplicar disabled", () => {
    renderDrawer(dataOf([]));

    expect(apply()).toBeDisabled();
  });
});

// A subscription quoted in 20 USD that really costs 35.000 ARS.
const NETFLIX = row({
  id: "rec_5",
  description: "Netflix",
  categoryName: "Servicios",
  amount: 3500000,
  amountLabel: "$ 35.000,00",
  amountDecimal: "35000.00",
  originCurrency: "USD",
  originAmount: 2000,
  originAmountDecimal: "20.00",
  referenceLabel: "Referencia: US$ 20,00",
});

describe("a template with a reference price", () => {
  it("shows the reference and the implied rate under the amount of its pending row", () => {
    renderDrawer(dataOf([NETFLIX]));

    const cells = within(rowOf("Netflix"));

    expect(cells.getByText("Referencia: US$ 20,00")).toBeVisible();
    expect(cells.getByText(/^1 USD = /).textContent).toMatch(
      /^1 USD = \$\s1\.750,00$/,
    );
  });

  it("follows the amount the user types, which is what really leaves the money", () => {
    renderDrawer(dataOf([NETFLIX]));

    fireEvent.change(screen.getByLabelText("Monto de Netflix"), {
      target: { value: "40000" },
    });

    expect(screen.getByText(/^1 USD = /).textContent).toMatch(
      /= \$\s2\.000,00$/,
    );
  });

  it("applies only the amount typed: the reference price is never sent", async () => {
    actions.applyRecurringDecisionsAction.mockResolvedValue({
      status: "success",
    });
    renderDrawer(dataOf([NETFLIX]));

    fireEvent.change(screen.getByLabelText("Monto de Netflix"), {
      target: { value: "40000" },
    });
    choose("Netflix", "Habilitar");
    fireEvent.click(apply());

    await waitFor(() =>
      expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith(
        [{ recurringExpenseId: "rec_5", choice: "enable", amount: "40000" }],
        [],
      ),
    );
  });

  it("shows only the formatted amount once the row is decided", () => {
    renderDrawer(dataOf([], [{ ...NETFLIX, decision: "ENABLED" }]));

    const cells = within(rowOf("Netflix"));

    expect(cells.getByText("$ 35.000,00")).toBeVisible();
    expect(cells.queryByText(/Referencia/)).not.toBeInTheDocument();
  });

  it("says nothing extra for the other templates", () => {
    renderDrawer(dataOf([RENT, NETFLIX]));

    expect(within(rowOf("Monthly rent")).queryByText(/Referencia/)).toBeNull();
  });
});

describe("Aplicar", () => {
  it("is disabled until a pending row has a choice", () => {
    renderDrawer();

    expect(apply()).toBeDisabled();

    choose("Gym", "Deshabilitar");

    expect(apply()).toBeEnabled();
  });

  it("applies only the rows that got a choice and leaves the others pending", async () => {
    actions.applyRecurringDecisionsAction.mockResolvedValue({
      status: "success",
    });
    const { onClose } = renderDrawer();

    choose("Gym", "Quitar");
    fireEvent.click(apply());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledTimes(1);
    expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith(
      [{ recurringExpenseId: "rec_2", choice: "remove" }],
      [],
    );
  });

  it("sends the template amount of an enabled row when it was not edited", async () => {
    actions.applyRecurringDecisionsAction.mockResolvedValue({
      status: "success",
    });
    renderDrawer();

    choose("Monthly rent", "Habilitar");
    fireEvent.click(apply());

    await waitFor(() =>
      expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith(
        [
          {
            recurringExpenseId: "rec_1",
            choice: "enable",
            amount: "350000.50",
          },
        ],
        [],
      ),
    );
  });

  it("sends the amount edited with an enabled row", async () => {
    actions.applyRecurringDecisionsAction.mockResolvedValue({
      status: "success",
    });
    renderDrawer();

    fireEvent.change(screen.getByLabelText("Monto de Monthly rent"), {
      target: { value: "400000" },
    });
    choose("Monthly rent", "Habilitar");
    fireEvent.click(apply());

    await waitFor(() =>
      expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith(
        [{ recurringExpenseId: "rec_1", choice: "enable", amount: "400000" }],
        [],
      ),
    );
  });

  it("sends the amount edited with a disabled row, so it sticks to the template", async () => {
    actions.applyRecurringDecisionsAction.mockResolvedValue({
      status: "success",
    });
    renderDrawer();

    fireEvent.change(screen.getByLabelText("Monto de Gym"), {
      target: { value: "52.50" },
    });
    choose("Gym", "Deshabilitar");
    fireEvent.click(apply());

    await waitFor(() =>
      expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith(
        [{ recurringExpenseId: "rec_2", choice: "disable", amount: "52.50" }],
        [],
      ),
    );
  });

  it("sends the template amount of a disabled row that was not edited", async () => {
    actions.applyRecurringDecisionsAction.mockResolvedValue({
      status: "success",
    });
    renderDrawer();

    choose("Gym", "Deshabilitar");
    fireEvent.click(apply());

    await waitFor(() =>
      expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith(
        [{ recurringExpenseId: "rec_2", choice: "disable", amount: "45.00" }],
        [],
      ),
    );
  });

  it("sends no amount for a removed row, even one that was edited", async () => {
    actions.applyRecurringDecisionsAction.mockResolvedValue({
      status: "success",
    });
    renderDrawer();

    fireEvent.change(screen.getByLabelText("Monto de Gym"), {
      target: { value: "10" },
    });
    choose("Gym", "Quitar");
    fireEvent.click(apply());

    await waitFor(() =>
      expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith(
        [{ recurringExpenseId: "rec_2", choice: "remove" }],
        [],
      ),
    );
  });

  it("shows 'Aplicando…' with a spinner, and locks Cancelar, while it works", async () => {
    const save = deferred<{ status: "success" }>();

    actions.applyRecurringDecisionsAction.mockReturnValue(save.promise);
    renderDrawer();

    choose("Gym", "Deshabilitar");
    fireEvent.click(apply());

    const pending = await screen.findByRole("button", { name: /Aplicando/ });

    expect(pending).toHaveTextContent("Aplicando…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Aplicando/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows the server's message and stays open when it fails", async () => {
    actions.applyRecurringDecisionsAction.mockResolvedValue({
      status: "error",
      message: "Ingresá un monto válido para «Monthly rent».",
    });
    const { onClose } = renderDrawer();

    choose("Monthly rent", "Habilitar");
    fireEvent.click(apply());

    expect(
      await screen.findByText("Ingresá un monto válido para «Monthly rent»."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(apply()).toBeEnabled();
  });

  it("closes without applying anything from Cancelar", () => {
    const { onOpenChange } = renderDrawer();

    choose("Gym", "Quitar");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(actions.applyRecurringDecisionsAction).not.toHaveBeenCalled();
  });
});

describe("the purchases in installments", () => {
  const withPlans = (plans = [FRIDGE, PHONE]) =>
    dataOf([RENT, GYM], [INTERNET], plans);

  // The input of a plan's "Cuotas este mes" stepper.
  const countOf = (description: string) =>
    screen.getByRole("textbox", {
      name: `Cuotas este mes de ${description}`,
    });

  // Types a number and commits it, as leaving the field does.
  const typeCount = (description: string, value: string) => {
    fireEvent.change(countOf(description), { target: { value } });
    fireEvent.blur(countOf(description));
  };

  it("adds a section 'Compras en cuotas' after the recurring table", () => {
    renderDrawer(withPlans());

    expect(
      screen.getByRole("heading", { name: "Compras en cuotas" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("grid")).toHaveLength(2);
  });

  it("has the Purchase, Cuotas, Amount per cuota and Cuotas this month columns", () => {
    renderDrawer(withPlans());

    const [, installments] = screen.getAllByRole("grid");

    expect(
      within(installments)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Compra", "Cuotas", "Monto por cuota", "Cuotas este mes"]);
  });

  it("describes each purchase with its category under it, its progress and the next amount", () => {
    renderDrawer(withPlans());

    expect(rowOf("Heladera")).toHaveTextContent("Hogar");
    expect(rowOf("Heladera")).toHaveTextContent("3 de 12 · quedan 9");
    expect(rowOf("Heladera")).toHaveTextContent("$ 100.000,00");
    expect(rowOf("Celular")).toHaveTextContent("Tecnología");
    expect(rowOf("Celular")).toHaveTextContent("5 de 6 · queda 1");
    expect(rowOf("Celular")).toHaveTextContent("US$ 120,00");
  });

  it("prefills 'Cuotas este mes' with what already falls in the month", () => {
    renderDrawer(withPlans());

    expect(countOf("Heladera")).toHaveValue("1");
    expect(countOf("Celular")).toHaveValue("0");
  });

  it("bounds the stepper from 0 to the installments still to pay", () => {
    renderDrawer(withPlans());

    const [fridgeDown, fridgeUp] = within(rowOf("Heladera")).getAllByRole(
      "button",
    );
    const [phoneDown, phoneUp] = within(rowOf("Celular")).getAllByRole(
      "button",
    );

    // Celular has one pending installment and none in the month: it can only go up.
    expect(phoneDown).toBeDisabled();
    expect(phoneUp).toBeEnabled();

    typeCount("Celular", "1");
    expect(phoneUp).toBeDisabled();

    // Heladera has nine: it stops at nine, and at zero.
    typeCount("Heladera", "9");
    expect(fridgeUp).toBeDisabled();
    expect(fridgeDown).toBeEnabled();

    typeCount("Heladera", "0");
    expect(fridgeDown).toBeDisabled();
    expect(fridgeUp).toBeEnabled();
  });

  it("clamps a typed count that goes beyond the bounds", () => {
    renderDrawer(withPlans());

    typeCount("Heladera", "40");
    expect(countOf("Heladera")).toHaveValue("9");

    typeCount("Heladera", "0");
    expect(countOf("Heladera")).toHaveValue("0");
  });

  it("changes with the buttons, one at a time", () => {
    renderDrawer(withPlans());

    const [decrement, increment] = within(rowOf("Heladera")).getAllByRole(
      "button",
    );

    fireEvent.click(increment);
    expect(countOf("Heladera")).toHaveValue("2");

    fireEvent.click(decrement);
    fireEvent.click(decrement);
    expect(countOf("Heladera")).toHaveValue("0");
  });

  it("does not go below zero or above the pending installments with the buttons", () => {
    renderDrawer(withPlans());

    const [decrement, increment] = within(rowOf("Celular")).getAllByRole(
      "button",
    );

    fireEvent.click(increment);
    fireEvent.click(increment);
    expect(countOf("Celular")).toHaveValue("1");

    fireEvent.click(decrement);
    fireEvent.click(decrement);
    expect(countOf("Celular")).toHaveValue("0");
  });

  describe("Aplicar", () => {
    it("stays disabled while every count is the default", () => {
      renderDrawer(withPlans());

      expect(apply()).toBeDisabled();
    });

    it("enables when a count differs from its default", () => {
      renderDrawer(withPlans());

      typeCount("Heladera", "2");

      expect(apply()).toBeEnabled();
    });

    it("disables again when the count goes back to the default", () => {
      renderDrawer(withPlans());

      typeCount("Heladera", "2");
      typeCount("Heladera", "1");

      expect(apply()).toBeDisabled();
    });

    it("enables with a count alone, even when there are no recurring templates", () => {
      renderDrawer(dataOf([], [], [FRIDGE]));

      typeCount("Heladera", "0");

      expect(apply()).toBeEnabled();
    });

    it("sends only the plans whose count changed, in one call with the recurring choices", async () => {
      actions.applyRecurringDecisionsAction.mockResolvedValue({
        status: "success",
      });
      const { onClose } = renderDrawer(withPlans());

      choose("Gym", "Quitar");
      typeCount("Heladera", "3");
      fireEvent.click(apply());

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledTimes(1);
      expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith(
        [{ recurringExpenseId: "rec_2", choice: "remove" }],
        [{ planId: "plan_1", count: 3 }],
      );
    });

    it("sends the counts alone when no recurring choice was made", async () => {
      actions.applyRecurringDecisionsAction.mockResolvedValue({
        status: "success",
      });
      renderDrawer(withPlans());

      typeCount("Heladera", "0");
      typeCount("Celular", "1");
      fireEvent.click(apply());

      await waitFor(() =>
        expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith(
          [],
          [
            { planId: "plan_1", count: 0 },
            { planId: "plan_2", count: 1 },
          ],
        ),
      );
    });

    it("locks the steppers while it applies", async () => {
      const save = deferred<{ status: "success" }>();

      actions.applyRecurringDecisionsAction.mockReturnValue(save.promise);
      renderDrawer(withPlans());

      typeCount("Heladera", "2");
      fireEvent.click(apply());

      await screen.findByRole("button", { name: /Aplicando/ });
      expect(countOf("Heladera")).toBeDisabled();

      save.resolve({ status: "success" });
      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: /Aplicando/ }),
        ).not.toBeInTheDocument(),
      );
    });

    it("shows the server's message and stays open when a count is refused", async () => {
      actions.applyRecurringDecisionsAction.mockResolvedValue({
        status: "error",
        message: "«Heladera» no tiene tantas cuotas pendientes.",
      });
      const { onClose } = renderDrawer(withPlans());

      typeCount("Heladera", "2");
      fireEvent.click(apply());

      expect(
        await screen.findByText(
          "«Heladera» no tiene tantas cuotas pendientes.",
        ),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("the description", () => {
    it("mentions cuotas when there are purchases, keeping the original sentence", () => {
      renderDrawer(withPlans());

      expect(
        screen.getByText(/Si cambiás un monto, queda guardado/),
      ).toHaveTextContent(/cuotas/);
    });

    it("does not mention cuotas when there are none", () => {
      renderDrawer();

      expect(
        screen.getByText(/Si cambiás un monto, queda guardado/),
      ).not.toHaveTextContent(/cuotas/);
    });
  });

  describe("with only one of the two kinds", () => {
    it("shows no section for purchases when there are none", () => {
      renderDrawer();

      expect(
        screen.queryByRole("heading", { name: "Compras en cuotas" }),
      ).not.toBeInTheDocument();
      expect(screen.getAllByRole("grid")).toHaveLength(1);
    });

    it("shows just the purchases, with no empty message, when there are no templates", () => {
      renderDrawer(dataOf([], [], [FRIDGE]));

      expect(screen.getAllByRole("grid")).toHaveLength(1);
      expect(screen.getByText("Heladera")).toBeInTheDocument();
      expect(
        screen.queryByText(/Todavía no tenés gastos recurrentes/),
      ).not.toBeInTheDocument();
    });

    it("labels both sections when both are there", () => {
      renderDrawer(withPlans());

      expect(
        screen.getByRole("heading", { name: "Gastos recurrentes" }),
      ).toBeInTheDocument();
    });
  });
});

describe("the tables as HeroUI tables", () => {
  // A keyboard user tabs into a table first, then on to what is in its cells.
  const focusWithKeyboard = (element: HTMLElement) => {
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => (element.closest('[role="grid"]') as HTMLElement).focus());
    act(() => element.focus());
  };

  it("names each table after what it lists", () => {
    renderDrawer(dataOf([RENT, GYM], [INTERNET], [FRIDGE, PHONE]));

    expect(
      screen.getByRole("grid", { name: "Gastos recurrentes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("grid", { name: "Compras en cuotas" }),
    ).toBeInTheDocument();
  });

  it("shows the whole description of a template as a tooltip, instead of a title", () => {
    renderDrawer();

    const description = screen.getByText("Monthly rent");

    expect(description).not.toHaveAttribute("title");
    expect(description).toHaveAttribute("tabindex", "0");

    focusWithKeyboard(description);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Monthly rent");
  });

  it("shows the whole description of a purchase as a tooltip, instead of a title", () => {
    renderDrawer(dataOf([RENT, GYM], [INTERNET], [FRIDGE, PHONE]));

    const description = screen.getByText("Heladera");

    expect(description).not.toHaveAttribute("title");

    focusWithKeyboard(description);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Heladera");
  });
});
