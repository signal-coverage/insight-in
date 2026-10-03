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
  createIncomeAction: vi.fn(),
  updateIncomeAction: vi.fn(),
  createCategoryAction: vi.fn(),
}));

vi.mock("@/core/incomes/actions", () => actions);

import type { FormTarget, IncomeRow } from "../../types";
import { IncomeFormDrawer } from "./IncomeFormDrawer";

const CATEGORIES = [
  { id: "c1", name: "Salary" },
  { id: "c2", name: "Other" },
];

const INCOME: IncomeRow = {
  id: "inc_1",
  description: "Monthly salary",
  amount: 250000,
  currency: "USD",
  date: "2026-01-05",
  categoryId: "c1",
  categoryName: "Salary",
  notes: null,
  recurringIncomeId: null,
  installmentPlanId: null,
  installmentNumber: null,
  status: "SETTLED",
  medium: "DIGITAL",
  amountLabel: "$2,500.00",
  amountDecimal: "2500.00",
  dateLabel: "5 ene 2026",
  originCurrency: null,
  originAmount: null,
  originAmountDecimal: null,
  originLabel: null,
  originTooltip: null,
  reimbursesExpenseId: null,
  reimbursesExpenseDescription: null,
  reimbursementTooltip: null,
};

const renderForm = (income: IncomeRow | null) => {
  const onClose = vi.fn();
  const target: FormTarget = { key: 1, income, defaultDate: "2026-09-29" };

  render(
    <IncomeFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
      categories={CATEGORIES}
      reimbursables={[]}
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

// "Monto" of the income, not the "Monto de origen" of the section below it.
const netAmountInput = () => screen.getByLabelText(/^Monto(?! de origen)/);

const originToggle = () =>
  screen.getByRole("button", { name: /Viene de otra moneda/ });

const originAmountInput = () => screen.getByLabelText(/Monto de origen/);

const submittedForm = async (
  action: typeof actions.createIncomeAction,
  button: string,
): Promise<FormData> => {
  action.mockResolvedValue({ status: "success" });
  fireEvent.click(screen.getByRole("button", { name: button }));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

  const { calls } = action.mock;
  const formData = calls[0][calls[0].length - 1] as FormData;

  return formData;
};

const pickOriginCurrency = async (name: string | RegExp) => {
  fireEvent.keyDown(screen.getByRole("button", { name: /Moneda de origen/ }), {
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("has an Add income button with the same plus icon as every other add action", () => {
    renderForm(null);

    const button = screen.getByRole("button", { name: "Agregar ingreso" });

    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("shows 'Adding income…' with a spinner, and locks Cancel, while it saves", async () => {
    const save = deferred<{ status: "success" }>();

    actions.createIncomeAction.mockReturnValue(save.promise);
    renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Salary" },
    });
    fireEvent.change(netAmountInput(), {
      target: { value: "10" },
    });
    await pickCategory("Salary");
    fireEvent.click(screen.getByRole("button", { name: "Agregar ingreso" }));

    const pending = await screen.findByRole("button", {
      name: /Agregando ingreso/,
    });

    expect(pending).toHaveTextContent("Agregando ingreso…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(pending.querySelector("svg.size-4[aria-hidden]")).toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Agregando ingreso/ }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("edit mode", () => {
  it("has a plain Save changes button, without a plus", () => {
    renderForm(INCOME);

    const button = screen.getByRole("button", { name: "Guardar cambios" });

    expect(button.querySelector("svg")).toBeNull();
  });

  it("shows 'Saving…' with a spinner, and locks Cancel, while it saves", async () => {
    const save = deferred<{ status: "success" }>();

    actions.updateIncomeAction.mockReturnValue(save.promise);
    renderForm(INCOME);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const pending = await screen.findByRole("button", { name: /Guardando/ });

    expect(pending).toHaveTextContent("Guardando…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(actions.updateIncomeAction).toHaveBeenCalledTimes(1),
    );
  });
});

describe("medium field", () => {
  it("offers Digital and Efectivo, with Digital chosen for a new income", () => {
    renderForm(null);

    expect(screen.getByRole("radiogroup", { name: "Medio" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Digital" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Efectivo" })).not.toBeChecked();
  });

  it("keeps the stored medium of the income being edited", () => {
    renderForm({ ...INCOME, medium: "CASH" });

    expect(screen.getByRole("radio", { name: "Efectivo" })).toBeChecked();
  });

  it("sends the chosen medium with the rest of the form", async () => {
    actions.updateIncomeAction.mockResolvedValue({ status: "success" });
    renderForm(INCOME);

    fireEvent.click(screen.getByRole("radio", { name: "Efectivo" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(actions.updateIncomeAction).toHaveBeenCalledTimes(1),
    );

    const formData = actions.updateIncomeAction.mock.calls[0][1] as FormData;

    expect(formData.get("medium")).toBe("CASH");
  });

  it("sends digital when nothing was changed", async () => {
    actions.updateIncomeAction.mockResolvedValue({ status: "success" });
    renderForm(INCOME);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(actions.updateIncomeAction).toHaveBeenCalledTimes(1),
    );

    const formData = actions.updateIncomeAction.mock.calls[0][1] as FormData;

    expect(formData.get("medium")).toBe("DIGITAL");
  });
});

describe("status switch", () => {
  const settledSwitch = () =>
    screen.getByRole("switch", { name: "Ya cobrado" });

  it("starts on for a new income, since the money usually has already arrived", () => {
    renderForm(null);

    expect(settledSwitch()).toBeChecked();
  });

  it("follows the status of the income being edited", () => {
    renderForm({ ...INCOME, status: "PLANNED" });

    expect(settledSwitch()).not.toBeChecked();
  });

  it("sends the chosen status with the rest of the form", async () => {
    actions.updateIncomeAction.mockResolvedValue({ status: "success" });
    renderForm(INCOME);

    fireEvent.click(settledSwitch());
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(actions.updateIncomeAction).toHaveBeenCalledTimes(1),
    );

    const formData = actions.updateIncomeAction.mock.calls[0][1] as FormData;

    expect(formData.get("status")).toBe("PLANNED");
  });
});

const FROM_USDC: IncomeRow = {
  ...INCOME,
  currency: "ARS",
  amount: 1200000,
  amountDecimal: "12000.00",
  originCurrency: "USDC",
  originAmount: 10000000,
  originAmountDecimal: "10.00",
  originLabel: "Viene de 10 USDC",
  originTooltip: "Viene de 10,00 USDC · cotización 1.200,00",
};

describe("origin section", () => {
  it("is collapsed by default, so an ordinary income never sees it", () => {
    renderForm(null);

    expect(originToggle()).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("textbox", { name: /Monto de origen/ }),
    ).not.toBeInTheDocument();
  });

  it("opens and closes from its heading", () => {
    renderForm(null);

    fireEvent.click(originToggle());

    expect(originToggle()).toHaveAttribute("aria-expanded", "true");
    expect(originAmountInput()).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Moneda de origen/ }),
    ).toBeVisible();

    fireEvent.click(originToggle());

    expect(originToggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("stays collapsed when editing an income that has no origin", () => {
    renderForm(INCOME);

    expect(originToggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens with the stored origin when editing an income that has one", () => {
    renderForm(FROM_USDC);

    expect(originToggle()).toHaveAttribute("aria-expanded", "true");
    expect(originAmountInput()).toHaveValue("10.00");
    expect(
      screen.getByRole("button", { name: /Moneda de origen/ }),
    ).toHaveTextContent("USDC - USD Coin");
  });

  it("offers the crypto assets first under 'Cripto', then the currencies but the net one under 'Monedas'", async () => {
    renderForm(null);

    fireEvent.click(originToggle());
    fireEvent.keyDown(
      screen.getByRole("button", { name: /Moneda de origen/ }),
      { key: "ArrowDown" },
    );

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(within(listbox).getByText("Cripto")).toBeInTheDocument();
    expect(within(listbox).getByText("Monedas")).toBeInTheDocument();
    expect(options.slice(0, 3)).toEqual([
      "USDC - USD Coin",
      "USDT - Tether",
      "DAI - Dai",
    ]);
    expect(options[3]).toMatch(/^USD - /);
    // The income is in ARS by default: an origin in the same currency would say nothing.
    expect(options.some((option) => option.startsWith("ARS - "))).toBe(false);
    expect(options.some((option) => option.startsWith("EUR - "))).toBe(true);
  });

  it("offers the net currency again when the income is not in it", async () => {
    renderForm({
      ...FROM_USDC,
      currency: "USD",
      originCurrency: null,
      originAmount: null,
      originAmountDecimal: null,
    });

    fireEvent.click(originToggle());
    fireEvent.keyDown(
      screen.getByRole("button", { name: /Moneda de origen/ }),
      { key: "ArrowDown" },
    );

    const options = (await screen.findAllByRole("option")).map(
      (option) => option.textContent ?? "",
    );

    expect(options.some((option) => option.startsWith("ARS - "))).toBe(true);
    expect(options.some((option) => option.startsWith("USD - "))).toBe(false);
  });

  it("drops an origin that becomes the net currency, so it is never sent", async () => {
    renderForm({ ...FROM_USDC, currency: "ARS", originCurrency: "USD" });

    fireEvent.keyDown(
      screen.getByRole("button", { name: /Moneda(?! de origen)/ }),
      { key: "ArrowDown" },
    );

    const option = await screen.findByRole("option", { name: /^USD - / });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });

    expect(
      screen.getByRole("button", { name: /Moneda de origen/ }),
    ).not.toHaveTextContent("USD");

    const formData = await submittedForm(
      actions.updateIncomeAction,
      "Guardar cambios",
    );

    expect(formData.get("currency")).toBe("USD");
    expect(formData.get("originCurrency") ?? "").toBe("");
  });

  it("shows the implied rate once both amounts are valid", async () => {
    renderForm(null);

    fireEvent.change(netAmountInput(), { target: { value: "12000" } });
    fireEvent.click(originToggle());

    expect(screen.queryByText(/Cotización implícita/)).not.toBeInTheDocument();

    await pickOriginCurrency("USDC - USD Coin");

    expect(screen.queryByText(/Cotización implícita/)).not.toBeInTheDocument();

    fireEvent.change(originAmountInput(), { target: { value: "10" } });

    expect(screen.getByText(/Cotización implícita/).textContent).toMatch(
      /^Cotización implícita: 1 USDC = \$\s1\.200,00$/,
    );
  });

  it("follows the net amount and shows 4 decimals when the rate is under 1", async () => {
    renderForm(null);

    fireEvent.change(netAmountInput(), { target: { value: "1" } });
    fireEvent.click(originToggle());
    await pickOriginCurrency("USDC - USD Coin");
    fireEvent.change(originAmountInput(), { target: { value: "1000" } });

    expect(screen.getByText(/Cotización implícita/).textContent).toMatch(
      /= \$\s0,0010$/,
    );

    fireEvent.change(netAmountInput(), { target: { value: "5000" } });

    expect(screen.getByText(/Cotización implícita/).textContent).toMatch(
      /= \$\s5,00$/,
    );
  });

  it("hides the rate while an amount is not valid", async () => {
    renderForm(null);

    fireEvent.change(netAmountInput(), { target: { value: "12000" } });
    fireEvent.click(originToggle());
    await pickOriginCurrency("USDC - USD Coin");
    fireEvent.change(originAmountInput(), { target: { value: "10" } });
    fireEvent.change(originAmountInput(), { target: { value: "1.1234567" } });

    expect(screen.queryByText(/Cotización implícita/)).not.toBeInTheDocument();
  });

  it("sends no origin when the section was never touched", async () => {
    renderForm(INCOME);

    const formData = await submittedForm(
      actions.updateIncomeAction,
      "Guardar cambios",
    );

    expect(formData.get("originCurrency") ?? "").toBe("");
    expect(formData.get("originAmount") ?? "").toBe("");
  });

  it("sends the origin with the rest of the form", async () => {
    renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Sueldo" },
    });
    fireEvent.change(netAmountInput(), { target: { value: "12000" } });
    await pickCategory("Salary");
    fireEvent.click(originToggle());
    await pickOriginCurrency("USDC - USD Coin");
    fireEvent.change(originAmountInput(), { target: { value: "10.5" } });

    const formData = await submittedForm(
      actions.createIncomeAction,
      "Agregar ingreso",
    );

    expect(formData.get("amount")).toBe("12000");
    expect(formData.get("currency")).toBe("ARS");
    expect(formData.get("originCurrency")).toBe("USDC");
    expect(formData.get("originAmount")).toBe("10.5");
  });

  it("keeps what was typed when the section is closed, and still sends it", async () => {
    renderForm(FROM_USDC);

    fireEvent.change(originAmountInput(), { target: { value: "20" } });
    fireEvent.click(originToggle());

    expect(originToggle()).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(originToggle());

    expect(originAmountInput()).toHaveValue("20");

    fireEvent.click(originToggle());

    const formData = await submittedForm(
      actions.updateIncomeAction,
      "Guardar cambios",
    );

    expect(formData.get("originCurrency")).toBe("USDC");
    expect(formData.get("originAmount")).toBe("20");
  });

  it("clears the origin with 'Quitar origen', and sends nothing", async () => {
    renderForm(FROM_USDC);

    fireEvent.click(screen.getByRole("button", { name: "Quitar origen" }));

    expect(originAmountInput()).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /Moneda de origen/ }),
    ).not.toHaveTextContent("USDC");
    expect(screen.queryByText(/Cotización implícita/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Quitar origen" }),
    ).not.toBeInTheDocument();

    const formData = await submittedForm(
      actions.updateIncomeAction,
      "Guardar cambios",
    );

    expect(formData.get("originCurrency") ?? "").toBe("");
    expect(formData.get("originAmount") ?? "").toBe("");
  });

  it("offers 'Quitar origen' only while there is something to clear", () => {
    renderForm(null);

    fireEvent.click(originToggle());

    expect(
      screen.queryByRole("button", { name: "Quitar origen" }),
    ).not.toBeInTheDocument();

    fireEvent.change(originAmountInput(), { target: { value: "5" } });

    expect(
      screen.getByRole("button", { name: "Quitar origen" }),
    ).toBeInTheDocument();
  });

  it("opens by itself and shows the server's message when the origin is rejected", async () => {
    actions.createIncomeAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { originCurrency: ["Elegí la moneda de origen."] },
    });
    renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Sueldo" },
    });
    fireEvent.change(netAmountInput(), { target: { value: "10" } });
    await pickCategory("Salary");
    fireEvent.click(originToggle());
    fireEvent.change(originAmountInput(), { target: { value: "5" } });
    fireEvent.click(originToggle());
    fireEvent.click(screen.getByRole("button", { name: "Agregar ingreso" }));

    expect(await screen.findByText("Elegí la moneda de origen.")).toBeVisible();
    expect(originToggle()).toHaveAttribute("aria-expanded", "true");
  });
});
