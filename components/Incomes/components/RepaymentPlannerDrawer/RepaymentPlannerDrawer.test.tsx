// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const installments = vi.hoisted(() => ({
  createInstallmentPlanAction: vi.fn(),
}));
const incomes = vi.hoisted(() => ({ createCategoryAction: vi.fn() }));

vi.mock("@/core/installments/actions", () => installments);
vi.mock("@/core/incomes/actions", () => incomes);

import { RepaymentPlannerDrawer } from "./RepaymentPlannerDrawer";

const CATEGORIES = [
  { id: "c1", name: "Préstamos" },
  { id: "c2", name: "Sueldo" },
];

const renderPlanner = () => {
  const onClose = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <RepaymentPlannerDrawer
      isOpen
      onOpenChange={onOpenChange}
      onClose={onClose}
      sessionKey={1}
      defaultDate="2026-10-01"
      categories={CATEGORIES}
    />,
  );

  return { onClose, onOpenChange };
};

const pickCategory = async (name: string) => {
  fireEvent.keyDown(screen.getByRole("button", { name: /Categoría/ }), {
    key: "ArrowDown",
  });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

const conceptInput = () => screen.getByRole("textbox", { name: /Concepto/ });
const amountInput = () => screen.getByRole("textbox", { name: /^Monto\b/ });
const cuotasInput = () =>
  screen.getByRole("textbox", { name: /Cantidad de cuotas/ });
const continueButton = () => screen.getByRole("button", { name: "Continuar" });

const typeCuotas = (value: string) => {
  fireEvent.change(cuotasInput(), { target: { value } });
  fireEvent.blur(cuotasInput());
};

// A valid first step: a loan of 600.000 pesos repaid in 6 installments.
const fillRepayment = async ({
  amount = "600000",
  count = "6",
}: { amount?: string; count?: string } = {}) => {
  fireEvent.change(conceptInput(), { target: { value: "Préstamo a Juan" } });
  fireEvent.change(amountInput(), { target: { value: amount } });
  typeCuotas(count);
  await pickCategory("Préstamos");
};

const REVIEW_STEP = "Paso 2 de 2 · Revisá la devolución";
const SAVE_QUESTION = "¿Guardar la devolución y crear las 6 cuotas?";

const goToReview = async (options?: Parameters<typeof fillRepayment>[0]) => {
  await fillRepayment(options);
  fireEvent.click(continueButton());
  await screen.findByText(REVIEW_STEP);
};

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Guardar devolución" }));

const ticket = () =>
  screen.getByRole("region", { name: "Resumen de la devolución" });

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

describe("step 1: the data of the repayment", () => {
  it("is titled 'Devolución en cuotas' and says it is the first of two steps", () => {
    renderPlanner();

    expect(
      screen.getByRole("heading", { name: "Devolución en cuotas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Paso 1 de 2 · Datos de la devolución"),
    ).toBeVisible();
  });

  it("asks for the concept, category, amount, currency, medium, number of cuotas, first date and notes", () => {
    renderPlanner();

    expect(conceptInput()).toBeVisible();
    expect(screen.getByRole("button", { name: /Categoría/ })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Monto total" })).toBeVisible();
    expect(
      screen.getByRole("radio", { name: "Monto por cuota" }),
    ).toBeVisible();
    expect(amountInput()).toBeVisible();
    expect(screen.getByRole("button", { name: /Moneda/ })).toBeVisible();
    expect(screen.getByRole("radiogroup", { name: "Medio" })).toBeVisible();
    expect(cuotasInput()).toBeVisible();
    expect(screen.getByText("Fecha de la primera cuota")).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Notas/ })).toBeVisible();
  });

  it("never asks about cards: the money of a loan does not come through one", () => {
    renderPlanner();

    expect(
      screen.queryByRole("radiogroup", { name: "Tarjeta" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Propia" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Prestada" })).toBeNull();
    expect(screen.queryByText("Fecha de la compra")).toBeNull();
  });

  it("starts in pesos, digital, with the total amount and twelve cuotas", () => {
    renderPlanner();

    expect(screen.getByRole("button", { name: /Moneda/ })).toHaveTextContent(
      "ARS",
    );
    expect(screen.getByRole("radio", { name: "Digital" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Monto total" })).toBeChecked();
    expect(cuotasInput()).toHaveValue("12");
  });

  it("offers the user's income categories", async () => {
    renderPlanner();

    fireEvent.keyDown(screen.getByRole("button", { name: /Categoría/ }), {
      key: "ArrowDown",
    });

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent).slice(0, 2)).toEqual([
      "Préstamos",
      "Sueldo",
    ]);
  });

  it("creates a category with the income action", async () => {
    incomes.createCategoryAction.mockResolvedValue({
      status: "success",
      category: { id: "c9", name: "Familia" },
    });
    renderPlanner();

    fireEvent.keyDown(screen.getByRole("button", { name: /Categoría/ }), {
      key: "ArrowDown",
    });

    const add = await screen.findByRole("option", {
      name: /Agregar categoría/,
    });

    fireEvent.keyDown(add, { key: "Enter" });
    fireEvent.keyUp(add, { key: "Enter" });
    fireEvent.change(
      await screen.findByRole("textbox", {
        name: "Nombre de la nueva categoría",
      }),
      { target: { value: "Familia" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() =>
      expect(incomes.createCategoryAction).toHaveBeenCalledWith("Familia"),
    );
  });

  it("has Cancelar and a Continuar that waits until the repayment is valid", async () => {
    renderPlanner();

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    expect(continueButton()).toBeDisabled();

    fireEvent.change(conceptInput(), { target: { value: "Préstamo a Juan" } });
    fireEvent.change(amountInput(), { target: { value: "600000" } });
    expect(continueButton()).toBeDisabled();

    await pickCategory("Préstamos");
    expect(continueButton()).toBeEnabled();
  });

  it.each([
    ["an amount that is not a number", { amount: "abc" }],
    ["a zero amount", { amount: "0" }],
  ])("keeps Continuar disabled with %s", async (_name, options) => {
    renderPlanner();

    await fillRepayment(options);

    expect(continueButton()).toBeDisabled();
  });

  it("keeps Continuar disabled when the concept is blank", async () => {
    renderPlanner();

    await fillRepayment();
    fireEvent.change(conceptInput(), { target: { value: "   " } });

    expect(continueButton()).toBeDisabled();
  });

  it("keeps the number of cuotas between 2 and 60", async () => {
    renderPlanner();

    await fillRepayment();

    typeCuotas("1");
    expect(cuotasInput()).toHaveValue("2");

    typeCuotas("90");
    expect(cuotasInput()).toHaveValue("60");
  });

  it("closes from Cancelar without saving anything", () => {
    const { onOpenChange } = renderPlanner();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(installments.createInstallmentPlanAction).not.toHaveBeenCalled();
  });

  describe("the live preview", () => {
    it("invites to complete the data while it is not enough", () => {
      renderPlanner();

      expect(
        screen.getByText(
          "Completá los datos para ver el detalle de las cuotas.",
        ),
      ).toBeVisible();
    });

    it("says how many cuotas of how much, and the total", async () => {
      renderPlanner();

      await fillRepayment();

      expect(
        screen.getByText(
          /^6 cuotas de \$\s100\.000,00 · total \$\s600\.000,00$/,
        ),
      ).toBeVisible();
    });

    it("follows the number of cuotas", async () => {
      renderPlanner();

      await fillRepayment();
      typeCuotas("3");

      expect(
        screen.getByText(
          /^3 cuotas de \$\s200\.000,00 · total \$\s600\.000,00$/,
        ),
      ).toBeVisible();
    });

    it("reads the amount as the amount of one cuota when asked to", async () => {
      renderPlanner();

      await fillRepayment({ amount: "100000" });
      fireEvent.click(screen.getByRole("radio", { name: "Monto por cuota" }));

      expect(
        screen.getByText(
          /^6 cuotas de \$\s100\.000,00 · total \$\s600\.000,00$/,
        ),
      ).toBeVisible();
    });

    it("shows the amount of the first cuota with ≈, and no note about the rest, when the total does not divide evenly", async () => {
      renderPlanner();

      await fillRepayment({ amount: "1000.01", count: "3" });

      expect(
        screen.getByText(/^3 cuotas de ≈ \$\s333,34 · total \$\s1\.000,01$/),
      ).toBeVisible();
      expect(screen.queryByText(/la diferencia/)).not.toBeInTheDocument();
    });

    it("has no ≈ when the total divides evenly", async () => {
      renderPlanner();

      await fillRepayment();

      expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
    });
  });
});

describe("step 2: the ticket", () => {
  it("is the second of two steps and replaces the form", async () => {
    renderPlanner();

    await goToReview();

    expect(screen.getByText(REVIEW_STEP)).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: /Concepto/ }),
    ).not.toBeInTheDocument();
  });

  it("is headed DEVOLUCIÓN EN CUOTAS and named 'Resumen de la devolución'", async () => {
    renderPlanner();

    await goToReview();

    expect(within(ticket()).getByText("DEVOLUCIÓN EN CUOTAS")).toBeVisible();
    expect(
      within(ticket()).getByRole("heading", {
        name: "Resumen de la devolución",
      }),
    ).toBeVisible();
  });

  it("lists the repayment line by line, in order", async () => {
    renderPlanner();

    await goToReview();

    expect(
      within(ticket())
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual([
      "Concepto",
      "Categoría",
      "Cantidad de cuotas",
      "Monto por cuota",
      "Monto total",
      "Primera cuota",
      "Última cuota estimada",
      "Medio",
    ]);
  });

  it("fills the lines with what was typed", async () => {
    renderPlanner();

    await goToReview();

    const value = (label: string) =>
      screen.getByText(label, { selector: "dt" }).nextElementSibling
        ?.textContent;

    expect(value("Concepto")).toBe("Préstamo a Juan");
    expect(value("Categoría")).toBe("Préstamos");
    expect(value("Cantidad de cuotas")).toBe("6");
    expect(value("Monto por cuota")).toMatch(/^\$\s100\.000,00$/);
    expect(value("Monto total")).toMatch(/^\$\s600\.000,00$/);
    expect(value("Primera cuota")).toBe("1 oct 2026");
    expect(value("Última cuota estimada")).toBe("Marzo de 2027");
    expect(value("Medio")).toBe("Digital");
  });

  it("shows the medium that was chosen", async () => {
    renderPlanner();

    await fillRepayment();
    fireEvent.click(screen.getByRole("radio", { name: "Efectivo" }));
    fireEvent.click(continueButton());
    await screen.findByText(REVIEW_STEP);

    expect(
      screen.getByText("Medio", { selector: "dt" }).nextElementSibling,
    ).toHaveTextContent("Efectivo");
  });

  it("shows the amount of an installment with ≈ when the total does not divide evenly, without any remark", async () => {
    renderPlanner();

    await goToReview({ amount: "1000.01", count: "3" });

    expect(
      screen.getByText("Monto por cuota", { selector: "dt" })
        .nextElementSibling,
    ).toHaveTextContent(/^≈ \$\s333,34$/);
    expect(
      within(ticket()).queryByText(/Las primeras|el resto/),
    ).not.toBeInTheDocument();
  });

  it("hides the decorative torn edge from assistive technology", async () => {
    renderPlanner();

    await goToReview();

    const edge = ticket().lastElementChild as HTMLElement;

    expect(edge).toHaveAttribute("aria-hidden", "true");
    expect(edge).toBeEmptyDOMElement();
  });

  it("asks whether to save the repayment and create its cuotas", async () => {
    renderPlanner();

    await goToReview();

    expect(screen.getByText(SAVE_QUESTION)).toBeVisible();
    expect(screen.getByRole("button", { name: "Volver" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Guardar devolución" }),
    ).toBeEnabled();
  });

  it("goes back to the first step with everything as it was left", async () => {
    renderPlanner();

    await goToReview({ amount: "1000.01", count: "3" });
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(
      await screen.findByText("Paso 1 de 2 · Datos de la devolución"),
    ).toBeVisible();
    expect(conceptInput()).toHaveValue("Préstamo a Juan");
    expect(amountInput()).toHaveValue("1000.01");
    expect(cuotasInput()).toHaveValue("3");
    expect(screen.getByRole("button", { name: /Categoría/ })).toHaveTextContent(
      "Préstamos",
    );
    expect(continueButton()).toBeEnabled();
  });

  describe("Guardar devolución", () => {
    it("sends the repayment as an income plan, as typed, and closes the drawer", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      const { onClose } = renderPlanner();

      await goToReview();
      save();

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(installments.createInstallmentPlanAction).toHaveBeenCalledTimes(1);
      expect(installments.createInstallmentPlanAction).toHaveBeenCalledWith({
        kind: "income",
        description: "Préstamo a Juan",
        categoryId: "c1",
        currency: "ARS",
        medium: "DIGITAL",
        notes: "",
        amount: "600000",
        amountMode: "total",
        totalCuotas: 6,
        firstDate: "2026-10-01",
      });
    });

    it("sends the amount of one cuota with its mode", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      renderPlanner();

      await fillRepayment({ amount: "100000" });
      fireEvent.click(screen.getByRole("radio", { name: "Monto por cuota" }));
      fireEvent.click(continueButton());
      await screen.findByText(REVIEW_STEP);
      save();

      await waitFor(() =>
        expect(installments.createInstallmentPlanAction).toHaveBeenCalled(),
      );
      expect(
        installments.createInstallmentPlanAction.mock.calls[0][0],
      ).toMatchObject({ amount: "100000", amountMode: "perInstallment" });
    });

    it("sends cash when the money arrives in cash", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      renderPlanner();

      await fillRepayment();
      fireEvent.click(screen.getByRole("radio", { name: "Efectivo" }));
      fireEvent.click(continueButton());
      await screen.findByText(REVIEW_STEP);
      save();

      await waitFor(() =>
        expect(installments.createInstallmentPlanAction).toHaveBeenCalled(),
      );
      expect(
        installments.createInstallmentPlanAction.mock.calls[0][0],
      ).toMatchObject({ medium: "CASH" });
    });

    it("sends nothing about cards", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      renderPlanner();

      await goToReview();
      save();

      await waitFor(() =>
        expect(installments.createInstallmentPlanAction).toHaveBeenCalled(),
      );

      const sent = installments.createInstallmentPlanAction.mock.calls[0][0];

      expect(sent).not.toHaveProperty("cardId");
      expect(sent).not.toHaveProperty("cardOwnership");
      expect(sent).not.toHaveProperty("purchaseDate");
    });

    it("shows 'Guardando…' with a spinner, and locks Volver, while it saves", async () => {
      const pendingSave = deferred<{ status: "success" }>();

      installments.createInstallmentPlanAction.mockReturnValue(
        pendingSave.promise,
      );
      renderPlanner();

      await goToReview();
      save();

      const pending = await screen.findByRole("button", { name: /Guardando/ });

      expect(pending).toHaveTextContent("Guardando…");
      expect(pending.querySelector(".spinner")).not.toBeNull();
      expect(screen.getByRole("button", { name: "Volver" })).toBeDisabled();

      pendingSave.resolve({ status: "success" });
      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: /Guardando/ }),
        ).not.toBeInTheDocument(),
      );
    });

    it("shows the server's message and stays open when it is refused", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "error",
        message: "Corrige los campos resaltados.",
        fieldErrors: { categoryId: ["Selecciona una categoría válida."] },
      });
      const { onClose } = renderPlanner();

      await goToReview();
      save();

      expect(
        await screen.findByText("Selecciona una categoría válida."),
      ).toBeVisible();
      expect(onClose).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Guardar devolución" }),
        ).toBeEnabled(),
      );
    });

    it("shows a general message when there are no field errors", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "error",
        message: "Algo salió mal. Inténtalo de nuevo.",
      });
      renderPlanner();

      await goToReview();
      save();

      expect(
        await screen.findByText("Algo salió mal. Inténtalo de nuevo."),
      ).toBeVisible();
    });

    it("clears the message when going back", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "error",
        message: "Algo salió mal. Inténtalo de nuevo.",
      });
      renderPlanner();

      await goToReview();
      save();
      await screen.findByText("Algo salió mal. Inténtalo de nuevo.");
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Volver" })).toBeEnabled(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Volver" }));
      await screen.findByText("Paso 1 de 2 · Datos de la devolución");
      fireEvent.click(continueButton());
      await screen.findByText(REVIEW_STEP);

      expect(
        screen.queryByText("Algo salió mal. Inténtalo de nuevo."),
      ).not.toBeInTheDocument();
    });
  });
});
