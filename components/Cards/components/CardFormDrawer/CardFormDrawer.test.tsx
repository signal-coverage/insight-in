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

import type { BankChoice } from "@/core/banks/types";

import { creditCardRow, debitCardRow, limitRow } from "../../testRows";
import type { CardRow, FormTarget } from "../../types";
import { CardFormDrawer } from "./CardFormDrawer";

const BANKS: BankChoice[] = [
  { id: "bank_1", name: "Banco Galicia" },
  { id: "bank_2", name: "AstroPay" },
];

const CARD: CardRow = creditCardRow({
  brand: "MASTERCARD",
  title: "Mastercard •••• 1234",
  brandName: "Mastercard",
  limitMode: "TOTAL",
  limits: [
    limitRow({ currency: "ARS", limitDecimal: "300000.00" }),
    limitRow({ currency: "USD", limitDecimal: "1200.50" }),
  ],
});

const DEBIT: CardRow = debitCardRow();

const renderForm = (
  card: CardRow | null,
  banks: readonly BankChoice[] = BANKS,
) => {
  const onClose = vi.fn();
  const target: FormTarget = { key: 1, card };

  render(
    <CardFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
      banks={banks}
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
const amountInputs = () =>
  screen.getAllByRole("textbox", { name: /Monto del tope/ });
const currencyButtons = () =>
  screen.getAllByRole("button", { name: /Moneda del tope$/ });
const bankButton = () => screen.getByRole("button", { name: /Banco$/ });
const submitButton = (name: string) => screen.getByRole("button", { name });
const addLimitButton = () =>
  screen.getByRole("button", { name: "Agregar un tope en otra moneda" });

// A number field commits what was typed when it loses focus.
const typeDay = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

const pickOption = async (trigger: HTMLElement, name: string | RegExp) => {
  fireEvent.keyDown(trigger, { key: "ArrowDown" });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

const fillCredit = async () => {
  fireEvent.change(last4Input(), { target: { value: "4321" } });
  await pickOption(bankButton(), "Banco Galicia");
  fireEvent.change(amountInputs()[0], { target: { value: "300000" } });
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

  it("has an add button with the plus icon, and a Cancel", () => {
    renderForm(null);

    const button = submitButton("Agregar tarjeta");

    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("starts as a credit card, offering Crédito and Débito o prepago", () => {
    renderForm(null);

    const group = screen.getByRole("radiogroup", { name: "Tipo" });

    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual([
      expect.stringContaining("Crédito"),
      expect.stringContaining("Débito o prepago"),
    ]);
    expect(screen.getByRole("radio", { name: /Crédito/ })).toBeChecked();
  });

  it("asks a credit card for the bank, the digits, the brand, the two days, the kind of cap and one cap to start with", () => {
    renderForm(null);

    expect(bankButton()).toBeVisible();
    expect(last4Input()).toBeVisible();
    expect(screen.getByRole("radiogroup", { name: "Marca" })).toBeVisible();
    expect(closingInput()).toBeVisible();
    expect(dueInput()).toBeVisible();
    expect(
      screen.getByRole("radiogroup", { name: "Tipo de tope" }),
    ).toBeVisible();
    expect(amountInputs()).toHaveLength(1);
    expect(currencyButtons()[0]).toHaveTextContent("ARS");
  });

  it("asks a debit or prepaid card only for the bank, the digits and the brand", () => {
    renderForm(null);

    fireEvent.click(screen.getByRole("radio", { name: /Débito o prepago/ }));

    expect(bankButton()).toBeVisible();
    expect(last4Input()).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: /Día de cierre/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Tipo de tope" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /Monto del tope/ }),
    ).not.toBeInTheDocument();
  });

  describe("the bank", () => {
    it("starts with none chosen when the user has several", () => {
      renderForm(null);

      expect(bankButton()).toHaveTextContent("Elegí un banco");
    });

    it("is preselected when the user has only one active bank", () => {
      renderForm(null, [BANKS[0]]);

      expect(bankButton()).toHaveTextContent("Banco Galicia");
    });

    it("says so, and links to Bancos, when the user has no active bank", () => {
      renderForm(null, []);

      expect(
        screen.getByText(/Todavía no tenés bancos activos\./),
      ).toBeVisible();
      expect(
        screen.getByRole("link", { name: "Creá uno en Bancos" }),
      ).toHaveAttribute("href", "/dashboard/banks");
    });

    it("has no such notice when there are banks", () => {
      renderForm(null);

      expect(
        screen.queryByText(/Todavía no tenés bancos activos\./),
      ).not.toBeInTheDocument();
    });
  });

  describe("the caps", () => {
    it("adds a cap in the next free currency, and never offers a currency twice", async () => {
      renderForm(null);

      fireEvent.click(addLimitButton());

      expect(amountInputs()).toHaveLength(2);
      expect(currencyButtons()[1]).toHaveTextContent("USD");

      fireEvent.keyDown(currencyButtons()[1], { key: "ArrowDown" });

      const options = await screen.findAllByRole("option");
      const codes = options.map((option) => option.textContent?.slice(0, 3));

      expect(codes).toContain("USD");
      expect(codes).toContain("EUR");
      expect(codes).not.toContain("ARS");
    });

    it("removes a cap, but never the last one", () => {
      renderForm(null);

      expect(
        screen.getByRole("button", { name: "Quitar el tope en ARS" }),
      ).toBeDisabled();

      fireEvent.click(addLimitButton());
      fireEvent.click(
        screen.getByRole("button", { name: "Quitar el tope en USD" }),
      );

      expect(amountInputs()).toHaveLength(1);
    });

    it("says what a cap means", () => {
      renderForm(null);

      expect(
        screen.getByText(
          "Cada tope puede ser el límite real de la tarjeta o uno menor que quieras respetar. Los topes de distintas monedas nunca se suman.",
        ),
      ).toBeVisible();
    });
  });

  it("sends a credit card with its kind, bank, days, mode and caps as pairs, in the order shown, and closes", async () => {
    actions.createCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    await fillCredit();
    fireEvent.click(addLimitButton());
    fireEvent.change(amountInputs()[1], { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("radio", { name: /Total/ }));
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = createdForm();

    expect(sent.get("kind")).toBe("CREDIT");
    expect(sent.get("bankId")).toBe("bank_1");
    expect(sent.get("last4")).toBe("4321");
    expect(sent.get("brand")).toBe("VISA");
    expect(sent.get("closingDay")).toBe("1");
    expect(sent.get("dueDay")).toBe("15");
    expect(sent.get("limitMode")).toBe("TOTAL");
    expect(sent.getAll("limitCurrency")).toEqual(["ARS", "USD"]);
    expect(sent.getAll("limitAmount")).toEqual(["300000", "1000"]);
  });

  it("sends a debit card with no field only a credit card has", async () => {
    actions.createCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    fireEvent.click(screen.getByRole("radio", { name: /Débito o prepago/ }));
    fireEvent.change(last4Input(), { target: { value: "9999" } });
    await pickOption(bankButton(), "AstroPay");
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = createdForm();

    expect(sent.get("kind")).toBe("DEBIT");
    expect(sent.get("bankId")).toBe("bank_2");
    expect(sent.get("last4")).toBe("9999");
    expect(sent.get("closingDay")).toBeNull();
    expect(sent.get("limitMode")).toBeNull();
    expect(sent.getAll("limitCurrency")).toEqual([]);
  });

  it("does not send the form while a cap amount is missing", async () => {
    renderForm(null);

    fireEvent.change(last4Input(), { target: { value: "4321" } });
    await pickOption(bankButton(), "Banco Galicia");
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(amountInputs()[0]).toBeInvalid());
    expect(actions.createCardAction).not.toHaveBeenCalled();
  });

  it("shows the server's error on the cap it is about", async () => {
    actions.createCardAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        "limits.0.amount": ["El monto debe ser mayor que cero."],
      },
    });
    const { onClose } = renderForm(null);

    await fillCredit();
    fireEvent.click(submitButton("Agregar tarjeta"));

    expect(
      await screen.findByText("El monto debe ser mayor que cero."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the server's error on the list of caps", async () => {
    actions.createCardAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { limits: ["Agregá al menos un tope."] },
    });
    const { onClose } = renderForm(null);

    await fillCredit();
    fireEvent.click(submitButton("Agregar tarjeta"));

    expect(
      await screen.findByText("Agregá al menos un tope."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the server's error on the bank and on the last four digits", async () => {
    actions.createCardAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        bankId: ["Elegí un banco válido."],
        last4: ["Ya tenés una tarjeta Visa terminada en 4321."],
      },
    });
    renderForm(null);

    await fillCredit();
    fireEvent.click(submitButton("Agregar tarjeta"));

    expect(
      await screen.findByText("Elegí un banco válido."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ya tenés una tarjeta Visa terminada en 4321."),
    ).toBeInTheDocument();
  });

  it("starts with Visa chosen, offering Visa, Mastercard and Otra as brands", () => {
    renderForm(null);

    const group = screen.getByRole("radiogroup", { name: "Marca" });

    expect(screen.getByRole("radio", { name: "Visa" })).toBeChecked();
    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual(["Visa", "Mastercard", "Otra"]);
  });

  it("starts a credit card with a monthly cap, and says what each kind of cap means", () => {
    renderForm(null);

    expect(screen.getByRole("radio", { name: /Mensual/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Total/ })).not.toBeChecked();
    expect(
      screen.getByText("Lo máximo que querés pagar por mes con esta tarjeta"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Lo máximo que querés tener comprometido en cuotas pendientes",
      ),
    ).toBeVisible();
  });

  it("says what the closing and the due day are", () => {
    renderForm(null);

    expect(
      screen.getByText("El día del mes en que cierra el resumen"),
    ).toBeVisible();
    expect(
      screen.getByText("El día del mes en que se paga el resumen"),
    ).toBeVisible();
  });

  it("sends a monthly cap and Visa when nothing else was chosen", async () => {
    actions.createCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    await fillCredit();
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("brand")).toBe("VISA");
    expect(createdForm().get("limitMode")).toBe("MONTHLY");
  });

  it("sends the days and the brand that were typed and chosen", async () => {
    actions.createCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    await fillCredit();
    fireEvent.click(screen.getByRole("radio", { name: "Mastercard" }));
    typeDay(closingInput(), "25");
    typeDay(dueInput(), "5");
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("brand")).toBe("MASTERCARD");
    expect(createdForm().get("closingDay")).toBe("25");
    expect(createdForm().get("dueDay")).toBe("5");
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

    await fillCredit();
    fireEvent.click(submitButton("Agregar tarjeta"));

    expect(
      await screen.findByText("Ya tenés una tarjeta Visa terminada en 4321."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the server's error on the days", async () => {
    actions.createCardAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        closingDay: [
          "El día de cierre debe ser un número entero entre 1 y 31.",
        ],
      },
    });
    renderForm(null);

    await fillCredit();
    fireEvent.click(submitButton("Agregar tarjeta"));

    expect(
      await screen.findByText(
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

    await fillCredit();
    fireEvent.click(submitButton("Agregar tarjeta"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo salió mal. Inténtalo de nuevo.",
    );
  });

  it("shows 'Agregando tarjeta…' with a spinner, and locks Cancel, while it saves", async () => {
    const save = deferred<{ status: "success" }>();

    actions.createCardAction.mockReturnValue(save.promise);
    renderForm(null);

    await fillCredit();
    fireEvent.click(submitButton("Agregar tarjeta"));

    const pending = await screen.findByRole("button", {
      name: /Agregando tarjeta/,
    });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Agregando tarjeta/ }),
      ).not.toBeInTheDocument(),
    );
  });

  describe("the last four digits", () => {
    it("takes four digits at most, and a numeric keyboard", () => {
      renderForm(null);

      expect(last4Input()).toHaveAttribute("maxlength", "4");
      expect(last4Input()).toHaveAttribute("inputmode", "numeric");
    });

    it("keeps leading zeros", () => {
      renderForm(null);

      fireEvent.change(last4Input(), { target: { value: "0042" } });

      expect(last4Input()).toHaveValue("0042");
    });

    it("keeps only digits, leading zeros included", () => {
      renderForm(null);

      fireEvent.change(last4Input(), { target: { value: "0a4-b2" } });

      expect(last4Input()).toHaveValue("042");
    });
  });

  it("keeps the days between 1 and 31, starting on day 1 and day 15", () => {
    renderForm(null);

    expect(closingInput()).toHaveValue("1");
    expect(dueInput()).toHaveValue("15");

    typeDay(closingInput(), "45");
    typeDay(dueInput(), "0");

    expect(closingInput()).toHaveValue("31");
    expect(dueInput()).toHaveValue("1");
  });
});

