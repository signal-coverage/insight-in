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
  createBankAction: vi.fn(),
  updateBankAction: vi.fn(),
  archiveBankAction: vi.fn(),
  unarchiveBankAction: vi.fn(),
  deleteBankAction: vi.fn(),
}));

vi.mock("@/core/banks/actions", () => actions);

import type { BankWithAccounts } from "@/core/banks/types";

import type { BankFormTarget } from "../../types";
import { BankFormDrawer } from "./BankFormDrawer";

const account = (id: string, archived: boolean) => ({
  id,
  bankId: "bank_1",
  name: `Cuenta ${id}`,
  currency: "ARS",
  archived,
});

const WITH_ACTIVE_ACCOUNT: BankWithAccounts = {
  id: "bank_1",
  name: "Banco Galicia",
  kind: "ENTITY",
  archived: false,
  accounts: [account("a1", false), account("a2", true)],
};
const READY_TO_ARCHIVE: BankWithAccounts = {
  ...WITH_ACTIVE_ACCOUNT,
  accounts: [account("a1", true)],
};
const ARCHIVED: BankWithAccounts = {
  ...READY_TO_ARCHIVE,
  archived: true,
};

const renderForm = (target: BankFormTarget) => {
  const onClose = vi.fn();

  render(
    <BankFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
    />,
  );

  return { onClose };
};

const CREATE: BankFormTarget = { key: 1, bank: null };
const edit = (bank: BankWithAccounts): BankFormTarget => ({ key: 2, bank });

