// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const actions = vi.hoisted(() => ({
  createTransferAction: vi.fn(),
  updateTransferAction: vi.fn(),
  deleteTransferAction: vi.fn(),
  deleteTransfersAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/core/transfers/actions", () => actions);

import type { AccountChoice } from "@/core/accounts/types";

import { Transfers } from "./Transfers";
import type { TransferRow, TransfersTableData } from "./types";

const ROW_A: TransferRow = {
  id: "tr_1",
  fromAccountId: "galicia",
  toAccountId: "cash",
  fromLabel: "Galicia · Caja de ahorro",
  toLabel: "Efectivo · Efectivo",
  currency: "ARS",
  amount: 150050,
  date: "2026-10-03",
  notes: "Alquiler",
  amountLabel: "$ 1.500,50",
  amountDecimal: "1500.50",
  dateLabel: "3 oct 2026",
};
const ROW_B: TransferRow = {
  id: "tr_2",
  fromAccountId: "dollars",
  toAccountId: "dollars2",
  fromLabel: "Galicia · Dólares",
  toLabel: "Nación · Dólares",
  currency: "USD",
  amount: 2500,
  date: "2026-10-01",
  notes: null,
  amountLabel: "US$ 25,00",
  amountDecimal: "25.00",
  dateLabel: "1 oct 2026",
};

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
  {
    id: "dollars",
    currency: "USD",
    label: "Galicia · Dólares",
    archived: false,
  },
  {
    id: "dollars2",
    currency: "USD",
    label: "Nación · Dólares",
    archived: false,
  },
];

const WITH_ROWS: TransfersTableData = { rows: [ROW_A, ROW_B] };
const EMPTY: TransfersTableData = { rows: [] };

const renderPage = (table: TransfersTableData = WITH_ROWS, month = "2026-10") =>
  render(
    <Transfers
      month={month}
      currentMonth="2026-10"
      monthLabel="Octubre de 2026"
      table={table}
      accounts={ACCOUNTS}
    />,
  );

// The account filter keeps a hidden native option per account, so rows are looked up inside the grid.
const inTable = () => within(screen.getByRole("grid"));

const openMenu = () => {
  fireEvent.keyDown(screen.getByRole("button", { name: "Acciones" }), {
    key: "ArrowDown",
  });

  return screen.findByRole("menu");
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Transfers page", () => {
  it("shows the title, what the page is for and the month", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Transferencias" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No cuenta como ingreso ni como gasto/),
    ).toBeInTheDocument();
    expect(screen.getByText("Octubre de 2026")).toBeVisible();
  });

  it("offers only Crear transferencia in the Actions menu", async () => {
    renderPage();

    await openMenu();

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Crear transferencia"]);
  });

  it("moves between months through the address; the month in course has the bare address", () => {
    renderPage(WITH_ROWS, "2026-08");

    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Mes actual" }));

    expect(router.push.mock.calls.map((call) => call[0])).toEqual([
      "/dashboard/transfers?month=2026-07",
      "/dashboard/transfers?month=2026-09",
      "/dashboard/transfers",
    ]);
  });

  it("lists the month's transfers", () => {
    renderPage();

    expect(inTable().getByText("Galicia · Caja de ahorro")).toBeVisible();
    expect(screen.getByText("US$ 25,00")).toBeVisible();
  });

  it("filters by search without leaving the page, and says so when nothing matches", () => {
    renderPage();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar transferencias" }),
      {
        target: { value: "alquiler" },
      },
    );

    expect(inTable().getByText("Galicia · Caja de ahorro")).toBeVisible();
    expect(screen.queryByText("US$ 25,00")).toBeNull();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar transferencias" }),
      {
        target: { value: "zzz" },
      },
    );

    expect(
      screen.getByText("Ninguna transferencia coincide con estos filtros"),
    ).toBeVisible();

    fireEvent.click(
      screen.getAllByRole("button", { name: /Limpiar filtros/ })[0],
    );

    expect(screen.getByText("US$ 25,00")).toBeVisible();
  });

  it("shows the empty invitation when the month has no transfer", () => {
    renderPage(EMPTY);

    expect(screen.getByText("No hay transferencias en este mes")).toBeVisible();
  });

  it("opens the create drawer from the button of the empty state", async () => {
    renderPage(EMPTY);

    fireEvent.click(
      screen.getByRole("button", { name: "Crear transferencia" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Crear transferencia" }),
    ).toBeInTheDocument();
  });

  it("opens the edit drawer prefilled from the pencil of a row", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Editar Transferencia de Galicia · Caja de ahorro a Efectivo · Efectivo",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Editar transferencia" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Monto/ })).toHaveValue(
      "1500.50",
    );
  });

  it("opens the delete dialog from the trash of a row and deletes that transfer", async () => {
    actions.deleteTransferAction.mockResolvedValue({ status: "success" });
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Eliminar Transferencia de Galicia · Dólares a Nación · Dólares",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "¿Eliminar esta transferencia?",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Eliminar",
      }),
    );

    await waitFor(() =>
      expect(actions.deleteTransferAction).toHaveBeenCalledWith("tr_2"),
    );
  });

  it("deletes the selected transfers in one go", async () => {
    actions.deleteTransfersAction.mockResolvedValue({
      status: "success",
      deleted: 2,
    });
    renderPage();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );

    expect(screen.getByText("2 seleccionadas")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar selección" }));

    expect(
      await screen.findByRole("heading", {
        name: "¿Eliminar 2 transferencias?",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /Eliminar/,
      }),
    );

    await waitFor(() =>
      expect(actions.deleteTransfersAction).toHaveBeenCalledWith([
        "tr_1",
        "tr_2",
      ]),
    );
  });

  it("shows the refusal inside the bulk dialog when an account cannot give its money back, and keeps the selection", async () => {
    const message =
      "No se puede deshacer: Nación · Dólares tiene US$ 1,00 y tendría que devolver US$ 25,00.";

    actions.deleteTransfersAction.mockResolvedValue({
      status: "error",
      message,
    });
    renderPage();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar selección" }));

    await screen.findByRole("heading", { name: "¿Eliminar 2 transferencias?" });
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /Eliminar/,
      }),
    );

    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByText("2 seleccionadas")).toBeInTheDocument();
  });

  it("only counts the selected rows that the filters still show", () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar transferencias" }),
      {
        target: { value: "alquiler" },
      },
    );

    expect(screen.getByText("1 seleccionada")).toBeVisible();
  });
});
