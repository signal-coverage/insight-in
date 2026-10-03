// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const action = vi.hoisted(() => ({
  saveIncludeExpectedIncomesAction: vi.fn(),
}));

vi.mock("@/core/settings/actions", () => action);

import { ExpectedIncomesSwitch } from "./ExpectedIncomesSwitch";

const toggle = () =>
  screen.getByRole("switch", { name: /Sumar ingresos por cobrar/ });

// Lets the test decide when the server answers.
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.resetAllMocks();
  action.saveIncludeExpectedIncomesAction.mockResolvedValue({
    status: "success",
  });
});

describe("ExpectedIncomesSwitch", () => {
  it("is labelled and described in Spanish", () => {
    render(<ExpectedIncomesSwitch isSelected />);

    expect(toggle()).toBeInTheDocument();
    expect(
      screen.getByText(
        "Si lo apagás, el remanente objetivo solo resta lo que falta pagar.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the saved value", () => {
    const { rerender } = render(<ExpectedIncomesSwitch isSelected />);

    expect(toggle()).toBeChecked();

    rerender(<ExpectedIncomesSwitch isSelected={false} />);

    expect(toggle()).not.toBeChecked();
  });

  it("saves the new value when toggled", async () => {
    render(<ExpectedIncomesSwitch isSelected />);

    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(action.saveIncludeExpectedIncomesAction).toHaveBeenCalledTimes(1);
    expect(action.saveIncludeExpectedIncomesAction).toHaveBeenCalledWith(false);
  });

  it("answers at once, before the server has saved anything", async () => {
    const save = deferred<{ status: "success" }>();

    action.saveIncludeExpectedIncomesAction.mockReturnValue(save.promise);
    render(<ExpectedIncomesSwitch isSelected />);

    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(toggle()).not.toBeChecked();

    await act(async () => save.resolve({ status: "success" }));
  });

  it("keeps the new value once the refreshed one arrives", async () => {
    const save = deferred<{ status: "success" }>();

    action.saveIncludeExpectedIncomesAction.mockReturnValue(save.promise);

    const { rerender } = render(<ExpectedIncomesSwitch isSelected />);

    await act(async () => {
      fireEvent.click(toggle());
    });
    await act(async () => {
      save.resolve({ status: "success" });
      rerender(<ExpectedIncomesSwitch isSelected={false} />);
    });

    expect(toggle()).not.toBeChecked();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("goes back to the saved value and says why when the server refuses", async () => {
    const save = deferred<{ status: "error"; message: string }>();

    action.saveIncludeExpectedIncomesAction.mockReturnValue(save.promise);
    render(<ExpectedIncomesSwitch isSelected />);

    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(toggle()).not.toBeChecked();

    await act(async () =>
      save.resolve({ status: "error", message: "Debes iniciar sesión." }),
    );

    expect(toggle()).toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Debes iniciar sesión.",
    );
  });

  it("goes back and shows a generic message when the call itself fails", async () => {
    const save = deferred<never>();

    action.saveIncludeExpectedIncomesAction.mockReturnValue(save.promise);
    render(<ExpectedIncomesSwitch isSelected={false} />);

    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(toggle()).toBeChecked();

    await act(async () => save.reject(new Error("network down")));

    expect(toggle()).not.toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Algo salió mal. Inténtalo de nuevo.",
    );
  });

  it("clears the error on the next try", async () => {
    action.saveIncludeExpectedIncomesAction.mockResolvedValueOnce({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    render(<ExpectedIncomesSwitch isSelected />);

    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
