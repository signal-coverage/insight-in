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
  createAccountAction: vi.fn(),
  updateAccountAction: vi.fn(),
  archiveAccountAction: vi.fn(),
  unarchiveAccountAction: vi.fn(),
  deleteAccountAction: vi.fn(),
}));

vi.mock("@/core/accounts/actions", () => actions);

import type { Bank, BoardAccount } from "@/core/banks/types";

import type { AccountFormTarget } from "../../types";
import { AccountFormDrawer } from "./AccountFormDrawer";

const CASH: Bank = {
  id: "bank_cash",
  name: "Efectivo",
  kind: "ENTITY",
  archived: false,
};
const GALICIA: Bank = {
  id: "bank_galicia",
  name: "Banco Galicia",
  kind: "ENTITY",
  archived: false,
};

const ACCOUNT: BoardAccount = {
  id: "acc_1",
  bankId: "bank_galicia",
  name: "Cuenta en dólares",
  currency: "USD",
  archived: false,
  balance: 0,
  balanceLabel: "US$ 0,00",
  hasMovements: false,
};

const renderForm = (
  target: AccountFormTarget,
  banks: readonly Bank[] = [CASH, GALICIA],
) => {
  const onClose = vi.fn();

  render(
    <AccountFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
      banks={banks}
    />,
  );

  return { onClose };
};

const CREATE: AccountFormTarget = { key: 1, account: null, bankId: null };
const edit = (account: BoardAccount): AccountFormTarget => ({
  key: 2,
  account,
  bankId: null,
});

const nameInput = () => screen.getByRole("textbox", { name: /Nombre/ });
const bankTrigger = () => screen.getByRole("button", { name: /Banco$/ });
const currencyTrigger = () => screen.getByRole("button", { name: /Moneda/ });
const sentForm = (action: ReturnType<typeof vi.fn>, index = 0): FormData =>
  action.mock.calls[0][index] as FormData;

