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

const EMPTY: OpeningBalanceData = {
  month: null,
  rows: [{ currency: "ARS", digital: "", cash: "" }],
};

const SAVED: OpeningBalanceData = {
  month: "2026-06",
  rows: [
    { currency: "ARS", digital: "5000.50", cash: "800" },
    { currency: "USD", digital: "", cash: "120.25" },
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

const group = (currency: string) =>
  within(screen.getByRole("group", { name: currency }));

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

const saved = () =>
  actions.saveOpeningBalanceAction.mock.calls[0][0] as {
    month: string;
    balances: { currency: string; digital: string; cash: string }[];
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
        "Cuánto tenías al empezar el mes que elijas. Los meses anteriores dejan de contar.",
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
  it("gives every currency a group with its Digital and Efectivo inputs", () => {
    renderDrawer(SAVED);

    for (const currency of ["ARS", "USD"]) {
      expect(group(currency).getByLabelText(/Digital/)).toBeInTheDocument();
      expect(group(currency).getByLabelText(/Efectivo/)).toBeInTheDocument();
    }
  });

  it("offers the default currency even when the user has nothing saved", () => {
    renderDrawer(EMPTY);

    expect(group("ARS").getByLabelText(/Digital/)).toHaveValue("");
    expect(group("ARS").getByLabelText(/Efectivo/)).toHaveValue("");
  });

  it("prefills the saved amounts", () => {
    renderDrawer(SAVED);

    expect(group("ARS").getByLabelText(/Digital/)).toHaveValue("5000.50");
    expect(group("ARS").getByLabelText(/Efectivo/)).toHaveValue("800");
    expect(group("USD").getByLabelText(/Digital/)).toHaveValue("");
    expect(group("USD").getByLabelText(/Efectivo/)).toHaveValue("120.25");
  });
});

describe("OpeningBalanceDrawer saving", () => {
  it("sends the month and what was typed, one row per currency", async () => {
    actions.saveOpeningBalanceAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderDrawer(SAVED);

    fireEvent.change(group("USD").getByLabelText(/Digital/), {
      target: { value: "10" },
    });
    save();

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(actions.saveOpeningBalanceAction).toHaveBeenCalledTimes(1);
    expect(saved()).toEqual({
      month: "2026-06",
      balances: [
        { currency: "ARS", digital: "5000.50", cash: "800" },
        { currency: "USD", digital: "10", cash: "120.25" },
      ],
    });
  });

  it("sends the month in course when none was chosen", async () => {
    actions.saveOpeningBalanceAction.mockResolvedValue({ status: "success" });
    renderDrawer(EMPTY);

    fireEvent.change(group("ARS").getByLabelText(/Digital/), {
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
        "balances.1.cash": [
          "Ingresa un monto válido, con dígitos y un punto para los decimales.",
        ],
      },
    });
    const { onClose } = renderDrawer(SAVED);

    save();

    expect(
      await group("USD").findByText(
        "Ingresa un monto válido, con dígitos y un punto para los decimales.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
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
