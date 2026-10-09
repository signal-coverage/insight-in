// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ saveOpeningBalanceAction: vi.fn() }));

vi.mock("@/core/balances/actions", () => actions);

import { OpeningBalanceDrawer } from "./OpeningBalanceDrawer";
import type { OpeningBalanceData } from "./types";

const row = (
  index: number,
  accountId: string,
  label: string,
  amount = "",
  currency = "ARS",
) => ({ index, accountId, currency, label, amount });

const EMPTY: OpeningBalanceData = {
  month: null,
  groups: [
    {
      bankId: "bank_cash",
      bankName: "Efectivo",
      rows: [row(0, "acc_cash", "Efectivo (ARS)")],
    },
  ],
};

const SAVED: OpeningBalanceData = {
  month: "2026-06",
  groups: [
    {
      bankId: "bank_galicia",
      bankName: "Banco Galicia",
      rows: [
        row(0, "acc_bank", "Caja de ahorro (ARS)", "5000.50"),
        row(1, "acc_usd", "Dólares (USD)", "", "USD"),
      ],
    },
    {
      bankId: "bank_cash",
      bankName: "Efectivo",
      rows: [row(2, "acc_cash", "Efectivo (ARS)", "800")],
    },
  ],
};

const renderDrawer = (data: OpeningBalanceData = EMPTY) => {
  const onClose = vi.fn();

  render(
    <OpeningBalanceDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      currentMonth="2026-10"
      data={data}
      sessionKey={1}
    />,
  );

  return { onClose };
};

const group = (bankName: string) =>
  within(screen.getByRole("group", { name: bankName }));

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