const pickBank = async (name: string) => {
  fireEvent.keyDown(bankTrigger(), { key: "ArrowDown" });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("is titled 'Crear cuenta' and says an account holds one currency", () => {
    renderForm(CREATE);

    expect(
      screen.getByRole("heading", { name: "Crear cuenta" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/guarda dinero en una sola moneda/)).toBeVisible();
  });

  it("asks for the bank, the name and the currency, and offers no archive", () => {
    renderForm(CREATE);

    expect(bankTrigger()).toBeVisible();
    expect(nameInput()).toHaveValue("");
    expect(nameInput()).toHaveAttribute("maxlength", "40");
    expect(currencyTrigger()).toHaveTextContent("ARS");
    expect(
      screen.queryByRole("button", { name: "Archivar cuenta" }),
    ).toBeNull();
  });

  it("has a create button with the plus icon, and a Cancel", () => {
    renderForm(CREATE);

    const button = screen.getByRole("button", { name: "Crear cuenta" });

    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("starts with the bank whose '+ Nueva cuenta' card was pressed", () => {
    renderForm({ key: 1, account: null, bankId: "bank_galicia" });

    expect(bankTrigger()).toHaveTextContent("Banco Galicia");
  });

  it("starts with the only bank when there is exactly one", () => {
    renderForm(CREATE, [CASH]);

    expect(bankTrigger()).toHaveTextContent("Efectivo");
  });

  it("asks to choose a bank when there are several and none was asked for", () => {
    renderForm(CREATE);

    expect(bankTrigger()).toHaveTextContent("Seleccioná un banco");
  });

  it("offers only the banks it is given", async () => {
    renderForm(CREATE);

    fireEvent.keyDown(bankTrigger(), { key: "ArrowDown" });

    expect(
      await screen.findByRole("option", { name: "Efectivo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Banco Galicia" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("sends the bank, the name and the currency through the create action, and closes", async () => {
    actions.createAccountAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CREATE);

    await pickBank("Banco Galicia");
    fireEvent.change(nameInput(), { target: { value: "Caja de ahorro" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const form = sentForm(actions.createAccountAction);

    expect(form.get("bankId")).toBe("bank_galicia");
    expect(form.get("name")).toBe("Caja de ahorro");
    expect(form.get("currency")).toBe("ARS");
    expect(actions.updateAccountAction).not.toHaveBeenCalled();
  });

  it("shows 'Creando cuenta…' with a spinner and locks Cancel while it saves", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.createAccountAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onClose } = renderForm({
      key: 1,
      account: null,
      bankId: "bank_cash",
    });

    fireEvent.change(nameInput(), { target: { value: "Caja" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    const pending = await screen.findByRole("button", {
      name: /Creando cuenta/,
    });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    finish({ status: "success" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the error of the name field the server refused, and stays open", async () => {
    actions.createAccountAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        name: ["Ya tenés una cuenta con este nombre en este banco."],
      },
    });
    const { onClose } = renderForm({
      key: 1,
      account: null,
      bankId: "bank_cash",
    });

    fireEvent.change(nameInput(), { target: { value: "efectivo" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByText(
        "Ya tenés una cuenta con este nombre en este banco.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a failure that belongs to no field (an archived bank) as an alert", async () => {
    actions.createAccountAction.mockResolvedValue({
      status: "error",
      message: "Este banco está archivado. Reactivalo primero.",
    });
    renderForm({ key: 1, account: null, bankId: "bank_cash" });

    fireEvent.change(nameInput(), { target: { value: "Caja" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este banco está archivado. Reactivalo primero.",
    );
  });

  it("with no banks, says to create one first and cannot be submitted", () => {
    renderForm(CREATE, []);

    expect(
      screen.getByText("Primero creá un banco para poder agregarle cuentas."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /Banco$/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeDisabled();
  });

  it("finds the bank trigger with the same query when there are banks (the negative checks are meaningful)", () => {
    renderForm(CREATE);

    expect(screen.queryByRole("button", { name: /Banco$/ })).not.toBeNull();
  });
});

describe("edit mode", () => {
  it("is titled 'Editar cuenta' and starts with the name and the currency of the account", () => {
    renderForm(edit(ACCOUNT));

    expect(
      screen.getByRole("heading", { name: "Editar cuenta" }),
    ).toBeInTheDocument();
    expect(nameInput()).toHaveValue("Cuenta en dólares");
    expect(currencyTrigger()).toHaveTextContent("USD");
  });

  it("has no bank to choose: an edit never moves an account", () => {
    renderForm(edit(ACCOUNT));

    expect(screen.queryByRole("button", { name: /Banco$/ })).toBeNull();
    // The same query finds the trigger in create mode (see the positive case above).
    expect(currencyTrigger()).toBeVisible();
  });

  it("saves through the update action with the id of the account, and never sends a bank", async () => {
    actions.updateAccountAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit(ACCOUNT));

    fireEvent.change(nameInput(), { target: { value: "Dólares" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.updateAccountAction.mock.calls[0][0]).toBe("acc_1");

    const form = sentForm(actions.updateAccountAction, 1);

    expect(form.get("name")).toBe("Dólares");
    expect(form.get("currency")).toBe("USD");
    expect(form.has("bankId")).toBe(false);
    expect(actions.createAccountAction).not.toHaveBeenCalled();
  });

  it("archives the account through the archive action, and closes", async () => {
    actions.archiveAccountAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit(ACCOUNT));

    fireEvent.click(screen.getByRole("button", { name: "Archivar cuenta" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.archiveAccountAction).toHaveBeenCalledWith("acc_1");
  });

  it("tells an active account that it is archived only at zero and with nothing pending or recurring", () => {
    renderForm(edit(ACCOUNT));

    expect(
      screen.getByText(
        "Solo podés archivar una cuenta en cero, sin movimientos pendientes ni recurrentes. No se borra nada y podés reactivarla cuando quieras.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/no aparece en el tablero salvo que muestres/),
    ).toBeNull();
  });

  it("tells an archived account how to come back, not the archive rules", () => {
    renderForm(edit({ ...ACCOUNT, archived: true }));

    expect(
      screen.getByText(/no aparece en el tablero salvo que muestres/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Solo podés archivar una cuenta en cero/),
    ).toBeNull();
  });

  it("offers to reactivate an archived account instead, through the unarchive action", async () => {
    actions.unarchiveAccountAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit({ ...ACCOUNT, archived: true }));

    expect(
      screen.queryByRole("button", { name: "Archivar cuenta" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reactivar cuenta" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.unarchiveAccountAction).toHaveBeenCalledWith("acc_1");
    expect(actions.archiveAccountAction).not.toHaveBeenCalled();
  });

  it("explains that the bank must be reactivated first when the server refuses to bring the account back", async () => {
    actions.unarchiveAccountAction.mockResolvedValue({
      status: "error",
      message: "Este banco está archivado. Reactivalo primero.",
    });
    const { onClose } = renderForm(edit({ ...ACCOUNT, archived: true }));

    fireEvent.click(screen.getByRole("button", { name: "Reactivar cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este banco está archivado. Reactivalo primero.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows only the alert, not an older field error, when archiving fails after a refused save", async () => {
    actions.updateAccountAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        name: ["Ya tenés una cuenta con este nombre en este banco."],
      },
    });
    actions.archiveAccountAction.mockResolvedValue({
      status: "error",
      message: "No se encontró la cuenta.",
    });
    renderForm(edit(ACCOUNT));

    fireEvent.change(nameInput(), { target: { value: "Dólares" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText(
        "Ya tenés una cuenta con este nombre en este banco.",
      ),
    ).toBeInTheDocument();

    // The save transition settles after its error is painted: wait for the button to be usable.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Archivar cuenta" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Archivar cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se encontró la cuenta.",
    );
    expect(
      screen.queryByText("Ya tenés una cuenta con este nombre en este banco."),
    ).toBeNull();
  });

  it("shows 'Archivando…' with a spinner while the account is being archived", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.archiveAccountAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onClose } = renderForm(edit(ACCOUNT));

    fireEvent.click(screen.getByRole("button", { name: "Archivar cuenta" }));

    const pending = await screen.findByRole("button", { name: /Archivando/ });

    expect(pending.querySelector(".spinner")).not.toBeNull();

    finish({ status: "success" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe("the currency of an account with movements", () => {
  it("is shown but cannot be changed, and says why", () => {
    renderForm(edit({ ...ACCOUNT, hasMovements: true }));

    expect(currencyTrigger()).toBeDisabled();
    expect(currencyTrigger()).toHaveTextContent("USD");
    expect(
      screen.getByText(
        "La moneda no se puede cambiar porque la cuenta ya tiene movimientos.",
      ),
    ).toBeInTheDocument();
  });

  it("is still sent with the form, unchanged", async () => {
    actions.updateAccountAction.mockResolvedValue({ status: "success" });
    renderForm(edit({ ...ACCOUNT, hasMovements: true }));

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(actions.updateAccountAction).toHaveBeenCalledTimes(1),
    );
    expect(sentForm(actions.updateAccountAction, 1).get("currency")).toBe(
      ACCOUNT.currency,
    );
  });

  it("stays editable, with no explanation, on an account without movements", () => {
    renderForm(edit(ACCOUNT));

    expect(currencyTrigger()).not.toBeDisabled();
    expect(
      screen.queryByText(/La moneda no se puede cambiar porque/),
    ).toBeNull();
  });
});

describe("deleting an account", () => {
  const WITH_HISTORY: BoardAccount = { ...ACCOUNT, hasMovements: true };

  const openConfirmation = () => {
    fireEvent.click(screen.getByRole("button", { name: "Eliminar cuenta" }));

    return within(screen.getByRole("alertdialog"));
  };

  it("offers no delete in create mode", () => {
    renderForm(CREATE);

    expect(
      screen.queryByRole("button", { name: "Eliminar cuenta" }),
    ).toBeNull();
  });

  it("offers an enabled, destructive 'Eliminar cuenta' for an account without movements", () => {
    renderForm(edit(ACCOUNT));

    const button = screen.getByRole("button", { name: "Eliminar cuenta" });

    expect(button).toBeEnabled();
    expect(button.className).toMatch(/danger/);
    expect(
      screen.getByRole("button", { name: "Archivar cuenta" }),
    ).toBeEnabled();
  });

  it("disables the delete for an account with movements and says to archive it instead", () => {
    renderForm(edit(WITH_HISTORY));

    expect(
      screen.getByRole("button", { name: "Eliminar cuenta" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/ya tiene movimientos.*Archivala en su lugar/),
    ).toBeVisible();
  });

  it("asks for confirmation naming the account before doing anything", () => {
    renderForm(edit(ACCOUNT));

    const dialog = openConfirmation();

    expect(
      dialog.getByRole("heading", {
        name: "¿Eliminar la cuenta Cuenta en dólares?",
      }),
    ).toBeInTheDocument();
    expect(dialog.getByText("Se elimina de forma permanente.")).toBeVisible();
    expect(actions.deleteAccountAction).not.toHaveBeenCalled();
  });

  it("cancelling the confirmation deletes nothing and leaves the drawer open", async () => {
    const { onClose } = renderForm(edit(ACCOUNT));

    fireEvent.click(
      openConfirmation().getByRole("button", { name: "Cancelar" }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(actions.deleteAccountAction).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Editar cuenta" }),
    ).toBeInTheDocument();
  });

  it("confirming deletes the account once and closes the drawer", async () => {
    actions.deleteAccountAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit(ACCOUNT));

    fireEvent.click(
      openConfirmation().getByRole("button", { name: "Eliminar" }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(actions.deleteAccountAction).toHaveBeenCalledTimes(1);
    expect(actions.deleteAccountAction).toHaveBeenCalledWith("acc_1");
  });

  it("shows the server refusal (a movement appeared meanwhile) inside the confirmation and keeps everything open", async () => {
    const message =
      "Esta cuenta ya tiene movimientos, así que no se puede eliminar. Archivala en su lugar.";

    actions.deleteAccountAction.mockResolvedValue({ status: "error", message });
    const { onClose } = renderForm(edit(ACCOUNT));
    const dialog = openConfirmation();

    fireEvent.click(dialog.getByRole("button", { name: "Eliminar" }));

    expect(await dialog.findByText(message)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("the currencies by kind of bank", () => {
  const WALLET: Bank = {
    id: "bank_mp",
    name: "Mercado Pago",
    kind: "WALLET",
    archived: false,
  };
  const BANKS_WITH_WALLET = [CASH, GALICIA, WALLET];
  const MESSAGE =
    "Las entidades bancarias solo admiten monedas de curso legal. Usá una billetera virtual.";

  const openCurrencies = async () => {
    fireEvent.keyDown(currencyTrigger(), { key: "ArrowDown" });

    return screen.findByRole("listbox");
  };

  const pickCurrency = async (name: string) => {
    fireEvent.keyDown(currencyTrigger(), { key: "ArrowDown" });

    const option = await screen.findByRole("option", { name });

    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });
  };

  it("offers only legal tender in an entity bank", async () => {
    renderForm(
      { key: 1, account: null, bankId: "bank_galicia" },
      BANKS_WITH_WALLET,
    );

    const listbox = await openCurrencies();

    expect(
      within(listbox).getByRole("option", { name: /^USD - / }),
    ).toBeInTheDocument();
    expect(
      within(listbox).queryByRole("option", { name: "USDC - USD Coin" }),
    ).toBeNull();
    expect(within(listbox).queryByText("Criptomonedas")).toBeNull();
  });

  it("adds the crypto currencies, in a group of their own, in a virtual wallet", async () => {
    renderForm({ key: 1, account: null, bankId: "bank_mp" }, BANKS_WITH_WALLET);

    const listbox = await openCurrencies();

    expect(within(listbox).getByText("Criptomonedas")).toBeInTheDocument();
    expect(
      within(listbox).getByRole("option", { name: "USDC - USD Coin" }),
    ).toBeInTheDocument();
    expect(
      within(listbox).getByRole("option", { name: /^USD - / }),
    ).toBeInTheDocument();
  });

  it("lists the crypto currencies before the legal tender ones in a virtual wallet", async () => {
    renderForm({ key: 1, account: null, bankId: "bank_mp" }, BANKS_WITH_WALLET);

    const listbox = await openCurrencies();
    const options = within(listbox).getAllByRole("option");

    expect(options[0]).toHaveTextContent("USDC - USD Coin");
    expect(
      options.findIndex((o) => /^ARS - /.test(o.textContent ?? "")),
    ).toBeGreaterThan(0);
  });

  it("keeps ARS first, with no crypto, in an entity bank", async () => {
    renderForm(
      { key: 1, account: null, bankId: "bank_galicia" },
      BANKS_WITH_WALLET,
    );

    const listbox = await openCurrencies();
    const options = within(listbox).getAllByRole("option");

    expect(options[0].textContent).toMatch(/^ARS - /);
    expect(within(listbox).queryByText("Criptomonedas")).toBeNull();
  });

  it("sends a crypto currency for a wallet's new account", async () => {
    actions.createAccountAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(
      { key: 1, account: null, bankId: "bank_mp" },
      BANKS_WITH_WALLET,
    );

    fireEvent.change(nameInput(), { target: { value: "USDC" } });
    await pickCurrency("USDC - USD Coin");
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentForm(actions.createAccountAction).get("currency")).toBe("USDC");
    expect(sentForm(actions.createAccountAction).get("bankId")).toBe("bank_mp");
  });

  it("goes back to pesos when a crypto currency was chosen and the bank changes to an entity", async () => {
    renderForm({ key: 1, account: null, bankId: "bank_mp" }, BANKS_WITH_WALLET);

    await pickCurrency("USDC - USD Coin");

    expect(currencyTrigger()).toHaveTextContent("USDC - USD Coin");

    await pickBank("Banco Galicia");

    expect(currencyTrigger()).toHaveTextContent("ARS");
    expect(currencyTrigger()).not.toHaveTextContent("USDC");
  });

  it("keeps a legal-tender currency when the bank changes", async () => {
    renderForm({ key: 1, account: null, bankId: "bank_mp" }, BANKS_WITH_WALLET);

    fireEvent.keyDown(currencyTrigger(), { key: "ArrowDown" });

    const dollars = await screen.findByRole("option", { name: /^USD - / });

    fireEvent.keyDown(dollars, { key: "Enter" });
    fireEvent.keyUp(dollars, { key: "Enter" });
    await pickBank("Banco Galicia");

    expect(currencyTrigger()).toHaveTextContent("USD - ");
  });

  it("shows the crypto currency of an account being edited", () => {
    renderForm(
      edit({
        ...ACCOUNT,
        bankId: "bank_mp",
        name: "USDC",
        currency: "USDC",
        balanceLabel: "0,00 USDC",
      }),
      BANKS_WITH_WALLET,
    );

    expect(currencyTrigger()).toHaveTextContent("USDC - USD Coin");
  });

  it("shows the server's refusal of a crypto currency under Moneda, and stays open", async () => {
    actions.createAccountAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { currency: [MESSAGE] },
    });
    const { onClose } = renderForm(
      { key: 1, account: null, bankId: "bank_mp" },
      BANKS_WITH_WALLET,
    );

    fireEvent.change(nameInput(), { target: { value: "USDC" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText(MESSAGE)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});
