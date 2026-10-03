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
const expenses = vi.hoisted(() => ({ createCategoryAction: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/core/installments/actions", () => installments);
vi.mock("@/core/expenses/actions", () => expenses);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { CardOption } from "../../types";
import { InstallmentPlannerDrawer } from "./InstallmentPlannerDrawer";

const CATEGORIES = [
  { id: "c1", name: "Hogar" },
  { id: "c2", name: "Tecnología" },
];

// Closes on the 25th and is paid on the 5th, with room for a purchase of $ 1.200.000: bought on
// October 1 it goes in the October statement, paid on November 5.
const VISA: CardOption = {
  id: "visa",
  title: "Visa •••• 1234",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  currency: "ARS",
  limitMode: "TOTAL",
  limitAmount: 200000000,
  charges: [],
};
// $ 1.300.000 of cap: the purchase fits but leaves less than a fifth of it.
const TIGHT: CardOption = {
  ...VISA,
  id: "tight",
  title: "Mastercard •••• 9999",
  brand: "MASTERCARD",
  last4: "9999",
  closingDay: 28,
  limitAmount: 130000000,
};
// $ 1.000.000 of cap: the purchase does not fit.
const SMALL: CardOption = {
  ...VISA,
  id: "small",
  title: "Visa •••• 5555",
  last4: "5555",
  closingDay: 30,
  limitAmount: 100000000,
};
// Closes on the 5th and is paid on the 28th: bought on October 1 it is charged this very month.
const THIS_MONTH: CardOption = {
  ...VISA,
  id: "now",
  title: "Visa •••• 7777",
  last4: "7777",
  closingDay: 5,
  dueDay: 28,
};
const DOLLARS: CardOption = {
  ...VISA,
  id: "usd",
  title: "Visa •••• 4321",
  last4: "4321",
  currency: "USD",
};

const renderPlanner = (cards: readonly CardOption[] = []) => {
  const onClose = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <InstallmentPlannerDrawer
      isOpen
      onOpenChange={onOpenChange}
      onClose={onClose}
      sessionKey={1}
      defaultDate="2026-10-01"
      categories={CATEGORIES}
      cards={cards}
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

const productInput = () => screen.getByRole("textbox", { name: /Producto/ });
const amountInput = () => screen.getByRole("textbox", { name: /^Monto\b/ });
const cuotasInput = () =>
  screen.getByRole("textbox", { name: /Cantidad de cuotas/ });
const continueButton = () => screen.getByRole("button", { name: "Continuar" });
const cardButton = () => screen.getByRole("button", { name: /Tarjeta/ });
const ownershipGroup = () =>
  screen.getByRole("radiogroup", { name: "Tarjeta" });
const mediumGroup = () => screen.queryByRole("radiogroup", { name: "Medio" });

const BORROWED_HINT =
  "Usás la tarjeta de otra persona y después le pagás a ella.";
const SAVE_QUESTION = "¿Guardar la compra y crear las 12 cuotas?";
const POPUP_TITLE = "¿Seguro que querés usar esta tarjeta?";

// Types a number of cuotas and commits it, as leaving the field does.
const typeCuotas = (value: string) => {
  fireEvent.change(cuotasInput(), { target: { value } });
  fireEvent.blur(cuotasInput());
};

const pickCard = async (title: string) => {
  fireEvent.keyDown(cardButton(), { key: "ArrowDown" });

  const option = await screen.findByRole("option", { name: title });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

const chooseOwnership = (name: "Propia" | "Prestada") =>
  fireEvent.click(within(ownershipGroup()).getByRole("radio", { name }));

// A valid first step: a heladera for 1.200.000 pesos in 12 installments.
const fillPurchase = async ({
  amount = "1200000",
  count = "12",
}: { amount?: string; count?: string } = {}) => {
  fireEvent.change(productInput(), { target: { value: "Heladera" } });
  fireEvent.change(amountInput(), { target: { value: amount } });
  typeCuotas(count);
  await pickCategory("Hogar");
};

const REVIEW_STEP = "Paso 2 de 2 · Revisá la compra";

// With no cards the purchase is on a borrowed card, which needs nothing more.
const goToReview = async (options?: Parameters<typeof fillPurchase>[0]) => {
  await fillPurchase(options);
  fireEvent.click(continueButton());
  await screen.findByText(REVIEW_STEP);
};

// With cards, the purchase is on the user's own card, so one has to be picked.
const goToReviewWithCard = async (title: string) => {
  await fillPurchase();
  await pickCard(title);
  fireEvent.click(continueButton());
  await screen.findByText(REVIEW_STEP);
};

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Guardar compra" }));

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

describe("step 1: the data of the purchase", () => {
  it("is titled 'Compra en cuotas' and says it is the first of two steps", () => {
    renderPlanner();

    expect(
      screen.getByRole("heading", { name: "Compra en cuotas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Paso 1 de 2 · Datos de la compra")).toBeVisible();
  });

  it("asks for the product, category, whose card, medium, amount, currency, number of cuotas, first date and notes", () => {
    renderPlanner();

    expect(productInput()).toBeVisible();
    expect(screen.getByRole("button", { name: /Categoría/ })).toBeVisible();
    expect(ownershipGroup()).toBeVisible();
    expect(mediumGroup()).toBeVisible();
    expect(screen.getByRole("radio", { name: "Monto total" })).toBeVisible();
    expect(
      screen.getByRole("radio", { name: "Monto por cuota" }),
    ).toBeVisible();
    expect(amountInput()).toBeVisible();
    expect(screen.getByRole("button", { name: /Moneda/ })).toBeVisible();
    expect(cuotasInput()).toBeVisible();
    expect(screen.getByText("Fecha de la primera cuota")).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Notas/ })).toBeVisible();
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

  it("has Cancelar and a Continuar that waits until the purchase is valid", async () => {
    renderPlanner();

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    expect(continueButton()).toBeDisabled();

    fireEvent.change(productInput(), { target: { value: "Heladera" } });
    fireEvent.change(amountInput(), { target: { value: "1200000" } });
    expect(continueButton()).toBeDisabled();

    await pickCategory("Hogar");
    expect(continueButton()).toBeEnabled();
  });

  it.each([
    ["an amount that is not a number", { amount: "abc" }],
    ["a zero amount", { amount: "0" }],
  ])("keeps Continuar disabled with %s", async (_name, options) => {
    renderPlanner();

    await fillPurchase(options);

    expect(continueButton()).toBeDisabled();
  });

  it("keeps Continuar disabled when the product is blank", async () => {
    renderPlanner();

    await fillPurchase();
    fireEvent.change(productInput(), { target: { value: "   " } });

    expect(continueButton()).toBeDisabled();
  });

  it("keeps the number of cuotas between 2 and 60", async () => {
    renderPlanner();

    await fillPurchase();

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

      await fillPurchase();

      expect(
        screen.getByText(
          /^12 cuotas de \$\s100\.000,00 · total \$\s1\.200\.000,00$/,
        ),
      ).toBeVisible();
    });

    it("follows the number of cuotas", async () => {
      renderPlanner();

      await fillPurchase();
      typeCuotas("6");

      expect(
        screen.getByText(
          /^6 cuotas de \$\s200\.000,00 · total \$\s1\.200\.000,00$/,
        ),
      ).toBeVisible();
    });

    it("reads the amount as the amount of one cuota when asked to", async () => {
      renderPlanner();

      await fillPurchase({ amount: "100000" });
      fireEvent.click(screen.getByRole("radio", { name: "Monto por cuota" }));

      expect(
        screen.getByText(
          /^12 cuotas de \$\s100\.000,00 · total \$\s1\.200\.000,00$/,
        ),
      ).toBeVisible();
    });

    it("shows the amount of the first cuota with ≈, and no note about the rest, when the total does not divide evenly", async () => {
      renderPlanner();

      await fillPurchase({ amount: "1000.01", count: "3" });

      expect(
        screen.getByText(/^3 cuotas de ≈ \$\s333,34 · total \$\s1\.000,01$/),
      ).toBeVisible();
      expect(screen.queryByText(/la diferencia/)).not.toBeInTheDocument();
    });
  });
});

describe("whose card pays the purchase", () => {
  it("is asked with two options, Propia and Prestada, and a hint under Prestada", () => {
    renderPlanner([VISA]);

    const radios = within(ownershipGroup()).getAllByRole("radio");

    expect(radios.map((radio) => radio.closest("label")?.textContent)).toEqual([
      expect.stringContaining("Propia"),
      expect.stringContaining("Prestada"),
    ]);
    expect(screen.getByText(BORROWED_HINT)).toBeVisible();
  });

  it("starts on Propia when the user has at least one card", () => {
    renderPlanner([VISA]);

    expect(screen.getByRole("radio", { name: "Propia" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Prestada" })).not.toBeChecked();
  });

  it("starts on Prestada when the user has no cards", () => {
    renderPlanner();

    expect(screen.getByRole("radio", { name: "Prestada" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Propia" })).not.toBeChecked();
  });

  describe("Propia", () => {
    it("asks for one of the user's cards, with no 'Sin tarjeta' option, and not for the medium", async () => {
      renderPlanner([VISA, TIGHT]);

      expect(cardButton()).toHaveTextContent("Elegí una tarjeta");
      expect(mediumGroup()).not.toBeInTheDocument();

      fireEvent.keyDown(cardButton(), { key: "ArrowDown" });

      const options = await screen.findAllByRole("option");

      expect(options.map((option) => option.textContent)).toEqual([
        "Visa •••• 1234",
        "Mastercard •••• 9999",
      ]);
    });

    it("offers only the cards in the currency of the purchase", async () => {
      renderPlanner([VISA, DOLLARS]);

      fireEvent.keyDown(cardButton(), { key: "ArrowDown" });

      const options = await screen.findAllByRole("option");

      expect(options.map((option) => option.textContent)).toEqual([
        "Visa •••• 1234",
      ]);
    });

    it("calls the date 'Fecha de la compra' and tells when the first installment is, once a card is chosen", async () => {
      renderPlanner([VISA]);

      expect(screen.getByText("Fecha de la compra")).toBeVisible();
      expect(
        screen.queryByText("Fecha de la primera cuota"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/^Primera cuota:/)).not.toBeInTheDocument();

      await pickCard("Visa •••• 1234");

      expect(screen.getByText("Primera cuota: 5 nov 2026")).toBeVisible();
    });

    it("keeps Continuar disabled until a card is chosen: a purchase in installments needs one", async () => {
      renderPlanner([VISA]);

      await fillPurchase();
      expect(continueButton()).toBeDisabled();

      await pickCard("Visa •••• 1234");
      expect(continueButton()).toBeEnabled();
    });

    it("tells there are no cards yet, with a way to Tarjetas, when the user has none", () => {
      renderPlanner();

      chooseOwnership("Propia");

      expect(
        screen.getByText(
          "Todavía no tenés tarjetas. Agregá una desde Tarjetas.",
        ),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: /Elegí una tarjeta/ }),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Ir a Tarjetas" }));

      expect(router.push).toHaveBeenCalledWith("/dashboard/cards");
    });

    it("cannot continue without cards: only Prestada can", async () => {
      renderPlanner();

      await fillPurchase();
      chooseOwnership("Propia");
      expect(continueButton()).toBeDisabled();

      chooseOwnership("Prestada");
      expect(continueButton()).toBeEnabled();
    });

    it("says there are no cards in the currency of the purchase", async () => {
      renderPlanner([DOLLARS]);

      await fillPurchase();

      expect(
        screen.getByText("No tenés tarjetas en esta moneda."),
      ).toBeVisible();
    });
  });

  describe("Prestada", () => {
    it("asks for the medium, to repay the lender, and for the first date as typed", async () => {
      renderPlanner([VISA]);

      chooseOwnership("Prestada");

      expect(mediumGroup()).toBeVisible();
      expect(screen.getByRole("radio", { name: "Digital" })).toBeChecked();
      expect(screen.getByText("Fecha de la primera cuota")).toBeVisible();
      expect(
        screen.queryByRole("button", { name: /Elegí una tarjeta/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Tarjetas para esta compra"),
      ).not.toBeInTheDocument();
    });

    it("needs no card to continue", async () => {
      renderPlanner([VISA]);

      chooseOwnership("Prestada");
      await fillPurchase();

      expect(continueButton()).toBeEnabled();
    });

    it("remembers the medium and the card when going back and forth", async () => {
      renderPlanner([VISA]);

      chooseOwnership("Prestada");
      fireEvent.click(screen.getByRole("radio", { name: "Efectivo" }));
      chooseOwnership("Propia");
      await pickCard("Visa •••• 1234");
      chooseOwnership("Prestada");

      expect(screen.getByRole("radio", { name: "Efectivo" })).toBeChecked();

      chooseOwnership("Propia");

      expect(cardButton()).toHaveTextContent("Visa •••• 1234");
    });
  });

  describe("the recommendation", () => {
    it("waits until the amount, the cuotas, the currency and the date are valid", async () => {
      renderPlanner([VISA]);

      expect(
        screen.queryByText("Tarjetas para esta compra"),
      ).not.toBeInTheDocument();

      fireEvent.change(amountInput(), { target: { value: "1200000" } });

      // No product or category is needed to know whether a card has room.
      expect(screen.getByText("Tarjetas para esta compra")).toBeVisible();
    });

    const recommendations = () =>
      screen.getByRole("list", { name: "Tarjetas para esta compra" });
    const recommendationOf = (title: string) =>
      within(recommendations()).getByText(title).closest("li") as HTMLElement;

    it("says it fits, with what is left, in green with a check, and marks the best card as recommended", async () => {
      renderPlanner([VISA, TIGHT, SMALL]);

      await fillPurchase();

      const visa = recommendationOf("Visa •••• 1234");

      expect(visa).toHaveTextContent(
        /Entra en el tope \(te queda \$\s800\.000,00\)/,
      );
      expect(visa).toHaveTextContent("Recomendada");
      expect(visa.querySelector("svg")).not.toBeNull();
      expect(
        visa.querySelector(".text-positive-soft-foreground"),
      ).not.toBeNull();
    });

    it("says it is near the cap, with a warning icon, when it fits but leaves under a fifth of it", async () => {
      renderPlanner([VISA, TIGHT, SMALL]);

      await fillPurchase();

      const tight = recommendationOf("Mastercard •••• 9999");

      expect(tight).toHaveTextContent("Cerca del tope");
      expect(tight).not.toHaveTextContent("Recomendada");
      expect(tight.querySelector("svg")).not.toBeNull();
      expect(
        tight.querySelector(".text-warning-soft-foreground"),
      ).not.toBeNull();
    });

    it("says by how much the purchase goes over the cap, in red with a cross", async () => {
      renderPlanner([VISA, TIGHT, SMALL]);

      await fillPurchase();

      const small = recommendationOf("Visa •••• 5555");

      expect(small).toHaveTextContent(/Se pasa del tope por \$\s200\.000,00/);
      expect(small).not.toHaveTextContent("Recomendada");
      expect(small.querySelector("svg")).not.toBeNull();
      expect(
        small.querySelector(".text-danger-soft-foreground"),
      ).not.toBeNull();
    });

    it("lists the best card first and marks exactly one as recommended", async () => {
      renderPlanner([SMALL, TIGHT, VISA]);

      await fillPurchase();

      const titles = within(recommendations())
        .getAllByRole("listitem")
        .map((item) => item.textContent ?? "");

      expect(titles[0]).toContain("Visa •••• 1234");
      expect(titles[1]).toContain("Mastercard •••• 9999");
      expect(titles[2]).toContain("Visa •••• 5555");
      expect(screen.getAllByText("Recomendada")).toHaveLength(1);
    });

    it("recommends nobody when no card has room", async () => {
      renderPlanner([SMALL]);

      await fillPurchase();

      expect(screen.queryByText("Recomendada")).not.toBeInTheDocument();
    });

    it("follows the amount: a cheaper purchase fits the small card", async () => {
      renderPlanner([SMALL]);

      await fillPurchase({ amount: "600000" });

      expect(recommendationOf("Visa •••• 5555")).toHaveTextContent(
        /Entra en el tope|Cerca del tope/,
      );
    });

    it("lets the user choose a card that does not fit, and keeps the verdict visible", async () => {
      renderPlanner([SMALL]);

      await fillPurchase();
      await pickCard("Visa •••• 5555");

      expect(continueButton()).toBeEnabled();
      expect(recommendationOf("Visa •••• 5555")).toHaveTextContent(
        /Se pasa del tope por/,
      );
    });
  });
});

describe("step 2: reviewing the ticket", () => {
  const ticket = () =>
    screen.getByRole("region", { name: "Resumen de la compra" });
  const line = (label: string) =>
    within(ticket()).getByText(label).closest("div")!.parentElement!;

  it("shows the ticket with the heading 'Resumen de la compra' and the second step label", async () => {
    renderPlanner();

    await goToReview();

    expect(ticket()).toBeVisible();
    expect(
      within(ticket()).getByRole("heading", { name: "Resumen de la compra" }),
    ).toBeVisible();
    expect(within(ticket()).getByText("COMPRA EN CUOTAS")).toBeVisible();
    expect(screen.queryByText("Paso 1 de 2 · Datos de la compra")).toBeNull();
  });

  describe("of a borrowed card", () => {
    it("lists the product, category, cuotas, amounts, dates, the card as borrowed and the medium", async () => {
      renderPlanner();

      await goToReview();

      expect(line("Producto")).toHaveTextContent("Heladera");
      expect(line("Categoría")).toHaveTextContent("Hogar");
      expect(line("Cantidad de cuotas")).toHaveTextContent("12");
      expect(line("Monto por cuota")).toHaveTextContent(
        /^Monto por cuota\$\s100\.000,00$/,
      );
      expect(line("Monto total")).toHaveTextContent(/\$\s1\.200\.000,00/);
      expect(line("Primera cuota")).toHaveTextContent("1 oct 2026");
      expect(line("Última cuota estimada")).toHaveTextContent(
        "Septiembre de 2027",
      );
      expect(line("Tarjeta")).toHaveTextContent("Prestada");
      expect(line("Medio")).toHaveTextContent("Digital");
    });

    it("shows cash as Efectivo", async () => {
      renderPlanner();

      await fillPurchase();
      fireEvent.click(screen.getByRole("radio", { name: "Efectivo" }));
      fireEvent.click(continueButton());
      await screen.findByText(REVIEW_STEP);

      expect(line("Medio")).toHaveTextContent("Efectivo");
    });

    it("adds no note about the first cuota", async () => {
      renderPlanner();

      await goToReview();

      expect(
        within(ticket()).queryByText(/La primera cuota entra/),
      ).not.toBeInTheDocument();
    });
  });

  describe("the amount per cuota", () => {
    it("is exact, with no ≈, when every cuota is the same", async () => {
      renderPlanner();

      await goToReview();

      expect(line("Monto por cuota")).not.toHaveTextContent("≈");
    });

    it("is the amount of the first cuota with ≈ when the total does not divide evenly, and the total stays exact", async () => {
      renderPlanner();

      await goToReview({ amount: "1000.01", count: "3" });

      expect(line("Monto por cuota")).toHaveTextContent(/≈ \$\s333,34/);
      expect(line("Monto total")).toHaveTextContent(/\$\s1\.000,01/);
      expect(line("Monto total")).not.toHaveTextContent("≈");
    });

    it("never says which cuotas are larger", async () => {
      renderPlanner();

      await goToReview({ amount: "1000.01", count: "3" });

      expect(
        within(ticket()).queryByText(/Las primeras|el resto/),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/Las primeras|el resto/)).toBeNull();
    });
  });

  it("hides the decorative torn edge from assistive technology", async () => {
    renderPlanner();

    await goToReview();

    const edge = ticket().lastElementChild as HTMLElement;

    expect(edge).toHaveAttribute("aria-hidden", "true");
    expect(edge).toBeEmptyDOMElement();
  });

  it("asks whether to save the purchase and create its cuotas", async () => {
    renderPlanner();

    await goToReview();

    expect(screen.getByText(SAVE_QUESTION)).toBeVisible();
    expect(screen.getByRole("button", { name: "Volver" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Guardar compra" }),
    ).toBeEnabled();
  });

  it("goes back to the first step with everything as it was left", async () => {
    renderPlanner();

    await goToReview({ amount: "1000.01", count: "3" });
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(
      await screen.findByText("Paso 1 de 2 · Datos de la compra"),
    ).toBeVisible();
    expect(productInput()).toHaveValue("Heladera");
    expect(amountInput()).toHaveValue("1000.01");
    expect(cuotasInput()).toHaveValue("3");
    expect(screen.getByRole("button", { name: /Categoría/ })).toHaveTextContent(
      "Hogar",
    );
    expect(continueButton()).toBeEnabled();
  });

  describe("Guardar compra", () => {
    it("sends the purchase as typed and closes the drawer", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      const { onClose } = renderPlanner();

      await goToReview();
      save();

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(installments.createInstallmentPlanAction).toHaveBeenCalledTimes(1);
      expect(installments.createInstallmentPlanAction).toHaveBeenCalledWith({
        description: "Heladera",
        categoryId: "c1",
        currency: "ARS",
        medium: "DIGITAL",
        notes: "",
        amount: "1200000",
        amountMode: "total",
        totalCuotas: 12,
        firstDate: "2026-10-01",
        cardOwnership: "borrowed",
      });
    });

    it("sends the amount of one cuota with its mode", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      renderPlanner();

      await fillPurchase({ amount: "100000" });
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

    it("sends cash when the borrowed card is repaid in cash", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      renderPlanner();

      await fillPurchase();
      fireEvent.click(screen.getByRole("radio", { name: "Efectivo" }));
      fireEvent.click(continueButton());
      await screen.findByText(REVIEW_STEP);
      save();

      await waitFor(() =>
        expect(installments.createInstallmentPlanAction).toHaveBeenCalled(),
      );
      expect(
        installments.createInstallmentPlanAction.mock.calls[0][0],
      ).toMatchObject({ medium: "CASH", cardOwnership: "borrowed" });
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
          screen.getByRole("button", { name: "Guardar compra" }),
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

    it("never asks 'Seguro' for a borrowed card: its cycle is unknown", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      renderPlanner();

      await goToReview();
      save();

      await waitFor(() =>
        expect(installments.createInstallmentPlanAction).toHaveBeenCalled(),
      );
      expect(screen.queryByText(POPUP_TITLE)).not.toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});

describe("paying with one of the user's cards", () => {
  const ticket = () =>
    screen.getByRole("region", { name: "Resumen de la compra" });

  describe("the ticket", () => {
    it("says the card is the user's own, with its name, and has no medium line", async () => {
      renderPlanner([VISA]);

      await goToReviewWithCard("Visa •••• 1234");

      expect(within(ticket()).getByText("Tarjeta")).toBeVisible();
      expect(
        within(ticket()).getByText("Propia · Visa •••• 1234"),
      ).toBeVisible();
      expect(within(ticket()).queryByText("Medio")).not.toBeInTheDocument();
      expect(within(ticket()).queryByText("Prestada")).not.toBeInTheDocument();
    });

    it("tells when the first installment comes, and asks the usual question", async () => {
      renderPlanner([VISA]);

      await goToReviewWithCard("Visa •••• 1234");

      expect(within(ticket()).getByText("5 nov 2026")).toBeVisible();
      expect(
        within(ticket()).getByText(
          "La primera cuota entra el mes que viene (5 nov 2026).",
        ),
      ).toBeVisible();
      expect(screen.getByText(SAVE_QUESTION)).toBeVisible();
    });

    it("has no third step: it is the second of two, whatever the card", async () => {
      renderPlanner([THIS_MONTH]);

      await goToReviewWithCard("Visa •••• 7777");

      expect(screen.getByText(REVIEW_STEP)).toBeVisible();
      expect(screen.queryByText(/Confirmá la tarjeta/)).not.toBeInTheDocument();
    });
  });

  describe("saving, when the first installment is not this month", () => {
    it("sends the card, the day of the purchase, the first date its cycle gives and digital money", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      const { onClose } = renderPlanner([VISA]);

      await goToReviewWithCard("Visa •••• 1234");
      save();

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(installments.createInstallmentPlanAction).toHaveBeenCalledWith({
        description: "Heladera",
        categoryId: "c1",
        currency: "ARS",
        medium: "DIGITAL",
        notes: "",
        amount: "1200000",
        amountMode: "total",
        totalCuotas: 12,
        firstDate: "2026-11-05",
        cardOwnership: "own",
        cardId: "visa",
        purchaseDate: "2026-10-01",
      });
    });

    it("saves straight away, with no pop-up", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      renderPlanner([VISA]);

      await goToReviewWithCard("Visa •••• 1234");
      save();

      await waitFor(() =>
        expect(installments.createInstallmentPlanAction).toHaveBeenCalled(),
      );
      expect(screen.queryByText(POPUP_TITLE)).not.toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("sends digital money even if cash was chosen on a borrowed card before", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      renderPlanner([VISA]);

      chooseOwnership("Prestada");
      fireEvent.click(screen.getByRole("radio", { name: "Efectivo" }));
      chooseOwnership("Propia");
      await goToReviewWithCard("Visa •••• 1234");
      save();

      await waitFor(() =>
        expect(installments.createInstallmentPlanAction).toHaveBeenCalled(),
      );
      expect(
        installments.createInstallmentPlanAction.mock.calls[0][0],
      ).toMatchObject({ medium: "DIGITAL", cardOwnership: "own" });
    });

    it("sends nothing about cards when the user went back to a borrowed one", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      renderPlanner([VISA]);

      await fillPurchase();
      await pickCard("Visa •••• 1234");
      chooseOwnership("Prestada");
      fireEvent.click(continueButton());
      await screen.findByText(REVIEW_STEP);
      save();

      await waitFor(() =>
        expect(installments.createInstallmentPlanAction).toHaveBeenCalled(),
      );

      const sent = installments.createInstallmentPlanAction.mock.calls[0][0];

      expect(sent).not.toHaveProperty("cardId");
      expect(sent).not.toHaveProperty("purchaseDate");
      expect(sent).toMatchObject({
        cardOwnership: "borrowed",
        firstDate: "2026-10-01",
      });
    });
  });

  describe("when the card charges the first installment this month", () => {
    const toPopup = async () => {
      await goToReviewWithCard("Visa •••• 7777");
      save();
      await screen.findByRole("alertdialog");
    };
    const popup = () => screen.getByRole("alertdialog");

    it("opens a pop-up on Guardar compra, saying the date and the month's summary it goes into", async () => {
      renderPlanner([THIS_MONTH]);

      await toPopup();

      expect(
        within(popup()).getByRole("heading", { name: POPUP_TITLE }),
      ).toBeVisible();
      expect(
        within(popup()).getByText(
          /^La primera cuota se cobra este mes \(28 oct 2026\) y se va a registrar en tu resumen de octubre de 2026\.$/,
        ),
      ).toBeVisible();
      expect(
        within(popup()).getByRole("button", { name: "Volver" }),
      ).toBeEnabled();
      expect(
        within(popup()).getByRole("button", { name: "Sí, usar esta tarjeta" }),
      ).toBeEnabled();
      expect(installments.createInstallmentPlanAction).not.toHaveBeenCalled();
    });

    it("warns with a status icon", async () => {
      renderPlanner([THIS_MONTH]);

      await toPopup();

      expect(
        popup().querySelector(".alert-dialog__icon--warning"),
      ).not.toBeNull();
    });

    it("closes with Volver, stays on the ticket and saves nothing", async () => {
      renderPlanner([THIS_MONTH]);

      await toPopup();
      fireEvent.click(within(popup()).getByRole("button", { name: "Volver" }));

      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      expect(screen.getByText(SAVE_QUESTION)).toBeVisible();
      expect(ticket()).toBeVisible();
      expect(installments.createInstallmentPlanAction).not.toHaveBeenCalled();
    });

    it("asks again if Guardar compra is pressed after Volver", async () => {
      renderPlanner([THIS_MONTH]);

      await toPopup();
      fireEvent.click(within(popup()).getByRole("button", { name: "Volver" }));
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      save();

      expect(await screen.findByRole("alertdialog")).toBeVisible();
    });

    it("saves the purchase with the card once confirmed, and closes", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "success",
      });
      const { onClose } = renderPlanner([THIS_MONTH]);

      await toPopup();
      fireEvent.click(
        within(popup()).getByRole("button", { name: "Sí, usar esta tarjeta" }),
      );

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(installments.createInstallmentPlanAction).toHaveBeenCalledTimes(1);
      expect(
        installments.createInstallmentPlanAction.mock.calls[0][0],
      ).toMatchObject({
        cardOwnership: "own",
        cardId: "now",
        purchaseDate: "2026-10-01",
        firstDate: "2026-10-28",
        medium: "DIGITAL",
      });
    });

    it("shows 'Guardando…' on the confirm button, and locks Volver, while it saves", async () => {
      const pendingSave = deferred<{ status: "success" }>();

      installments.createInstallmentPlanAction.mockReturnValue(
        pendingSave.promise,
      );
      renderPlanner([THIS_MONTH]);

      await toPopup();
      fireEvent.click(
        within(popup()).getByRole("button", { name: "Sí, usar esta tarjeta" }),
      );

      const pending = await within(popup()).findByRole("button", {
        name: /Guardando/,
      });

      expect(pending).toHaveTextContent("Guardando…");
      expect(pending.querySelector(".spinner")).not.toBeNull();
      expect(
        within(popup()).getByRole("button", { name: "Volver" }),
      ).toBeDisabled();

      pendingSave.resolve({ status: "success" });
    });

    it("keeps the server's refusal in view, on the ticket, when it fails", async () => {
      installments.createInstallmentPlanAction.mockResolvedValue({
        status: "error",
        message: "No se pudo guardar.",
      });
      const { onClose } = renderPlanner([THIS_MONTH]);

      await toPopup();
      fireEvent.click(
        within(popup()).getByRole("button", { name: "Sí, usar esta tarjeta" }),
      );

      expect(await screen.findByText("No se pudo guardar.")).toBeVisible();
      expect(onClose).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
    });
  });
});
