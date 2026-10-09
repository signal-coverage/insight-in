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
  applyRecurringDecisionsAction: vi.fn(),
  setRecurringDecisionAction: vi.fn(),
  removeRecurringExpenseAction: vi.fn(),
  updateRecurringExpenseAction: vi.fn(),
}));

vi.mock("@/core/expenses/recurringActions", () => actions);
vi.mock("@/core/expenses/actions", () => ({ createCategoryAction: vi.fn() }));

import type { AccountChoice } from "@/core/accounts/types";

import type { RecurringData, RecurringRow } from "../../types";
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

const CATEGORIES = [
  { id: "c1", name: "Alquiler" },
  { id: "c2", name: "Servicios" },
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

const dataOf = (
  pending: RecurringRow[],
  decided: RecurringRow[] = [],
): RecurringData => ({
  month: "2026-10",
  monthLabel: "Octubre de 2026",
  pending,
  decided,
  pendingCount: pending.length,
  plans: [],
});

const renderDrawer = (data = dataOf([RENT], [INTERNET, CABLE])) => {
  const onClose = vi.fn();

  render(
    <RecurringExpensesDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      sessionKey={1}
      data={data}
      categories={CATEGORIES}
      accounts={ACCOUNTS}
    />,
  );

  return { onClose };
};

const rowOf = (description: string): HTMLElement =>
  screen.getByText(description).closest("tr") as HTMLElement;

// A row's error is shown in a full-width row right under it, so it is read from the next row.
const alertsUnder = (description: string): HTMLElement[] => {
  const next = rowOf(description).nextElementSibling as HTMLElement | null;

  return next ? within(next).queryAllByRole("alert") : [];
};

const buttonIn = (description: string, name: string | RegExp) =>
  within(rowOf(description)).getByRole("button", { name });

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
};

const REFUSAL =
  "El gasto de este mes de «Internet» ya está pagado y suma en tu presupuesto. Para sacar ese dinero del presupuesto, eliminalo desde la tabla de Gastos y después deshabilitá el recurrente.";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("the actions of every row", () => {
  it("give a pending row an edit and a remove button", () => {
    renderDrawer();

    expect(buttonIn("Monthly rent", "Editar Monthly rent")).toBeEnabled();
    expect(buttonIn("Monthly rent", "Quitar Monthly rent")).toBeEnabled();
  });

  it("give a decided row an edit and a remove button too", () => {
    renderDrawer();

    expect(buttonIn("Internet", "Editar Internet")).toBeEnabled();
    expect(buttonIn("Internet", "Quitar Internet")).toBeEnabled();
    expect(buttonIn("Cable", "Editar Cable")).toBeEnabled();
    expect(buttonIn("Cable", "Quitar Cable")).toBeEnabled();
  });

  it("are the first column of the row, the edit button before the remove button", () => {
    renderDrawer();

    const [first] = within(rowOf("Monthly rent")).getAllByRole("gridcell");
    const labels = within(first)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));

    expect(labels).toEqual(["Editar Monthly rent", "Quitar Monthly rent"]);
  });

  it("offer Deshabilitar on an enabled row and Habilitar on a disabled one", () => {
    renderDrawer();

    expect(buttonIn("Internet", /^Deshabilitar/)).toBeInTheDocument();
    expect(
      within(rowOf("Internet")).queryByRole("button", { name: /^Habilitar/ }),
    ).toBeNull();
    expect(buttonIn("Cable", /^Habilitar/)).toBeInTheDocument();
    expect(
      within(rowOf("Cable")).queryByRole("button", { name: /^Deshabilitar/ }),
    ).toBeNull();
  });

  it("offer no Habilitar or Deshabilitar button on a pending row: it has its radios", () => {
    renderDrawer();

    expect(
      within(rowOf("Monthly rent")).queryByRole("button", {
        name: /Habilitar/,
      }),
    ).toBeNull();
    expect(within(rowOf("Monthly rent")).getAllByRole("radio")).toHaveLength(3);
  });

  it("are locked while the wizard's Aplicar is working", async () => {
    const save = deferred<{ status: "success" }>();

    actions.applyRecurringDecisionsAction.mockReturnValue(save.promise);
    renderDrawer();

    fireEvent.click(
      within(rowOf("Monthly rent")).getByRole("radio", { name: "Quitar" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    await screen.findByRole("button", { name: /Aplicando/ });
    expect(buttonIn("Monthly rent", "Editar Monthly rent")).toBeDisabled();
    expect(buttonIn("Internet", /^Deshabilitar/)).toBeDisabled();

    save.resolve({ status: "success" });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Aplicando/ }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("editing a template", () => {
  it("opens the form prefilled with the template", async () => {
    renderDrawer();

    fireEvent.click(buttonIn("Monthly rent", "Editar Monthly rent"));

    expect(
      await screen.findByRole("heading", { name: "Editar gasto recurrente" }),
    ).toBeInTheDocument();
    // The wizard's own amount inputs are behind it, so look inside the form only.
    const form = within(document.querySelector("form") as HTMLElement);

    expect(form.getByLabelText(/Descripción/)).toHaveValue("Monthly rent");
    expect(form.getByLabelText(/Monto/)).toHaveValue("350000.50");
    expect(form.getByLabelText(/Día del mes/)).toHaveValue("5");
    expect(form.getByRole("button", { name: /Cuenta$/ })).toHaveTextContent(
      "Banco Galicia · Caja de ahorro",
    );
  });

  it("works from a decided row as well, with that row's template", async () => {
    renderDrawer();

    fireEvent.click(buttonIn("Cable", "Editar Cable"));

    await screen.findByRole("heading", { name: "Editar gasto recurrente" });
    expect(screen.getByLabelText(/Descripción/)).toHaveValue("Cable");
  });

  it("saves through the update action and closes only the form, leaving the wizard open", async () => {
    actions.updateRecurringExpenseAction.mockResolvedValue({
      status: "success",
    });
    const { onClose } = renderDrawer();

    fireEvent.click(buttonIn("Monthly rent", "Editar Monthly rent"));
    await screen.findByRole("heading", { name: "Editar gasto recurrente" });
    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Rent v2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Editar gasto recurrente" }),
      ).not.toBeInTheDocument(),
    );

    const [id, formData] = actions.updateRecurringExpenseAction.mock
      .calls[0] as [string, FormData];

    expect(id).toBe("rec_1");
    expect(formData.get("description")).toBe("Rent v2");
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", {
        name: "Gastos recurrentes de Octubre de 2026",
      }),
    ).toBeInTheDocument();
    expect(actions.applyRecurringDecisionsAction).not.toHaveBeenCalled();
  });
});