const saved = () =>
  actions.saveOpeningBalanceAction.mock.calls[0][0] as {
    month: string;
    balances: { accountId: string; currency: string; amount: string }[];
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

describe("OpeningBalanceDrawer header", () => {
  it("is titled Saldo inicial and explains what it does", () => {
    renderDrawer();

    expect(
      screen.getByRole("heading", { name: "Saldo inicial" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cuánto tenía cada cuenta al empezar el mes que elijas. Los meses anteriores dejan de contar.",
      ),
    ).toBeInTheDocument();
  });
});

describe("OpeningBalanceDrawer month", () => {
  it("starts on the month in course when nothing was saved", () => {
    renderDrawer(EMPTY);

    expect(
      screen.getByRole("button", { name: /Vigente desde/ }),
    ).toHaveTextContent("Octubre de 2026");
  });

  it("starts on the saved month", () => {
    renderDrawer(SAVED);

    expect(
      screen.getByRole("button", { name: /Vigente desde/ }),
    ).toHaveTextContent("Junio de 2026");
  });

  it("offers the 36 months before the one in course", async () => {
    renderDrawer(EMPTY);

    fireEvent.keyDown(screen.getByRole("button", { name: /Vigente desde/ }), {
      key: "ArrowDown",
    });

    const options = await screen.findAllByRole("option");

    expect(options).toHaveLength(37);
    expect(options[0]).toHaveTextContent("Octubre de 2026");
    expect(options[36]).toHaveTextContent("Octubre de 2023");
  });
});

describe("OpeningBalanceDrawer amounts", () => {
  it("gives every bank a group with one input per account", () => {
    renderDrawer(SAVED);

    expect(
      group("Banco Galicia").getByLabelText(/Caja de ahorro \(ARS\)/),
    ).toBeInTheDocument();
    expect(
      group("Banco Galicia").getByLabelText(/Dólares \(USD\)/),
    ).toBeInTheDocument();
    expect(
      group("Efectivo").getByLabelText(/Efectivo \(ARS\)/),
    ).toBeInTheDocument();
  });

  it("renders two banks with the same name as two groups, without a repeated key", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    renderDrawer({
      month: null,
      groups: [
        {
          bankId: "bank_a",
          bankName: "Banco",
          rows: [row(0, "acc_a", "Cuenta A (ARS)")],
        },
        {
          bankId: "bank_b",
          bankName: "Banco",
          rows: [row(1, "acc_b", "Cuenta B (ARS)")],
        },
      ],
    });

    expect(screen.getAllByRole("group", { name: "Banco" })).toHaveLength(2);
    expect(error).not.toHaveBeenCalled();
  });

  it("asks no Digital nor Efectivo split any more", () => {
    renderDrawer(SAVED);

    // The positive twin: the account inputs are there, so the query below could find something.
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    expect(screen.queryByLabelText(/^Digital/)).not.toBeInTheDocument();
  });

  it("prefills the saved amounts", () => {
    renderDrawer(SAVED);

    expect(group("Banco Galicia").getByLabelText(/Caja de ahorro/)).toHaveValue(
      "5000.50",
    );
    expect(group("Banco Galicia").getByLabelText(/Dólares/)).toHaveValue("");
    expect(group("Efectivo").getByLabelText(/Efectivo \(ARS\)/)).toHaveValue(
      "800",
    );
  });
});

describe("OpeningBalanceDrawer saving", () => {
  it("sends the month and what was typed, one row per account", async () => {
    actions.saveOpeningBalanceAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderDrawer(SAVED);

    fireEvent.change(group("Banco Galicia").getByLabelText(/Dólares/), {
      target: { value: "10" },
    });
    save();

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(actions.saveOpeningBalanceAction).toHaveBeenCalledTimes(1);
    expect(saved()).toEqual({
      month: "2026-06",
      balances: [
        { accountId: "acc_bank", currency: "ARS", amount: "5000.50" },
        { accountId: "acc_usd", currency: "USD", amount: "10" },
        { accountId: "acc_cash", currency: "ARS", amount: "800" },
      ],
    });
  });

  it("sends the month in course when none was chosen", async () => {
    actions.saveOpeningBalanceAction.mockResolvedValue({ status: "success" });
    renderDrawer(EMPTY);

    fireEvent.change(group("Efectivo").getByLabelText(/Efectivo \(ARS\)/), {
      target: { value: "99" },
    });
    save();

    await waitFor(() =>
      expect(actions.saveOpeningBalanceAction).toHaveBeenCalledTimes(1),
    );

    expect(saved().month).toBe("2026-10");
  });

  it("shows 'Guardando…' with a spinner, and locks Cancel, while it saves", async () => {
    const pending = deferred<{ status: "success" }>();

    actions.saveOpeningBalanceAction.mockReturnValue(pending.promise);
    renderDrawer(SAVED);

    save();

    const button = await screen.findByRole("button", { name: /Guardando/ });

    expect(button).toHaveTextContent("Guardando…");
    expect(button.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    pending.resolve({ status: "success" });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Guardando/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("closes once it is saved", async () => {
    actions.saveOpeningBalanceAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderDrawer(SAVED);

    save();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("shows the server's message on the field it is about, and stays open", async () => {
    actions.saveOpeningBalanceAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        "balances.1.amount": [
          "Ingresa un monto válido, con dígitos y un punto para los decimales.",
        ],
      },
    });
    const { onClose } = renderDrawer(SAVED);

    save();

    expect(
      await group("Banco Galicia").findByText(
        "Ingresa un monto válido, con dígitos y un punto para los decimales.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("blames the right input when two banks' accounts interleave", async () => {
    // Banks A and B with the accounts ordered A1, B1, A2: the groups hold indexes [0, 2] and [1].
    const INTERLEAVED: OpeningBalanceData = {
      month: null,
      groups: [
        {
          bankId: "bank_a",
          bankName: "Banco A",
          rows: [
            row(0, "acc_a1", "Cuenta A1 (ARS)"),
            row(2, "acc_a2", "Cuenta A2 (ARS)"),
          ],
        },
        {
          bankId: "bank_b",
          bankName: "Banco B",
          rows: [row(1, "acc_b1", "Cuenta B1 (ARS)")],
        },
      ],
    };

    // Like the server: it blames the position of the offending row in the payload it received.
    actions.saveOpeningBalanceAction.mockImplementation(
      async (payload: { balances: { amount: string }[] }) => ({
        status: "error",
        message: "Corrige los campos resaltados.",
        fieldErrors: {
          [`balances.${payload.balances.findIndex(({ amount }) => amount === "x")}.amount`]:
            ["Monto inválido."],
        },
      }),
    );
    renderDrawer(INTERLEAVED);

    fireEvent.change(group("Banco B").getByLabelText(/Cuenta B1/), {
      target: { value: "x" },
    });
    save();

    expect(await group("Banco B").findByText("Monto inválido.")).toBeVisible();
    expect(group("Banco A").queryByText("Monto inválido.")).toBeNull();
  });

  it("shows a general error when there is no field to blame", async () => {
    actions.saveOpeningBalanceAction.mockResolvedValue({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    const { onClose } = renderDrawer(SAVED);

    save();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo salió mal. Inténtalo de nuevo.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("has a Cancelar button that saves nothing", () => {
    renderDrawer(SAVED);

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    expect(actions.saveOpeningBalanceAction).not.toHaveBeenCalled();
  });
});
