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
  applyIncomeInstallmentCountsAction: vi.fn(),
}));

vi.mock("@/core/installments/actions", () => actions);

import type { InstallmentPlanRow } from "@/components/Entries/types";

import type { RepaymentData } from "../../types";
import { RepaymentsDrawer } from "./RepaymentsDrawer";

const LOAN: InstallmentPlanRow = {
  id: "plan_1",
  description: "Préstamo a Juan",
  categoryName: "Préstamos",
  currency: "ARS",
  totalCuotas: 12,
  doneCount: 3,
  pendingCount: 9,
  nextAmount: 10000000,
  defaultCount: 1,
  nextAmountLabel: "$ 100.000,00",
  progressLabel: "3 de 12 · quedan 9",
};

const BIKE: InstallmentPlanRow = {
  id: "plan_2",
  description: "Bici de Ana",
  categoryName: "Familia",
  currency: "USD",
  totalCuotas: 6,
  doneCount: 5,
  pendingCount: 1,
  nextAmount: 12000,
  defaultCount: 0,
  nextAmountLabel: "US$ 120,00",
  progressLabel: "5 de 6 · queda 1",
};

const dataOf = (plans: InstallmentPlanRow[] = [LOAN, BIKE]): RepaymentData => ({
  month: "2026-10",
  monthLabel: "Octubre de 2026",
  plans,
});

const renderDrawer = (data: RepaymentData = dataOf()) => {
  const onClose = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <RepaymentsDrawer
      isOpen
      onOpenChange={onOpenChange}
      onClose={onClose}
      sessionKey={1}
      data={data}
    />,
  );

  return { onClose, onOpenChange };
};

const apply = () => screen.getByRole("button", { name: "Aplicar" });
const rowOf = (description: string) =>
  screen.getByRole("row", { name: new RegExp(description) });
const countOf = (description: string) =>
  screen.getByRole("textbox", { name: `Cuotas este mes de ${description}` });

// Types a number and commits it, as leaving the field does.
const typeCount = (description: string, value: string) => {
  fireEvent.change(countOf(description), { target: { value } });
  fireEvent.blur(countOf(description));
};

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