describe("enabling a month that was disabled", () => {
  it("enables at once, with no confirmation", async () => {
    actions.setRecurringDecisionAction.mockResolvedValue({ status: "success" });
    renderDrawer();

    fireEvent.click(buttonIn("Cable", /^Habilitar/));

    await waitFor(() =>
      expect(actions.setRecurringDecisionAction).toHaveBeenCalledWith(
        "rec_4",
        "ENABLED",
      ),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows 'Habilitando…' with a spinner while it works", async () => {
    const save = deferred<{ status: "success" }>();

    actions.setRecurringDecisionAction.mockReturnValue(save.promise);
    renderDrawer();

    fireEvent.click(buttonIn("Cable", /^Habilitar/));

    const pending = await screen.findByRole("button", { name: /Habilitando/ });

    expect(pending).toHaveTextContent("Habilitando…");
    expect(pending.querySelector(".spinner")).not.toBeNull();

    save.resolve({ status: "success" });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Habilitando/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows the server's message under the row when it fails, and clears it on the next try", async () => {
    actions.setRecurringDecisionAction.mockResolvedValueOnce({
      status: "error",
      message: "No se encontró el gasto recurrente.",
    });
    renderDrawer();

    fireEvent.click(buttonIn("Cable", /^Habilitar/));

    await waitFor(() => expect(alertsUnder("Cable")).toHaveLength(1));
    expect(alertsUnder("Cable")[0]).toHaveTextContent(
      "No se encontró el gasto recurrente.",
    );

    // The button is back once the attempt has finished.
    await waitFor(() => expect(buttonIn("Cable", /^Habilitar/)).toBeEnabled());
    actions.setRecurringDecisionAction.mockResolvedValueOnce({
      status: "success",
    });
    fireEvent.click(buttonIn("Cable", /^Habilitar/));

    await waitFor(() => expect(alertsUnder("Cable")).toHaveLength(0));
  });
});

describe("disabling an enabled month", () => {
  const openDialog = async () => {
    fireEvent.click(buttonIn("Internet", /^Deshabilitar/));

    return screen.findByRole("alertdialog");
  };

  it("asks for confirmation first, saying the pending expense will be deleted", async () => {
    renderDrawer();

    const dialog = await openDialog();

    expect(dialog).toHaveTextContent(
      "Se va a eliminar el gasto de este mes porque todavía está pendiente. ¿Deshabilitar «Internet» este mes?",
    );
    expect(actions.setRecurringDecisionAction).not.toHaveBeenCalled();
  });

  it("does nothing when the confirmation is cancelled", async () => {
    renderDrawer();

    const dialog = await openDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(actions.setRecurringDecisionAction).not.toHaveBeenCalled();
  });

  it("disables the month once confirmed, and closes the dialog", async () => {
    actions.setRecurringDecisionAction.mockResolvedValue({ status: "success" });
    renderDrawer();

    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Deshabilitar" }),
    );

    await waitFor(() =>
      expect(actions.setRecurringDecisionAction).toHaveBeenCalledWith(
        "rec_3",
        "DISABLED",
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("shows the refusal under the row, nothing else, when the expense is already paid", async () => {
    actions.setRecurringDecisionAction.mockResolvedValue({
      status: "error",
      message: REFUSAL,
    });
    renderDrawer();

    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Deshabilitar" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(alertsUnder("Internet")).toHaveLength(1);
    expect(alertsUnder("Internet")[0]).toHaveTextContent(REFUSAL);
    expect(alertsUnder("Cable")).toHaveLength(0);
    expect(alertsUnder("Monthly rent")).toHaveLength(0);
  });

  it("shows 'Deshabilitando…' while it works", async () => {
    const save = deferred<{ status: "success" }>();

    actions.setRecurringDecisionAction.mockReturnValue(save.promise);
    renderDrawer();

    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Deshabilitar" }),
    );

    const pending = await screen.findByRole("button", {
      name: /Deshabilitando/,
    });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });
});

describe("removing a template", () => {
  const openDialog = async (description: string) => {
    fireEvent.click(buttonIn(description, `Quitar ${description}`));

    return screen.findByRole("alertdialog");
  };

  it("asks for confirmation first, saying the expenses already created stay", async () => {
    renderDrawer();

    const dialog = await openDialog("Monthly rent");

    expect(dialog).toHaveTextContent(
      "¿Quitar «Monthly rent»? Deja de ser un gasto recurrente. Los gastos que ya creó se conservan.",
    );
    expect(actions.removeRecurringExpenseAction).not.toHaveBeenCalled();
  });

  it("does nothing when the confirmation is cancelled", async () => {
    renderDrawer();

    const dialog = await openDialog("Monthly rent");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(actions.removeRecurringExpenseAction).not.toHaveBeenCalled();
  });

  it.each([
    ["a pending row", "Monthly rent", "rec_1"],
    ["an enabled row", "Internet", "rec_3"],
    ["a disabled row", "Cable", "rec_4"],
  ])(
    "removes the template of %s once confirmed",
    async (_name, description, id) => {
      actions.removeRecurringExpenseAction.mockResolvedValue({
        status: "success",
      });
      renderDrawer();

      const dialog = await openDialog(description);

      fireEvent.click(within(dialog).getByRole("button", { name: "Quitar" }));

      await waitFor(() =>
        expect(actions.removeRecurringExpenseAction).toHaveBeenCalledWith(id),
      );
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
    },
  );

  it("shows the server's message under the row when it fails", async () => {
    actions.removeRecurringExpenseAction.mockResolvedValue({
      status: "error",
      message: "No se encontró el gasto recurrente.",
    });
    renderDrawer();

    const dialog = await openDialog("Cable");

    fireEvent.click(within(dialog).getByRole("button", { name: "Quitar" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(alertsUnder("Cable")).toHaveLength(1);
    expect(alertsUnder("Cable")[0]).toHaveTextContent(
      "No se encontró el gasto recurrente.",
    );
  });

  it("shows 'Quitando…' with a spinner, and locks Cancelar, while it works", async () => {
    const save = deferred<{ status: "success" }>();

    actions.removeRecurringExpenseAction.mockReturnValue(save.promise);
    renderDrawer();

    const dialog = await openDialog("Cable");

    fireEvent.click(within(dialog).getByRole("button", { name: "Quitar" }));

    const pending = await screen.findByRole("button", { name: /Quitando/ });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });
});

describe("the wizard for pending rows", () => {
  it("keeps applying radios with Aplicar, untouched by the row actions", async () => {
    actions.applyRecurringDecisionsAction.mockResolvedValue({
      status: "success",
    });
    const { onClose } = renderDrawer();

    fireEvent.click(
      within(rowOf("Monthly rent")).getByRole("radio", { name: "Habilitar" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith(
      [
        {
          recurringExpenseId: "rec_1",
          choice: "enable",
          amount: "350000.50",
        },
      ],
      [],
    );
    expect(actions.setRecurringDecisionAction).not.toHaveBeenCalled();
  });
});