const preview = () =>
  screen.getByRole("group", { name: "Vista previa de la tarjeta" });

describe("the card preview", () => {
  it("shows the Visa logo and the cycle of a new credit card", () => {
    renderForm(null);

    expect(
      preview()
        .querySelector("[data-brand-logo]")
        ?.getAttribute("data-brand-logo"),
    ).toBe("VISA");
    expect(preview()).toHaveTextContent("Cierra el día 1 · Vence el día 15");
  });

  it("follows the digits and the days as they are typed", () => {
    renderForm(null);

    fireEvent.change(last4Input(), { target: { value: "12" } });
    typeDay(closingInput(), "25");
    typeDay(dueInput(), "5");

    expect(preview()).toHaveTextContent("•••• •••• •••• 12••");
    expect(preview()).toHaveTextContent("Cierra el día 25 · Vence el día 5");
  });

  it("draws the logo as decoration, names the brand, and sits before the first field", () => {
    renderForm(null);

    expect(preview().querySelector("[data-brand-logo]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(preview()).toHaveTextContent("Visa");
    expect(
      preview().compareDocumentPosition(last4Input()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the placeholder digits while the last four are empty", () => {
    renderForm(null);

    expect(preview()).toHaveTextContent("•••• •••• •••• ••••");
  });

  it("changes its logo with the chosen brand", () => {
    renderForm(null);

    const logo = () =>
      preview()
        .querySelector("[data-brand-logo]")
        ?.getAttribute("data-brand-logo");

    fireEvent.click(screen.getByRole("radio", { name: "Mastercard" }));
    expect(logo()).toBe("MASTERCARD");
    expect(preview()).toHaveTextContent("Mastercard");

    fireEvent.click(screen.getByRole("radio", { name: "Otra" }));
    expect(logo()).toBe("OTHER");
    expect(preview()).toHaveTextContent("Tarjeta");

    fireEvent.click(screen.getByRole("radio", { name: "Visa" }));
    expect(logo()).toBe("VISA");
  });

  it("starts from the stored card when editing", () => {
    renderForm(CARD);

    expect(
      preview()
        .querySelector("[data-brand-logo]")
        ?.getAttribute("data-brand-logo"),
    ).toBe("MASTERCARD");
    expect(preview()).toHaveTextContent("•••• •••• •••• 1234");
    expect(preview()).toHaveTextContent("Cierra el día 25 · Vence el día 5");
  });

  it("does not change what the form submits", async () => {
    actions.createCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    await fillCredit();
    fireEvent.click(screen.getByRole("radio", { name: "Otra" }));
    fireEvent.click(submitButton("Agregar tarjeta"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("last4")).toBe("4321");
    expect(createdForm().getAll("brand")).toEqual(["OTHER"]);
  });

  it("says Débito o prepago instead of a cycle for a debit card", () => {
    renderForm(null);

    fireEvent.click(screen.getByRole("radio", { name: /Débito o prepago/ }));

    expect(preview()).toHaveTextContent("Débito o prepago");
    expect(preview()).not.toHaveTextContent("Cierra el día");
  });
});

describe("edit mode", () => {
  it("is titled 'Editar tarjeta', with a plain Guardar cambios button", () => {
    renderForm(CARD);

    expect(
      screen.getByRole("heading", { name: "Editar tarjeta" }),
    ).toBeInTheDocument();
    expect(submitButton("Guardar cambios").querySelector("svg")).toBeNull();
  });

  it("shows the kind and the bank, which cannot change, instead of choosing them", () => {
    renderForm(CARD);

    expect(screen.getByText("Crédito · Banco Galicia")).toBeVisible();
    expect(
      screen.getByText(
        "El tipo y el banco de una tarjeta no se pueden cambiar.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("radiogroup", { name: "Tipo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Banco$/ }),
    ).not.toBeInTheDocument();
  });

  it("prefills every field from the card, one row per cap", () => {
    renderForm(CARD);

    expect(last4Input()).toHaveValue("1234");
    expect(screen.getByRole("radio", { name: "Mastercard" })).toBeChecked();
    expect(closingInput()).toHaveValue("25");
    expect(dueInput()).toHaveValue("5");
    expect(screen.getByRole("radio", { name: /Total/ })).toBeChecked();
    expect(
      currencyButtons().map((button) => button.textContent?.slice(0, 3)),
    ).toEqual(["ARS", "USD"]);
    expect(
      amountInputs().map((input) => (input as HTMLInputElement).value),
    ).toEqual(["300000.00", "1200.50"]);
  });

  it("saves through the update action with the stored kind and bank, and closes", async () => {
    actions.updateCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CARD);

    fireEvent.click(submitButton("Guardar cambios"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const [id, sent] = actions.updateCardAction.mock.calls[0] as [
      string,
      FormData,
    ];

    expect(id).toBe("card_1");
    expect(sent.get("kind")).toBe("CREDIT");
    expect(sent.get("bankId")).toBe("bank_1");
    expect(sent.get("limitMode")).toBe("TOTAL");
    expect(sent.getAll("limitCurrency")).toEqual(["ARS", "USD"]);
    expect(sent.getAll("limitAmount")).toEqual(["300000.00", "1200.50"]);
    expect(actions.createCardAction).not.toHaveBeenCalled();
  });

  it("edits a debit card with only its digits and brand", async () => {
    actions.updateCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(DEBIT);

    expect(screen.getByText("Débito o prepago · AstroPay")).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: /Día de cierre/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(submitButton("Guardar cambios"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = actions.updateCardAction.mock.calls[0][1] as FormData;

    expect(sent.get("kind")).toBe("DEBIT");
    expect(sent.get("bankId")).toBe("bank_2");
    expect(sent.getAll("limitCurrency")).toEqual([]);
  });

  it("keeps a monthly cap monthly, and sends only the mode that is chosen once it is switched", async () => {
    actions.updateCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm({ ...CARD, limitMode: "MONTHLY" });

    expect(screen.getByRole("radio", { name: /Mensual/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Total/ })).not.toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: /Total/ }));
    fireEvent.click(submitButton("Guardar cambios"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const sent = actions.updateCardAction.mock.calls[0][1] as FormData;

    expect(sent.getAll("limitMode")).toEqual(["TOTAL"]);
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

  it("shows the server's refusal of a change of kind", async () => {
    actions.updateCardAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { kind: ["El tipo de una tarjeta no se puede cambiar."] },
    });
    renderForm(CARD);

    fireEvent.click(submitButton("Guardar cambios"));

    expect(
      await screen.findByText("El tipo de una tarjeta no se puede cambiar."),
    ).toBeInTheDocument();
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
