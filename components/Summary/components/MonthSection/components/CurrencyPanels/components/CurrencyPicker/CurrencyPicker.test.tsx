// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const action = vi.hoisted(() => ({
  saveHiddenSummaryCurrenciesAction: vi.fn(),
}));

vi.mock("@/core/settings/actions", () => action);

import { CurrencyPicker } from "./CurrencyPicker";
import type { CurrencyPickerProps } from "./types";

const save = action.saveHiddenSummaryCurrenciesAction;

// Lets the test decide when the server answers.
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

const renderPicker = (patch: Partial<CurrencyPickerProps> = {}) =>
  render(
    <CurrencyPicker
      currencies={["ARS", "USD", "USDC"]}
      hidden={[]}
      {...patch}
    />,
  );

const open = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Elegir monedas" }));
  });

const box = (code: string) =>
  screen.getByRole("checkbox", { name: new RegExp(`^${code} `) });

const press = (code: string) =>
  act(async () => {
    fireEvent.click(box(code));
  });

beforeEach(() => {
  vi.resetAllMocks();
  save.mockResolvedValue({ status: "success" });
});

describe("CurrencyPicker", () => {
  it("is a button with an accessible name that opens a dialog, closed until pressed", async () => {
    renderPicker();

    expect(
      screen.getByRole("button", { name: "Elegir monedas" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await open();

    expect(
      screen.getByRole("dialog", { name: "Monedas del resumen" }),
    ).toBeInTheDocument();
  });

  it("lists exactly the user's currencies, in the order given, each named with its code and its name", async () => {
    renderPicker({ currencies: ["ARS", "EUR", "USDC"] });
    await open();

    const labels = within(screen.getByRole("dialog"))
      .getAllByRole("checkbox")
      .map((each) => each.closest("label")?.textContent ?? "");

    expect(labels).toHaveLength(3);
    expect(labels[0]).toMatch(/^ARS - .*argentino/i);
    expect(labels[1]).toMatch(/^EUR - /);
    expect(labels[2]).toBe("USDC - USD Coin");
    expect(
      screen.queryByRole("checkbox", { name: /^USD / }),
    ).not.toBeInTheDocument();
  });

  it("ticks the shown currencies and leaves the hidden ones unticked", async () => {
    renderPicker({ hidden: ["USD"] });
    await open();

    expect(box("ARS")).toBeChecked();
    expect(box("USD")).not.toBeChecked();
    expect(box("USDC")).toBeChecked();
  });

  it("saves the list of hidden currencies when one is unticked", async () => {
    renderPicker();
    await open();
    await press("USD");

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(["USD"]);
  });

  it("saves the list without the currency when one is ticked again", async () => {
    renderPicker({ hidden: ["USD", "USDC"] });
    await open();
    await press("USD");

    expect(save).toHaveBeenCalledWith(["USDC"]);
  });

  it("keeps hiding a currency the user no longer has when it saves", async () => {
    renderPicker({ currencies: ["ARS", "EUR", "USD"], hidden: ["JPY"] });
    await open();
    await press("USD");

    expect(save).toHaveBeenCalledWith(["JPY", "USD"]);
  });

  it("answers at once, before the server has saved anything", async () => {
    const pending = deferred<{ status: "success" }>();

    save.mockReturnValue(pending.promise);
    renderPicker();
    await open();
    await press("USD");

    expect(box("USD")).not.toBeChecked();

    await act(async () => {
      pending.resolve({ status: "success" });
    });
  });

  it("says it is saving while the server works, and stops when it is done", async () => {
    const pending = deferred<{ status: "success" }>();

    save.mockReturnValue(pending.promise);
    renderPicker();
    await open();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await press("USD");

    expect(screen.getByRole("status")).toHaveTextContent("Guardando…");

    await act(async () => {
      pending.resolve({ status: "success" });
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("blocks presses on the trigger while saving, and frees it afterwards", async () => {
    const pending = deferred<{ status: "success" }>();

    save.mockReturnValue(pending.promise);
    renderPicker();
    await open();
    await press("USD");

    expect(
      screen.getByRole("button", { name: /Elegir monedas$/, hidden: true }),
    ).toHaveAttribute("aria-disabled", "true");

    await act(async () => {
      pending.resolve({ status: "success" });
    });

    expect(
      screen.getByRole("button", { name: /Elegir monedas$/, hidden: true }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("puts the box back and says why when the save fails", async () => {
    save.mockResolvedValue({
      status: "error",
      message: "No se pudo guardar la selección de monedas.",
    });
    renderPicker();
    await open();
    await press("USD");

    expect(box("USD")).toBeChecked();
    expect(
      screen.getByText("No se pudo guardar la selección de monedas."),
    ).toBeInTheDocument();
  });

  it("locks the last ticked currency and explains why, while the others stay free", async () => {
    renderPicker({ hidden: ["USD", "USDC"] });
    await open();

    expect(box("ARS")).toBeDisabled();
    expect(box("ARS")).toHaveAccessibleDescription(
      "Tiene que quedar al menos una moneda.",
    );
    expect(box("USD")).toBeEnabled();
    expect(box("USDC")).toBeEnabled();
  });

  it("locks nothing while more than one is ticked", async () => {
    renderPicker({ hidden: ["USDC"] });
    await open();

    expect(box("ARS")).toBeEnabled();
    expect(box("USD")).toBeEnabled();
    expect(box("USDC")).toBeEnabled();
    expect(
      screen.queryByText("Tiene que quedar al menos una moneda."),
    ).not.toBeInTheDocument();
  });

  it("shows every currency ticked when stale data hides them all, and locks none", async () => {
    renderPicker({ hidden: ["ARS", "USD", "USDC"] });
    await open();

    expect(box("ARS")).toBeChecked();
    expect(box("USD")).toBeChecked();
    expect(box("USDC")).toBeChecked();
    expect(box("ARS")).toBeEnabled();
  });
});
