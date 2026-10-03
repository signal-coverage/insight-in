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
  createCardAction: vi.fn(),
  updateCardAction: vi.fn(),
}));

vi.mock("@/core/cards/actions", () => actions);

import type { CardRow, FormTarget } from "../../types";
import { CardFormDrawer } from "./CardFormDrawer";

const CARD: CardRow = {
  id: "card_1",
  last4: "1234",
  brand: "MASTERCARD",
  closingDay: 25,
  dueDay: 5,
  currency: "USD",
  limitMode: "TOTAL",
  limitAmount: 120050,
  committedTotal: 0,
  monthUsed: 0,
  used: 0,
  available: 120050,
  tier: "available",
  title: "Mastercard •••• 1234",
  brandName: "Mastercard",
  closingLabel: "Día 25",
  dueLabel: "Día 5",
  limitLabel: "US$ 1.200,50 en total",
  usedLabel: "US$ 0,00 de US$ 1.200,50",
  availableLabel: "US$ 1.200,50",
  limitDecimal: "1200.50",
  percent: 0,
};

const renderForm = (card: CardRow | null) => {
  const onClose = vi.fn();
  const target: FormTarget = { key: 1, card };

  render(
    <CardFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
    />,
  );

  return { onClose };
};

const last4Input = () =>
  screen.getByRole("textbox", { name: /Últimos 4 dígitos/ });
const closingInput = () =>
  screen.getByRole("textbox", { name: /Día de cierre/ });
const dueInput = () =>
  screen.getByRole("textbox", { name: /Día de vencimiento/ });
const limitInput = () =>
  screen.getByRole("textbox", { name: /Monto del tope/ });
const submitButton = (name: string) => screen.getByRole("button", { name });

// A number field commits what was typed when it loses focus.
const typeDay = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

const fillCard = () => {
  fireEvent.change(last4Input(), { target: { value: "4321" } });
  typeDay(closingInput(), "25");
  typeDay(dueInput(), "5");
  fireEvent.change(limitInput(), { target: { value: "300000" } });
};