describe("the drawer", () => {
  it("is titled with the month and asks how many cuotas are collected", () => {
    renderDrawer();

    expect(
      screen.getByRole("heading", {
        name: "Devoluciones en cuotas de Octubre de 2026",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Elegí cuántas cuotas cobrás este mes."),
    ).toBeVisible();
  });

  it("has the Concept, Cuotas, Amount per cuota and Cuotas this month columns", () => {
    renderDrawer();

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Concepto", "Cuotas", "Monto por cuota", "Cuotas este mes"]);
    expect(
      screen.getByRole("grid", { name: "Devoluciones en cuotas" }),
    ).toBeVisible();
  });

  it("describes each loan with its category under it, its progress and the next amount", () => {
    renderDrawer();

    expect(rowOf("Préstamo a Juan")).toHaveTextContent("Préstamos");
    expect(rowOf("Préstamo a Juan")).toHaveTextContent("3 de 12 · quedan 9");
    expect(rowOf("Préstamo a Juan")).toHaveTextContent("$ 100.000,00");
    expect(rowOf("Bici de Ana")).toHaveTextContent("Familia");
    expect(rowOf("Bici de Ana")).toHaveTextContent("5 de 6 · queda 1");
    expect(rowOf("Bici de Ana")).toHaveTextContent("US$ 120,00");
  });

  it("prefills 'Cuotas este mes' with what already falls in the month", () => {
    renderDrawer();

    expect(countOf("Préstamo a Juan")).toHaveValue("1");
    expect(countOf("Bici de Ana")).toHaveValue("0");
  });

  it("bounds the stepper from 0 to the installments still to collect", () => {
    renderDrawer();

    const [loanDown, loanUp] = within(rowOf("Préstamo a Juan")).getAllByRole(
      "button",
    );
    const [bikeDown, bikeUp] = within(rowOf("Bici de Ana")).getAllByRole(
      "button",
    );

    // The bike has one installment left and none in the month: it can only go up.
    expect(bikeDown).toBeDisabled();
    expect(bikeUp).toBeEnabled();

    typeCount("Bici de Ana", "1");
    expect(bikeUp).toBeDisabled();

    // The loan has nine: it stops at nine, and at zero.
    typeCount("Préstamo a Juan", "9");
    expect(loanUp).toBeDisabled();
    expect(loanDown).toBeEnabled();

    typeCount("Préstamo a Juan", "0");
    expect(loanDown).toBeDisabled();
    expect(loanUp).toBeEnabled();
  });

  it("clamps a typed count that goes beyond the bounds", () => {
    renderDrawer();

    typeCount("Préstamo a Juan", "40");
    expect(countOf("Préstamo a Juan")).toHaveValue("9");
  });

  it("changes with the buttons, one at a time", () => {
    renderDrawer();

    const [decrement, increment] = within(
      rowOf("Préstamo a Juan"),
    ).getAllByRole("button");

    fireEvent.click(increment);
    expect(countOf("Préstamo a Juan")).toHaveValue("2");

    fireEvent.click(decrement);
    fireEvent.click(decrement);
    expect(countOf("Préstamo a Juan")).toHaveValue("0");
  });
});

describe("Aplicar", () => {
  it("stays disabled while every count is the default", () => {
    renderDrawer();

    expect(apply()).toBeDisabled();
  });

  it("enables when a count differs from its default", () => {
    renderDrawer();

    typeCount("Préstamo a Juan", "2");

    expect(apply()).toBeEnabled();
  });

  it("disables again when the count goes back to the default", () => {
    renderDrawer();

    typeCount("Préstamo a Juan", "2");
    typeCount("Préstamo a Juan", "1");

    expect(apply()).toBeDisabled();
  });

  it("sends only the loans whose count changed and closes", async () => {
    actions.applyIncomeInstallmentCountsAction.mockResolvedValue({
      status: "success",
    });
    const { onClose } = renderDrawer();

    typeCount("Préstamo a Juan", "3");
    fireEvent.click(apply());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.applyIncomeInstallmentCountsAction).toHaveBeenCalledTimes(1);
    expect(actions.applyIncomeInstallmentCountsAction).toHaveBeenCalledWith([
      { planId: "plan_1", count: 3 },
    ]);
  });

  it("sends every changed loan, in the order of the list", async () => {
    actions.applyIncomeInstallmentCountsAction.mockResolvedValue({
      status: "success",
    });
    renderDrawer();

    typeCount("Bici de Ana", "1");
    typeCount("Préstamo a Juan", "0");
    fireEvent.click(apply());

    await waitFor(() =>
      expect(actions.applyIncomeInstallmentCountsAction).toHaveBeenCalledWith([
        { planId: "plan_1", count: 0 },
        { planId: "plan_2", count: 1 },
      ]),
    );
  });

  it("shows 'Aplicando…' with a spinner and locks everything while it applies", async () => {
    const save = deferred<{ status: "success" }>();

    actions.applyIncomeInstallmentCountsAction.mockReturnValue(save.promise);
    renderDrawer();

    typeCount("Préstamo a Juan", "2");
    fireEvent.click(apply());

    const pending = await screen.findByRole("button", { name: /Aplicando/ });

    expect(pending).toHaveTextContent("Aplicando…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(countOf("Préstamo a Juan")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Aplicando/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows the server's message and stays open when a count is refused", async () => {
    actions.applyIncomeInstallmentCountsAction.mockResolvedValue({
      status: "error",
      message:
        "«Préstamo a Juan» no tiene tantas cuotas pendientes. Revisá la cantidad.",
    });
    const { onClose } = renderDrawer();

    typeCount("Préstamo a Juan", "2");
    fireEvent.click(apply());

    expect(
      await screen.findByText(
        "«Préstamo a Juan» no tiene tantas cuotas pendientes. Revisá la cantidad.",
      ),
    ).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(apply()).toBeEnabled());
  });

  it("closes without applying anything from Cancelar", () => {
    const { onOpenChange } = renderDrawer();

    typeCount("Préstamo a Juan", "2");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(actions.applyIncomeInstallmentCountsAction).not.toHaveBeenCalled();
  });
});

describe("with no loans repaid in installments", () => {
  it("says there are none and how to add one", () => {
    renderDrawer(dataOf([]));

    expect(
      screen.getByText(
        "Todavía no tenés devoluciones en cuotas. Cargá una desde Acciones.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("has nothing to apply", () => {
    renderDrawer(dataOf([]));

    expect(apply()).toBeDisabled();
  });
});
