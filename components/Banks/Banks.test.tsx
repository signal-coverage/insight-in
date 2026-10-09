// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/banks/actions", () => ({
  createBankAction: vi.fn(),
  updateBankAction: vi.fn(),
  archiveBankAction: vi.fn(),
  unarchiveBankAction: vi.fn(),
}));
vi.mock("@/core/accounts/actions", () => ({
  createAccountAction: vi.fn(),
  updateAccountAction: vi.fn(),
  archiveAccountAction: vi.fn(),
  unarchiveAccountAction: vi.fn(),
}));

import type { BoardBank } from "@/core/banks/types";

import { Banks } from "./Banks";

const BANKS: BoardBank[] = [
  {
    id: "bank_cash",
    name: "Efectivo",
    kind: "ENTITY",
    archived: false,
    accounts: [
      {
        id: "acc_cash",
        bankId: "bank_cash",
        name: "Efectivo",
        currency: "ARS",
        archived: false,
        balance: 0,
        balanceLabel: "$ 0,00",
        hasMovements: false,
      },
    ],
  },
  {
    id: "bank_galicia",
    name: "Banco Galicia",
    kind: "ENTITY",
    archived: false,
    accounts: [
      {
        id: "acc_sav",
        bankId: "bank_galicia",
        name: "Caja de ahorro",
        currency: "ARS",
        archived: false,
        balance: 0,
        balanceLabel: "$ 0,00",
        hasMovements: false,
      },
      {
        id: "acc_usd",
        bankId: "bank_galicia",
        name: "Cuenta en dólares",
        currency: "USD",
        archived: false,
        balance: 0,
        balanceLabel: "$ 0,00",
        hasMovements: false,
      },
      {
        id: "acc_old",
        bankId: "bank_galicia",
        name: "Cuenta vieja",
        currency: "ARS",
        archived: true,
        balance: 0,
        balanceLabel: "$ 0,00",
        hasMovements: false,
      },
    ],
  },
  {
    id: "bank_old",
    name: "Banco Viejo",
    kind: "ENTITY",
    archived: true,
    accounts: [
      {
        id: "acc_dead",
        bankId: "bank_old",
        name: "Caja cerrada",
        currency: "ARS",
        archived: true,
        balance: 0,
        balanceLabel: "$ 0,00",
        hasMovements: false,
      },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

const bankButton = (name: string) =>
  screen.queryByRole("button", {
    name: new RegExp(`^Editar banco ${name}(, archivado)?$`),
  });
const accountButton = (name: string) =>
  screen.queryByRole("button", {
    name: new RegExp(
      `^Editar cuenta ${name}, [A-Z]{3}, saldo .+?(, archivada)?$`,
    ),
  });

const typeSearch = (value: string) =>
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Buscar bancos y cuentas" }),
    { target: { value } },
  );
const toggleArchived = () =>
  fireEvent.click(screen.getByRole("switch", { name: "Mostrar archivados" }));

const chooseAction = async (name: string) => {
  fireEvent.keyDown(screen.getByRole("button", { name: "Acciones" }), {
    key: "ArrowDown",
  });
  await screen.findByRole("menu");

  const item = screen.getByRole("menuitem", { name });

  fireEvent.keyDown(item, { key: "Enter" });
  fireEvent.keyUp(item, { key: "Enter" });
};

describe("Banks page", () => {
  it("shows the title and what the page is for", () => {
    render(<Banks board={BANKS} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Bancos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tus bancos, billeteras y efectivo, con las cuentas que tenés en cada uno.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the header, the toolbar and the skeleton while the banks load", () => {
    render(<Banks board={new Promise(() => {})} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Bancos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Acciones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Buscar bancos y cuentas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Cargando bancos y cuentas" }),
    ).toBeInTheDocument();
    expect(bankButton("Efectivo")).toBeNull();
  });

  it("shows the board once its promise resolves", async () => {
    // Settled before it renders, inside act: the case jsdom can drive (see Await.test.tsx).
    const data = Promise.resolve(BANKS);

    await act(async () => {
      render(<Banks board={data} />);
    });

    expect(
      await screen.findByRole("button", { name: "Editar banco Banco Galicia" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Cargando bancos y cuentas" }),
    ).toBeNull();
  });

  it("shows the active banks with their active accounts (name, balance and currency), and hides what is archived", () => {
    render(<Banks board={BANKS} />);

    expect(bankButton("Efectivo")).toBeInTheDocument();
    expect(bankButton("Banco Galicia")).toBeInTheDocument();
    expect(accountButton("Caja de ahorro")).toHaveTextContent(
      /^Caja de ahorro\$ 0,00ARS$/,
    );
    expect(accountButton("Cuenta en dólares")).toHaveTextContent(
      /^Cuenta en dólares\$ 0,00USD$/,
    );
    expect(bankButton("Banco Viejo")).toBeNull();
    expect(accountButton("Cuenta vieja")).toBeNull();
    expect(accountButton("Caja cerrada")).toBeNull();
  });

  it("shows archived banks and accounts when the toggle is on, and hides them again when it is off", () => {
    render(<Banks board={BANKS} />);

    toggleArchived();

    expect(bankButton("Banco Viejo")).toBeInTheDocument();
    expect(accountButton("Cuenta vieja")).toBeInTheDocument();
    expect(accountButton("Caja cerrada")).toBeInTheDocument();

    toggleArchived();

    expect(bankButton("Banco Viejo")).toBeNull();
    expect(accountButton("Cuenta vieja")).toBeNull();
  });

  it("keeps a bank row when the bank name matches the search, with all its accounts", () => {
    render(<Banks board={BANKS} />);

    typeSearch("galicia");

    expect(bankButton("Banco Galicia")).toBeInTheDocument();
    expect(accountButton("Caja de ahorro")).toBeInTheDocument();
    expect(accountButton("Cuenta en dólares")).toBeInTheDocument();
    expect(bankButton("Efectivo")).toBeNull();
  });

  it("keeps a bank row when only one of its accounts matches, showing that account (accents and case ignored)", () => {
    render(<Banks board={BANKS} />);

    typeSearch("DOLARES");

    expect(bankButton("Banco Galicia")).toBeInTheDocument();
    expect(accountButton("Cuenta en dólares")).toBeInTheDocument();
    expect(accountButton("Caja de ahorro")).toBeNull();
    expect(bankButton("Efectivo")).toBeNull();
    expect(
      screen.getByRole("button", { name: "+ Nueva cuenta en Banco Galicia" }),
    ).toBeInTheDocument();
  });

  it("does not bring a bank back because of an archived account that is hidden", () => {
    render(<Banks board={BANKS} />);

    typeSearch("cuenta vieja");

    expect(bankButton("Banco Galicia")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ningún banco ni cuenta coincide con la búsqueda.",
    );

    toggleArchived();

    expect(bankButton("Banco Galicia")).toBeInTheDocument();
    expect(accountButton("Cuenta vieja")).toBeInTheDocument();
    expect(accountButton("Caja de ahorro")).toBeNull();
  });

  it("points to the archived toggle when every bank is archived, and shows them once it is on", () => {
    const archivedOnly: BoardBank[] = BANKS.map((bank) => ({
      ...bank,
      archived: true,
      accounts: bank.accounts.map((account) => ({
        ...account,
        archived: true,
      })),
    }));

    render(<Banks board={archivedOnly} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Todos tus bancos están archivados. Activá «Mostrar archivados» para verlos.",
    );

    toggleArchived();

    expect(screen.queryByRole("status")).toBeNull();
    expect(bankButton("Banco Galicia")).toBeInTheDocument();
  });

  it("keeps the plain empty message when there are no banks at all", () => {
    render(<Banks board={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "No hay bancos para mostrar. Creá uno desde el menú Acciones.",
    );
  });

  it("lists 'Crear banco' and 'Crear cuenta' in the Actions menu, in that order", async () => {
    render(<Banks board={BANKS} />);

    fireEvent.keyDown(screen.getByRole("button", { name: "Acciones" }), {
      key: "ArrowDown",
    });
    await screen.findByRole("menu");

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Crear banco", "Crear cuenta"]);
  });

  it("opens the bank drawer from 'Crear banco'", async () => {
    render(<Banks board={BANKS} />);

    await chooseAction("Crear banco");

    expect(
      await screen.findByRole("heading", { name: "Crear banco" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Nombre/ })).toHaveValue("");
  });

  it("opens the bank drawer, empty, from the '+ Nuevo banco' row of the board", async () => {
    render(<Banks board={BANKS} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo banco" }));

    expect(
      await screen.findByRole("heading", { name: "Crear banco" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Nombre/ })).toHaveValue("");
  });

  it("offers no '+ Nuevo banco' while the banks load", () => {
    render(<Banks board={new Promise(() => {})} />);

    expect(
      screen.getByRole("status", { name: "Cargando bancos y cuentas" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Nuevo banco" })).toBeNull();
  });

  it("offers no '+ Nuevo banco' when no bank is shown, but 'Crear banco' stays in the menu", async () => {
    render(<Banks board={[]} />);

    expect(screen.queryByRole("button", { name: "+ Nuevo banco" })).toBeNull();

    fireEvent.keyDown(screen.getByRole("button", { name: "Acciones" }), {
      key: "ArrowDown",
    });
    await screen.findByRole("menu");

    expect(
      screen.getByRole("menuitem", { name: "Crear banco" }),
    ).toBeInTheDocument();
  });

  it("opens the account drawer from 'Crear cuenta', offering only the active banks", async () => {
    render(<Banks board={BANKS} />);

    await chooseAction("Crear cuenta");

    expect(
      await screen.findByRole("heading", { name: "Crear cuenta" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: /Banco$/ }), {
      key: "ArrowDown",
    });
    await screen.findByRole("listbox");

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Efectivo", "Banco Galicia"]);
  });

  it("opens the editor of a bank when its cell is pressed", async () => {
    render(<Banks board={BANKS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Editar banco Banco Galicia" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Editar banco" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Nombre/ })).toHaveValue(
      "Banco Galicia",
    );
  });

  it("opens the editor of an account when its tile is pressed", async () => {
    render(<Banks board={BANKS} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Editar cuenta Cuenta en dólares, USD, saldo $ 0,00",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Editar cuenta" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Nombre/ })).toHaveValue(
      "Cuenta en dólares",
    );
    expect(screen.getByRole("button", { name: /Moneda/ })).toHaveTextContent(
      "USD",
    );
  });

  it("opens a new account with the bank of the '+ Nueva cuenta' tile already chosen", async () => {
    render(<Banks board={BANKS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "+ Nueva cuenta en Banco Galicia" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Crear cuenta" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Banco$/ })).toHaveTextContent(
      "Banco Galicia",
    );
  });

  it("lets an archived bank be reactivated from its editor, which is reachable with the toggle on", async () => {
    render(<Banks board={BANKS} />);

    toggleArchived();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Editar banco Banco Viejo, archivado",
      }),
    );

    expect(
      await screen.findByRole("button", { name: "Reactivar banco" }),
    ).toBeInTheDocument();
  });
});
