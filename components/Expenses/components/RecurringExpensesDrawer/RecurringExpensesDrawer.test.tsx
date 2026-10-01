// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ applyRecurringDecisionsAction: vi.fn() }));

vi.mock("@/core/expenses/recurringActions", () => actions);

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
  dayOfMonth: 5,
  decision: null,
  amountLabel: "$ 350.000,50",
  amountDecimal: "350000.50",
  dayLabel: "Día 5",
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
): RecurringData => ({
  month: "2026-10",
  monthLabel: "Octubre de 2026",
  pending,
  decided,
  pendingCount: pending.length,
});

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
      screen.getByText("Decidí qué pasa con cada uno este mes."),
    ).toBeInTheDocument();
  });
});

describe("the pending rows", () => {
  it("has the Expense, Day, Amount and Decision columns", () => {
    renderDrawer();

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Gasto", "Día", "Monto", "Decisión"]);
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
        "Todavía no tenés gastos recurrentes. Creá un gasto y activá «Gasto recurrente».",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps Aplicar disabled", () => {
    renderDrawer(dataOf([]));

    expect(apply()).toBeDisabled();
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
    expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith([
      { recurringExpenseId: "rec_2", choice: "remove" },
    ]);
  });

  it("sends the template amount of an enabled row when it was not edited", async () => {
    actions.applyRecurringDecisionsAction.mockResolvedValue({
      status: "success",
    });
    renderDrawer();

    choose("Monthly rent", "Habilitar");
    fireEvent.click(apply());

    await waitFor(() =>
      expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith([
        { recurringExpenseId: "rec_1", choice: "enable", amount: "350000.50" },
      ]),
    );
  });

  it("sends the amount edited for this month with an enabled row", async () => {
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
      expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith([
        { recurringExpenseId: "rec_1", choice: "enable", amount: "400000" },
      ]),
    );
  });

  it("sends no amount for a row that is disabled", async () => {
    actions.applyRecurringDecisionsAction.mockResolvedValue({
      status: "success",
    });
    renderDrawer();

    fireEvent.change(screen.getByLabelText("Monto de Gym"), {
      target: { value: "10" },
    });
    choose("Gym", "Deshabilitar");
    fireEvent.click(apply());

    await waitFor(() =>
      expect(actions.applyRecurringDecisionsAction).toHaveBeenCalledWith([
        { recurringExpenseId: "rec_2", choice: "disable" },
      ]),
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