const nameInput = () => screen.getByRole("textbox", { name: /Nombre/ });
const sentForm = (action: ReturnType<typeof vi.fn>, index = 0): FormData =>
  action.mock.calls[0][index] as FormData;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("is titled 'Crear banco' and explains what a bank is", () => {
    renderForm(CREATE);

    expect(
      screen.getByRole("heading", { name: "Crear banco" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Un banco agrupa tus cuentas/)).toBeVisible();
  });

  it("has a create button with the plus icon, and a Cancel", () => {
    renderForm(CREATE);

    const button = screen.getByRole("button", { name: "Crear banco" });

    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("starts with an empty name limited to 40 characters, and offers no archive", () => {
    renderForm(CREATE);

    expect(nameInput()).toHaveValue("");
    expect(nameInput()).toHaveAttribute("maxlength", "40");
    expect(screen.queryByRole("button", { name: "Archivar banco" })).toBeNull();
  });

  it("sends the name through the create action and closes", async () => {
    actions.createBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CREATE);

    fireEvent.change(nameInput(), { target: { value: "Banco Galicia" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear banco" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentForm(actions.createBankAction).get("name")).toBe(
      "Banco Galicia",
    );
    expect(actions.updateBankAction).not.toHaveBeenCalled();
  });

  it("shows 'Creando banco…' with a spinner and locks Cancel while it saves", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.createBankAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onClose } = renderForm(CREATE);

    fireEvent.change(nameInput(), { target: { value: "Galicia" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear banco" }));

    const pending = await screen.findByRole("button", {
      name: /Creando banco/,
    });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    finish({ status: "success" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the error of the name field the server refused, and stays open", async () => {
    actions.createBankAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { name: ["Ya tenés un banco con este nombre."] },
    });
    const { onClose } = renderForm(CREATE);

    fireEvent.change(nameInput(), { target: { value: "galicia" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear banco" }));

    expect(
      await screen.findByText("Ya tenés un banco con este nombre."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a failure that belongs to no field as an alert", async () => {
    actions.createBankAction.mockResolvedValue({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    renderForm(CREATE);

    fireEvent.change(nameInput(), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear banco" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo salió mal. Inténtalo de nuevo.",
    );
  });
});

describe("edit mode", () => {
  it("is titled 'Editar banco' and starts with the name of the bank", () => {
    renderForm(edit(WITH_ACTIVE_ACCOUNT));

    expect(
      screen.getByRole("heading", { name: "Editar banco" }),
    ).toBeInTheDocument();
    expect(nameInput()).toHaveValue("Banco Galicia");
  });

  it("saves through the update action with the id of the bank, and closes", async () => {
    actions.updateBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit(WITH_ACTIVE_ACCOUNT));

    fireEvent.change(nameInput(), { target: { value: "Galicia" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.updateBankAction.mock.calls[0][0]).toBe("bank_1");
    expect(sentForm(actions.updateBankAction, 1).get("name")).toBe("Galicia");
    expect(actions.createBankAction).not.toHaveBeenCalled();
  });

  it("cannot archive a bank that still has active accounts, and says why", () => {
    renderForm(edit(WITH_ACTIVE_ACCOUNT));

    expect(
      screen.getByRole("button", { name: "Archivar banco" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Para archivar este banco, archivá primero todas sus cuentas.",
      ),
    ).toBeVisible();
  });

  it("archives a bank whose accounts are all archived, and closes", async () => {
    actions.archiveBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit(READY_TO_ARCHIVE));

    fireEvent.click(screen.getByRole("button", { name: "Archivar banco" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.archiveBankAction).toHaveBeenCalledWith("bank_1");
  });

  it("shows 'Archivando…' with a spinner while the bank is being archived", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.archiveBankAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onClose } = renderForm(edit(READY_TO_ARCHIVE));

    fireEvent.click(screen.getByRole("button", { name: "Archivar banco" }));

    const pending = await screen.findByRole("button", { name: /Archivando/ });

    expect(pending.querySelector(".spinner")).not.toBeNull();

    finish({ status: "success" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the refusal of the server (an account was reactivated meanwhile) as an alert and stays open", async () => {
    actions.archiveBankAction.mockResolvedValue({
      status: "error",
      message: "Este banco todavía tiene 1 cuenta activa. Archivala primero.",
    });
    const { onClose } = renderForm(edit(READY_TO_ARCHIVE));

    fireEvent.click(screen.getByRole("button", { name: "Archivar banco" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este banco todavía tiene 1 cuenta activa. Archivala primero.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows only the alert, not an older field error, when archiving fails after a refused save", async () => {
    actions.updateBankAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { name: ["Ya tenés un banco con este nombre."] },
    });
    actions.archiveBankAction.mockResolvedValue({
      status: "error",
      message: "Este banco todavía tiene 1 cuenta activa. Archivala primero.",
    });
    renderForm(edit(READY_TO_ARCHIVE));

    fireEvent.change(nameInput(), { target: { value: "galicia" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("Ya tenés un banco con este nombre."),
    ).toBeInTheDocument();

    // The save transition settles after its error is painted: wait for the button to be usable.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Archivar banco" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Archivar banco" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este banco todavía tiene 1 cuenta activa. Archivala primero.",
    );
    expect(screen.queryByText("Ya tenés un banco con este nombre.")).toBeNull();
  });

  it("offers to reactivate an archived bank instead, and does so through the unarchive action", async () => {
    actions.unarchiveBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit(ARCHIVED));

    expect(screen.queryByRole("button", { name: "Archivar banco" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reactivar banco" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.unarchiveBankAction).toHaveBeenCalledWith("bank_1");
    expect(actions.archiveBankAction).not.toHaveBeenCalled();
  });
});

describe("deleting a bank", () => {
  const openConfirmation = () => {
    fireEvent.click(screen.getByRole("button", { name: "Eliminar banco" }));

    return within(screen.getByRole("alertdialog"));
  };

  it("offers no delete in create mode", () => {
    renderForm(CREATE);

    expect(screen.queryByRole("button", { name: "Eliminar banco" })).toBeNull();
  });

  it("offers a destructive 'Eliminar banco' in edit mode, next to the archive control, and explains the rule", () => {
    renderForm(edit(READY_TO_ARCHIVE));

    const button = screen.getByRole("button", { name: "Eliminar banco" });

    expect(button).toBeEnabled();
    expect(button.className).toMatch(/danger/);
    expect(
      screen.getByRole("button", { name: "Archivar banco" }),
    ).toBeEnabled();
    expect(
      screen.getByText(/Solo podés eliminarlo si no tiene cuentas/),
    ).toBeVisible();
  });

  it("asks for confirmation naming the bank before doing anything", () => {
    renderForm(edit(READY_TO_ARCHIVE));

    const dialog = openConfirmation();

    expect(
      dialog.getByRole("heading", {
        name: "¿Eliminar el banco Banco Galicia?",
      }),
    ).toBeInTheDocument();
    expect(dialog.getByText(/Se elimina de forma permanente/)).toBeVisible();
    expect(actions.deleteBankAction).not.toHaveBeenCalled();
  });

  it("cancelling the confirmation deletes nothing and leaves the drawer open", async () => {
    const { onClose } = renderForm(edit(READY_TO_ARCHIVE));

    fireEvent.click(
      openConfirmation().getByRole("button", { name: "Cancelar" }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(actions.deleteBankAction).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Editar banco" }),
    ).toBeInTheDocument();
  });

  it("confirming deletes the bank once and closes the drawer", async () => {
    actions.deleteBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(edit(READY_TO_ARCHIVE));

    fireEvent.click(
      openConfirmation().getByRole("button", { name: "Eliminar" }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(actions.deleteBankAction).toHaveBeenCalledTimes(1);
    expect(actions.deleteBankAction).toHaveBeenCalledWith("bank_1");
  });

  it("shows the server refusal inside the confirmation and keeps everything open", async () => {
    const message = "Este banco todavía tiene 1 tarjeta. Eliminala primero.";

    actions.deleteBankAction.mockResolvedValue({ status: "error", message });
    const { onClose } = renderForm(edit(READY_TO_ARCHIVE));
    const dialog = openConfirmation();

    fireEvent.click(dialog.getByRole("button", { name: "Eliminar" }));

    expect(await dialog.findByText(message)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("the kind of bank", () => {
  const MESSAGE =
    "Este banco tiene cuentas cripto (archivadas incluidas). Eliminalas antes de pasarlo a entidad bancaria.";
  const kindGroup = () => screen.getByRole("radiogroup", { name: "Tipo" });

  it("asks whether it is a bank entity or a virtual wallet, and starts a new bank as an entity", () => {
    renderForm(CREATE);

    expect(
      within(kindGroup())
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual([
      expect.stringContaining("Entidad bancaria"),
      expect.stringContaining("Billetera virtual"),
    ]);
    expect(
      screen.getByRole("radio", { name: /Entidad bancaria/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Billetera virtual/ }),
    ).not.toBeChecked();
  });

  it("sends an entity when the kind is left alone", async () => {
    actions.createBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CREATE);

    fireEvent.change(nameInput(), { target: { value: "Banco Galicia" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear banco" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentForm(actions.createBankAction).get("kind")).toBe("ENTITY");
  });

  it("sends a virtual wallet when it is chosen", async () => {
    actions.createBankAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(CREATE);

    fireEvent.change(nameInput(), { target: { value: "Mercado Pago" } });
    fireEvent.click(screen.getByRole("radio", { name: /Billetera virtual/ }));
    fireEvent.click(screen.getByRole("button", { name: "Crear banco" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sentForm(actions.createBankAction).get("kind")).toBe("WALLET");
  });

  it("starts an edit on the bank's own kind", () => {
    renderForm(edit({ ...WITH_ACTIVE_ACCOUNT, kind: "WALLET" }));

    expect(
      screen.getByRole("radio", { name: /Billetera virtual/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Entidad bancaria/ }),
    ).not.toBeChecked();
  });

  it("shows under Tipo the refusal to make a wallet with crypto accounts an entity, and stays open", async () => {
    actions.updateBankAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { kind: [MESSAGE] },
    });
    const { onClose } = renderForm(
      edit({ ...WITH_ACTIVE_ACCOUNT, kind: "WALLET" }),
    );

    fireEvent.click(screen.getByRole("radio", { name: /Entidad bancaria/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(MESSAGE)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    expect(sentForm(actions.updateBankAction, 1).get("kind")).toBe("ENTITY");
  });
});