const createdForm = (): FormData =>
  actions.createCardAction.mock.calls[0][0] as FormData;

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
  it("is titled 'Agregar tarjeta' and says no sensitive data is asked", () => {
    renderForm(null);

    expect(
      screen.getByRole("heading", { name: "Agregar tarjeta" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no pedimos el número completo/i)).toBeVisible();
  });

  it("has an add button with the same plus icon as every other add action, and a Cancel", () => {
    renderForm(null);

    const button = submitButton("Agregar tarjeta");

    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("asks for the last four digits, the brand, the two days, the currency, the kind of cap and its amount", () => {
    renderForm(null);

    expect(last4Input()).toBeVisible();
    expect(screen.getByRole("radiogroup", { name: "Marca" })).toBeVisible();
    expect(closingInput()).toBeVisible();
    expect(dueInput()).toBeVisible();
    expect(screen.getByRole("button", { name: /Moneda/ })).toBeVisible();
    expect(
      screen.getByRole("radiogroup", { name: "Tipo de tope" }),
    ).toBeVisible();
    expect(limitInput()).toBeVisible();
  });

  it("starts with sensible defaults: Visa, the default currency and a monthly cap", () => {
    renderForm(null);

    expect(screen.getByRole("radio", { name: "Visa" })).toBeChecked();
    expect(screen.getByRole("button", { name: /Moneda/ })).toHaveTextContent(
      "ARS",
    );
    expect(screen.getByRole("radio", { name: /Mensual/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Total/ })).not.toBeChecked();
  });

  it("offers Visa, Mastercard and Otra as brands", () => {
    renderForm(null);

    const group = screen.getByRole("radiogroup", { name: "Marca" });

    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual(["Visa", "Mastercard", "Otra"]);
  });

  describe("the last four digits", () => {
    it("takes four digits at most, and a numeric keyboard", () => {
      renderForm(null);

      expect(last4Input()).toHaveAttribute("maxlength", "4");
      expect(last4Input()).toHaveAttribute("inputmode", "numeric");
    });

    it("keeps only digits of what is typed or pasted", () => {
      renderForm(null);

      fireEvent.change(last4Input(), { target: { value: "12a4-b" } });

      expect(last4Input()).toHaveValue("124");
    });

    it("keeps leading zeros", () => {
      renderForm(null);

      fireEvent.change(last4Input(), { target: { value: "0042" } });

      expect(last4Input()).toHaveValue("0042");
    });
  });

  describe("the hints", () => {
    it("says what the closing and the due day are", () => {
      renderForm(null);

      expect(
        screen.getByText("El día del mes en que cierra el resumen"),
      ).toBeVisible();
      expect(
        screen.getByText("El día del mes en que se paga el resumen"),
      ).toBeVisible();
    });

    it("says what each kind of cap means", () => {
      renderForm(null);

      expect(
        screen.getByText("Lo máximo que querés pagar por mes con esta tarjeta"),
      ).toBeVisible();
      expect(
        screen.getByText(
          "Lo máximo que querés tener comprometido en cuotas pendientes",
        ),
      ).toBeVisible();
    });

    it("says the cap can be the real limit or a lower one", () => {
      renderForm(null);

      expect(
        screen.getByText(
          "Puede ser el límite real de la tarjeta o uno menor que quieras respetar.",
        ),
      ).toBeVisible();
    });
  });

  it("keeps the days between 1 and 31", () => {
    renderForm(null);

    typeDay(closingInput(), "45");
    expect(closingInput()).toHaveValue("31");

    typeDay(dueInput(), "0");
    expect(dueInput()).toHaveValue("1");
  });

  it("does not send the form while something required is missing", async () => {
    renderForm(null);

    fireEvent.change(last4Input(), { target: { value: "4321" } });
    fireEvent.click(submitButton("Agregar tarjeta"));

    // The days start filled in, so the first thing still missing is the cap amount.
    await waitFor(() => expect(limitInput()).toBeInvalid());
    expect(actions.createCardAction).not.toHaveBeenCalled();
  });

  it("starts a new card closing on day 1 and due on day 15", () => {
    renderForm(null);

    expect(closingInput()).toHaveValue("1");
    expect(dueInput()).toHaveValue("15");
  });

  it("sends the default days when they are not touched", async () => {
    actions.createCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    fireEvent.change(last4Input(), { target: { value: "4321" } });
    fireEvent.change(limitInput(), { target: { value: "300000" } });
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("closingDay")).toBe("1");
    expect(createdForm().get("dueDay")).toBe("15");
  });

  it("sends what was filled in, with the chosen mode, and closes", async () => {
    actions.createCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    fillCard();
    fireEvent.click(screen.getByRole("radio", { name: "Mastercard" }));
    fireEvent.click(screen.getByRole("radio", { name: /Total/ }));
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = createdForm();

    expect(sent.get("last4")).toBe("4321");
    expect(sent.get("brand")).toBe("MASTERCARD");
    expect(sent.get("closingDay")).toBe("25");
    expect(sent.get("dueDay")).toBe("5");
    expect(sent.get("currency")).toBe("ARS");
    expect(sent.get("limitMode")).toBe("TOTAL");
    expect(sent.get("limitAmount")).toBe("300000");
  });

  it("sends a monthly cap and Visa when nothing else was chosen", async () => {
    actions.createCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    fillCard();
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("brand")).toBe("VISA");
    expect(createdForm().get("limitMode")).toBe("MONTHLY");
  });

  it("shows 'Agregando tarjeta…' with a spinner, and locks Cancel, while it saves", async () => {
    const save = deferred<{ status: "success" }>();

    actions.createCardAction.mockReturnValue(save.promise);
    renderForm(null);

    fillCard();
    fireEvent.click(submitButton("Agregar tarjeta"));

    const pending = await screen.findByRole("button", {
      name: /Agregando tarjeta/,
    });

    expect(pending).toHaveTextContent("Agregando tarjeta…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Agregando tarjeta/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows a duplicate card on the last four digits and stays open", async () => {
    actions.createCardAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        last4: ["Ya tenés una tarjeta Visa terminada en 4321."],
      },
    });
    const { onClose } = renderForm(null);

    fillCard();
    fireEvent.click(submitButton("Agregar tarjeta"));

    expect(
      await screen.findByText("Ya tenés una tarjeta Visa terminada en 4321."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the server's field errors on the cap and the days", async () => {
    actions.createCardAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        limitAmount: ["El monto debe ser mayor que cero."],
        closingDay: [
          "El día de cierre debe ser un número entero entre 1 y 31.",
        ],
      },
    });
    renderForm(null);

    fillCard();
    fireEvent.click(submitButton("Agregar tarjeta"));

    expect(
      await screen.findByText("El monto debe ser mayor que cero."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "El día de cierre debe ser un número entero entre 1 y 31.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a general error when there are no field errors", async () => {
    actions.createCardAction.mockResolvedValue({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    renderForm(null);

    fillCard();
    fireEvent.click(submitButton("Agregar tarjeta"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo salió mal. Inténtalo de nuevo.",
    );
  });
});

const preview = () =>
  screen.getByRole("group", { name: "Vista previa de la tarjeta" });
const previewLogo = () =>
  preview().querySelector("[data-brand-logo]")?.getAttribute("data-brand-logo");

describe("the card preview", () => {
  it("shows a card preview at the top of the form, with the Visa logo by default", () => {
    renderForm(null);

    expect(preview()).toBeVisible();
    expect(previewLogo()).toBe("VISA");
    expect(preview()).toHaveTextContent("Visa");
    expect(preview().querySelector("[data-brand-logo]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("is rendered before the first field", () => {
    renderForm(null);

    expect(
      preview().compareDocumentPosition(last4Input()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the placeholder digits while the last four are empty", () => {
    renderForm(null);

    expect(preview()).toHaveTextContent("•••• •••• •••• ••••");
  });

  it("shows the last four digits as they are typed", () => {
    renderForm(null);

    fireEvent.change(last4Input(), { target: { value: "12" } });
    expect(preview()).toHaveTextContent("•••• •••• •••• 12••");

    fireEvent.change(last4Input(), { target: { value: "1234" } });
    expect(preview()).toHaveTextContent("•••• •••• •••• 1234");
  });

  it("changes its logo with the chosen brand", () => {
    renderForm(null);

    fireEvent.click(screen.getByRole("radio", { name: "Mastercard" }));
    expect(previewLogo()).toBe("MASTERCARD");
    expect(preview()).toHaveTextContent("Mastercard");

    fireEvent.click(screen.getByRole("radio", { name: "Otra" }));
    expect(previewLogo()).toBe("OTHER");
    expect(preview()).toHaveTextContent("Tarjeta");

    fireEvent.click(screen.getByRole("radio", { name: "Visa" }));
    expect(previewLogo()).toBe("VISA");
  });

  it("shows the closing and due day, and follows them", () => {
    renderForm(null);

    expect(preview()).toHaveTextContent("Cierra el día 1 · Vence el día 15");

    typeDay(closingInput(), "25");
    typeDay(dueInput(), "5");

    expect(preview()).toHaveTextContent("Cierra el día 25 · Vence el día 5");
  });

  it("starts from the stored card when editing", () => {
    renderForm(CARD);

    expect(previewLogo()).toBe("MASTERCARD");
    expect(preview()).toHaveTextContent("•••• •••• •••• 1234");
    expect(preview()).toHaveTextContent("Cierra el día 25 · Vence el día 5");
  });

  it("does not change what the form submits", async () => {
    actions.createCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    fillCard();
    fireEvent.click(screen.getByRole("radio", { name: "Otra" }));
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("last4")).toBe("4321");
    expect(createdForm().get("brand")).toBe("OTHER");
    expect(createdForm().get("closingDay")).toBe("25");
    expect(createdForm().get("dueDay")).toBe("5");
    expect(createdForm().getAll("brand")).toEqual(["OTHER"]);
  });
});

describe("edit mode", () => {
  it("is titled 'Editar tarjeta', with a plain Guardar cambios button, without a plus", () => {
    renderForm(CARD);

    expect(
      screen.getByRole("heading", { name: "Editar tarjeta" }),
    ).toBeInTheDocument();
    expect(submitButton("Guardar cambios").querySelector("svg")).toBeNull();
  });

  it("prefills every field from the card", () => {
    renderForm(CARD);

    expect(last4Input()).toHaveValue("1234");
    expect(screen.getByRole("radio", { name: "Mastercard" })).toBeChecked();
    expect(closingInput()).toHaveValue("25");
    expect(dueInput()).toHaveValue("5");
    expect(screen.getByRole("button", { name: /Moneda/ })).toHaveTextContent(
      "USD",
    );
    expect(screen.getByRole("radio", { name: /Total/ })).toBeChecked();
    expect(limitInput()).toHaveValue("1200.50");
  });

  it("keeps a monthly cap monthly", () => {
    renderForm({ ...CARD, limitMode: "MONTHLY" });

    expect(screen.getByRole("radio", { name: /Mensual/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Total/ })).not.toBeChecked();
  });

  it("saves through the update action with the card id and closes", async () => {
    actions.updateCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CARD);

    fireEvent.click(submitButton("Guardar cambios"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const [id, sent] = actions.updateCardAction.mock.calls[0] as [
      string,
      FormData,
    ];

    expect(id).toBe("card_1");
    expect(sent.get("last4")).toBe("1234");
    expect(sent.get("brand")).toBe("MASTERCARD");
    expect(sent.get("limitMode")).toBe("TOTAL");
    expect(sent.get("limitAmount")).toBe("1200.50");
    expect(actions.createCardAction).not.toHaveBeenCalled();
  });

  it("sends the other mode once it is switched, and only one of them", async () => {
    actions.updateCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CARD);

    fireEvent.click(screen.getByRole("radio", { name: /Mensual/ }));
    fireEvent.click(submitButton("Guardar cambios"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = actions.updateCardAction.mock.calls[0][1] as FormData;

    expect(sent.getAll("limitMode")).toEqual(["MONTHLY"]);
  });

  it("shows 'Guardando…' with a spinner, and locks Cancel, while it saves", async () => {
    const save = deferred<{ status: "success" }>();

    actions.updateCardAction.mockReturnValue(save.promise);
    renderForm(CARD);

    fireEvent.click(submitButton("Guardar cambios"));

    const pending = await screen.findByRole("button", { name: /Guardando/ });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(actions.updateCardAction).toHaveBeenCalledTimes(1),
    );
  });

  it("shows a general error when the card was not found", async () => {
    actions.updateCardAction.mockResolvedValue({
      status: "error",
      message: "No se encontró la tarjeta.",
    });
    renderForm(CARD);

    fireEvent.click(submitButton("Guardar cambios"));

    expect(
      await screen.findByText("No se encontró la tarjeta."),
    ).toBeInTheDocument();
  });
});
