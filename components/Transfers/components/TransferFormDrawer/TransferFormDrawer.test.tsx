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
  createTransferAction: vi.fn(),
  updateTransferAction: vi.fn(),
}));

vi.mock("@/core/transfers/actions", () => actions);

import { CRYPTO_CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";
import type { AccountChoice } from "@/core/accounts/types";

import type { FormTarget, TransferRow } from "../../types";
import { TransferFormDrawer } from "./TransferFormDrawer";

const ACCOUNTS: AccountChoice[] = [
  {
    id: "galicia",
    currency: "ARS",
    label: "Galicia · Caja de ahorro",
    archived: false,
  },
  {
    id: "cash",
    currency: "ARS",
    label: "Efectivo · Efectivo",
    archived: false,
  },
  { id: "old", currency: "ARS", label: "Nación · Vieja", archived: true },
  {
    id: "dollars",
    currency: "USD",
    label: "Galicia · Dólares",
    archived: false,
  },
];

const ROW: TransferRow = {
  id: "tr_1",
  fromAccountId: "galicia",
  toAccountId: "old",
  fromLabel: "Galicia · Caja de ahorro",
  toLabel: "Nación · Vieja",
  currency: "ARS",
  amount: 150050,
  date: "2026-10-03",
  notes: "Alquiler",
  amountLabel: "$ 1.500,50",
  amountDecimal: "1500.50",
  dateLabel: "3 oct 2026",
};

const CREATE: FormTarget = {
  key: 1,
  transfer: null,
  defaultDate: "2026-10-06",
};
const EDIT: FormTarget = { key: 2, transfer: ROW, defaultDate: "2026-10-06" };

const renderForm = (
  target: FormTarget,
  accounts: readonly AccountChoice[] = ACCOUNTS,
) => {
  const onClose = vi.fn();

  render(
    <TransferFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
      accounts={accounts}
    />,
  );

  return { onClose };
};

const fromTrigger = () =>
  screen.getByRole("button", { name: /Cuenta de origen/ });
const toTrigger = () =>
  screen.getByRole("button", { name: /Cuenta de destino/ });
const currencyTrigger = () => screen.getByRole("button", { name: /Moneda/ });
const amountInput = () => screen.getByRole("textbox", { name: /Monto/ });
const submit = () =>
  screen.getByRole("button", { name: /Crear transferencia|Guardar cambios/ });

const pick = async (trigger: HTMLElement, name: string | RegExp) => {
  fireEvent.keyDown(trigger, { key: "ArrowDown" });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

const sent = (action: ReturnType<typeof vi.fn>, index = 0): FormData =>
  action.mock.calls[0][index] as FormData;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("is titled 'Crear transferencia' and says it counts as neither income nor expense", () => {
    renderForm(CREATE);

    expect(
      screen.getByRole("heading", { name: "Crear transferencia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no cuenta como ingreso ni como gasto/i),
    ).toBeVisible();
  });

  it("starts in pesos with nothing chosen yet when there are two accounts", () => {
    renderForm(CREATE);

    expect(currencyTrigger()).toHaveTextContent("ARS");
    expect(fromTrigger()).toHaveTextContent("Elegí una cuenta");
    expect(toTrigger()).toHaveTextContent("Elegí una cuenta");
    expect(amountInput()).toHaveValue("");
  });

  it("never offers, as the destination, the account chosen as the source", async () => {
    renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    fireEvent.keyDown(toTrigger(), { key: "ArrowDown" });

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "Efectivo · Efectivo",
    ]);
  });

  it("offers no archived account on a new transfer", async () => {
    renderForm(CREATE);

    fireEvent.keyDown(fromTrigger(), { key: "ArrowDown" });

    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "Galicia · Caja de ahorro",
      "Efectivo · Efectivo",
    ]);
  });

  it("drops both accounts when the currency changes", async () => {
    renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    await pick(currencyTrigger(), /^USD - /);

    expect(fromTrigger()).toHaveTextContent("Galicia · Dólares");
    expect(toTrigger()).toHaveTextContent("Elegí una cuenta");
  });

  it("says another account is needed when the currency has only one", async () => {
    renderForm(CREATE, [ACCOUNTS[0]]);

    expect(screen.getByText(/Necesitás otra cuenta en ARS/)).toBeVisible();
  });

  it("sends the currency, both accounts, the amount, the date and the notes, and closes on success", async () => {
    actions.createTransferAction.mockResolvedValue({ status: "success" });

    const { onClose } = renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    await pick(toTrigger(), "Efectivo · Efectivo");
    fireEvent.change(amountInput(), { target: { value: "1500.50" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Notas/ }), {
      target: { value: "Retiro" },
    });
    fireEvent.click(submit());

    await waitFor(() =>
      expect(actions.createTransferAction).toHaveBeenCalledTimes(1),
    );

    const form = sent(actions.createTransferAction);

    expect(form.get("currency")).toBe("ARS");
    expect(form.get("fromAccountId")).toBe("galicia");
    expect(form.get("toAccountId")).toBe("cash");
    expect(form.get("amount")).toBe("1500.50");
    expect(form.get("date")).toBe("2026-10-06");
    expect(form.get("notes")).toBe("Retiro");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the server's insufficient-funds message under the amount and stays open", async () => {
    actions.createTransferAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        amount: [
          "La cuenta de origen no tiene fondos suficientes: a esa fecha tenía $ 10,00.",
        ],
      },
    });

    const { onClose } = renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    await pick(toTrigger(), "Efectivo · Efectivo");
    fireEvent.change(amountInput(), { target: { value: "999" } });
    fireEvent.click(submit());

    expect(
      await screen.findByText(/no tiene fondos suficientes/),
    ).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows an account refusal under the field of its side", async () => {
    actions.createTransferAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        toAccountId: [
          "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
        ],
      },
    });

    renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    await pick(toTrigger(), "Efectivo · Efectivo");
    fireEvent.change(amountInput(), { target: { value: "5" } });
    fireEvent.click(submit());

    expect(await screen.findByText(/Esta cuenta está archivada/)).toBeVisible();
  });

  it("shows a general failure in an alert", async () => {
    actions.createTransferAction.mockResolvedValue({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });

    renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    await pick(toTrigger(), "Efectivo · Efectivo");
    fireEvent.change(amountInput(), { target: { value: "5" } });
    fireEvent.click(submit());

    expect(
      await screen.findByText("Algo salió mal. Inténtalo de nuevo."),
    ).toBeVisible();
  });

  it("locks the buttons and says it is working while the action is on its way", async () => {
    actions.createTransferAction.mockReturnValue(new Promise(() => {}));

    renderForm(CREATE);

    await pick(fromTrigger(), "Galicia · Caja de ahorro");
    await pick(toTrigger(), "Efectivo · Efectivo");
    fireEvent.change(amountInput(), { target: { value: "5" } });
    fireEvent.click(submit());

    expect(await screen.findByText("Creando transferencia…")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});

describe("edit mode", () => {
  it("is titled 'Editar transferencia' and starts from what the transfer has", () => {
    renderForm(EDIT);

    expect(
      screen.getByRole("heading", { name: "Editar transferencia" }),
    ).toBeInTheDocument();
    expect(currencyTrigger()).toHaveTextContent("ARS");
    expect(fromTrigger()).toHaveTextContent("Galicia · Caja de ahorro");
    expect(amountInput()).toHaveValue("1500.50");
    expect(screen.getByRole("textbox", { name: /Notas/ })).toHaveValue(
      "Alquiler",
    );
  });

  it("keeps an account that was archived since on its side, marked as such", () => {
    renderForm(EDIT);

    expect(toTrigger()).toHaveTextContent("Nación · Vieja (archivada)");
  });

  it("shows, under the amount, the refusal to take money back from the old destination, and stays open", async () => {
    const message =
      "No se puede deshacer: Nación · Vieja tiene $ 8,00 y tendría que devolver $ 10,00.";

    actions.updateTransferAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { amount: [message] },
    });

    const { onClose } = renderForm(EDIT);

    fireEvent.change(amountInput(), { target: { value: "1400.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("updates through the action with the id of the transfer", async () => {
    actions.updateTransferAction.mockResolvedValue({ status: "success" });

    const { onClose } = renderForm(EDIT);

    fireEvent.change(screen.getByRole("textbox", { name: /Notas/ }), {
      target: { value: "Otra nota" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(actions.updateTransferAction).toHaveBeenCalledTimes(1),
    );
    expect(actions.updateTransferAction.mock.calls[0][0]).toBe("tr_1");
    expect(sent(actions.updateTransferAction, 1).get("toAccountId")).toBe(
      "old",
    );
    expect(sent(actions.updateTransferAction, 1).get("notes")).toBe(
      "Otra nota",
    );
    expect(actions.createTransferAction).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

// Each case fills a form, saves it and then changes a select: slow under a loaded full run.
describe(
  "server field errors after a refused save",
  { timeout: 20_000 },
  () => {
    const FUNDS =
      "La cuenta de origen no tiene fondos suficientes: a esa fecha tenía $ 10,00.";

    // A third active account, so each side has something else to change to.
    const THIRD: AccountChoice = {
      id: "nacion",
      currency: "ARS",
      label: "Nación · Caja",
      archived: false,
    };

    const refuseOnFunds = async () => {
      actions.createTransferAction.mockResolvedValue({
        status: "error",
        message: "Corrige los campos resaltados.",
        fieldErrors: { amount: [FUNDS] },
      });
      renderForm(CREATE, [...ACCOUNTS, THIRD]);

      await pick(fromTrigger(), "Galicia · Caja de ahorro");
      await pick(toTrigger(), "Efectivo · Efectivo");
      fireEvent.change(amountInput(), { target: { value: "999" } });
      fireEvent.click(submit());

      expect(await screen.findByText(FUNDS)).toBeInTheDocument();
    };

    it("keeps the refusal while the user edits something that cannot change the verdict", async () => {
      await refuseOnFunds();

      fireEvent.change(screen.getByRole("textbox", { name: /Notas/ }), {
        target: { value: "Una nota" },
      });

      expect(screen.getByText(FUNDS)).toBeInTheDocument();
    });

    it("clears it when the source account is changed", async () => {
      await refuseOnFunds();

      await pick(fromTrigger(), "Nación · Caja");

      expect(screen.queryByText(FUNDS)).not.toBeInTheDocument();
    });

    it("clears it when the destination account is changed", async () => {
      await refuseOnFunds();

      await pick(toTrigger(), "Nación · Caja");

      expect(screen.queryByText(FUNDS)).not.toBeInTheDocument();
    });

    it("clears it when the currency is changed", async () => {
      await refuseOnFunds();

      await pick(currencyTrigger(), /^USD - /);

      expect(screen.queryByText(FUNDS)).not.toBeInTheDocument();
    });

    it("clears it when the date is changed", async () => {
      await refuseOnFunds();

      fireEvent.click(screen.getByRole("button", { name: /calendar/i }));

      const grid = await screen.findByRole("grid");
      const day = Array.from(grid.querySelectorAll('[role="button"]')).find(
        (cell) =>
          cell.textContent === "15" && !cell.hasAttribute("data-outside-month"),
      );

      expect(day).toBeDefined();
      fireEvent.click(day!);

      await waitFor(() =>
        expect(screen.queryByText(FUNDS)).not.toBeInTheDocument(),
      );
    });
  },
);

describe("a transfer in a crypto currency", () => {
  const WALLET_ACCOUNTS: AccountChoice[] = [
    ...ACCOUNTS,
    {
      id: "mp_usdc",
      currency: "USDC",
      label: "Mercado Pago · USDC",
      archived: false,
    },
    {
      id: "astro_usdc",
      currency: "USDC",
      label: "AstroPay · USDC",
      archived: false,
    },
  ];

  it("lists the crypto currencies after the legal-tender ones", async () => {
    renderForm(CREATE);

    fireEvent.keyDown(currencyTrigger(), { key: "ArrowDown" });

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(within(listbox).getByText("Criptomonedas")).toBeInTheDocument();
    expect(options.slice(-CRYPTO_CURRENCY_OPTIONS.length)).toEqual(
      CRYPTO_CURRENCY_OPTIONS.map(({ label }) => label),
    );
  });

  it("moves a crypto currency between two wallet accounts", async () => {
    actions.createTransferAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CREATE, WALLET_ACCOUNTS);

    await pick(currencyTrigger(), "USDC - USD Coin");
    await pick(fromTrigger(), "Mercado Pago · USDC");
    await pick(toTrigger(), "AstroPay · USDC");
    fireEvent.change(amountInput(), { target: { value: "1.5" } });
    fireEvent.click(submit());

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const form = sent(actions.createTransferAction);

    expect(form.get("currency")).toBe("USDC");
    expect(form.get("fromAccountId")).toBe("mp_usdc");
    expect(form.get("toAccountId")).toBe("astro_usdc");
    expect(form.get("amount")).toBe("1.5");
  });
});
