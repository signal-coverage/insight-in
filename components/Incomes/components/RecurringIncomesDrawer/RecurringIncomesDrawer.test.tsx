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

const actions = vi.hoisted(() => ({ deleteRecurringIncomeAction: vi.fn() }));

vi.mock("@/core/incomes/actions", () => actions);

import type { RecurringRow } from "../../types";
import { RecurringIncomesDrawer } from "./RecurringIncomesDrawer";

const ROWS: RecurringRow[] = [
  {
    id: "rec_1",
    description: "Monthly salary",
    amount: 250000,
    currency: "USD",
    categoryId: "c1",
    categoryName: "Salary",
    notes: null,
    medium: "DIGITAL",
    frequency: "MONTHLY",
    startDate: "2026-01-05",
    endDate: null,
    amountLabel: "$2,500.00",
    amountDecimal: "2500.00",
    frequencyLabel: "Mensual",
    nextLabel: "Próximo: 5 oct 2026",
    endLabel: null,
  },
  {
    id: "rec_2",
    description: "Rent share",
    amount: 50000,
    currency: "ARS",
    categoryId: "c2",
    categoryName: "Other",
    notes: null,
    medium: "DIGITAL",
    frequency: "WEEKLY",
    startDate: "2026-01-01",
    endDate: "2026-06-01",
    amountLabel: "ARS 500.00",
    amountDecimal: "500.00",
    frequencyLabel: "Semanal",
    nextLabel: "Serie finalizada",
    endLabel: "Termina el 1 jun 2026",
  },
];

const renderDrawer = (recurring: RecurringRow[] = ROWS) => {
  const onAdd = vi.fn();
  const onEdit = vi.fn();

  render(
    <RecurringIncomesDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={() => {}}
      recurring={recurring}
      onAdd={onAdd}
      onEdit={onEdit}
    />,
  );

  return { onAdd, onEdit };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("recurring list", () => {
  it("describes each template", () => {
    renderDrawer();

    const [salary, rent] = screen.getAllByRole("listitem");

    expect(salary).toHaveTextContent("Monthly salary");
    expect(salary).toHaveTextContent("$2,500.00");
    expect(salary).toHaveTextContent("Mensual");
    expect(salary).toHaveTextContent("Salary");
    expect(salary).toHaveTextContent("Próximo: 5 oct 2026");
    expect(rent).toHaveTextContent("Semanal");
    expect(rent).toHaveTextContent("Termina el 1 jun 2026");
    expect(rent).toHaveTextContent("Serie finalizada");
  });

  it("shows an empty message when there are no templates", () => {
    renderDrawer([]);

    expect(
      screen.getByText("Todavía no hay ingresos recurrentes"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("opens the form to add a template", () => {
    const { onAdd } = renderDrawer();

    fireEvent.click(
      screen.getByRole("button", { name: "Agregar ingreso recurrente" }),
    );

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("opens the form to edit the chosen template", () => {
    const { onEdit } = renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: "Editar Rent share" }));

    expect(onEdit).toHaveBeenCalledWith(ROWS[1]);
  });
});

describe("delete", () => {
  it("explains that generated incomes are kept before deleting", async () => {
    actions.deleteRecurringIncomeAction.mockResolvedValue({
      status: "success",
    });
    renderDrawer();

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Monthly salary" }),
    );

    const dialog = await screen.findByRole("alertdialog");

    expect(dialog).toHaveTextContent("Monthly salary");
    expect(dialog).toHaveTextContent("ya generados");
    expect(actions.deleteRecurringIncomeAction).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

    await waitFor(() =>
      expect(actions.deleteRecurringIncomeAction).toHaveBeenCalledWith("rec_1"),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(1),
    );
  });

  it("does nothing when the confirmation is cancelled", async () => {
    renderDrawer();

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Monthly salary" }),
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Cancelar",
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(actions.deleteRecurringIncomeAction).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("keeps the row and shows the error inline when the delete fails", async () => {
    actions.deleteRecurringIncomeAction.mockResolvedValue({
      status: "error",
      message: "No se encontró el ingreso recurrente.",
    });
    renderDrawer();

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Monthly salary" }),
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Eliminar",
      }),
    );

    const message = await screen.findByText(
      "No se encontró el ingreso recurrente.",
    );

    expect(
      within(screen.getAllByRole("listitem")[0]).getByText(
        message.textContent!,
      ),
    ).toBe(message);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("template names", () => {
  it("show the whole description in a tooltip on keyboard focus, instead of a title", () => {
    renderDrawer();

    const name = screen.getByText("Monthly salary");

    expect(name).not.toHaveAttribute("title");
    expect(name).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => name.focus());

    expect(screen.getByRole("tooltip")).toHaveTextContent("Monthly salary");
  });
});
